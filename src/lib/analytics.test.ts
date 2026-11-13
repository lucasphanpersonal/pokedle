import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateBatch } from '../../supabase/functions/track/validate'
import { flush, isBrowserDoNotTrack, isOptedOutByPlayer, isTrackingEnabled, resetQueueForTests, setTrackingOptOut, trackFinish, trackGuess } from './analytics'
import { localDateKey } from './daily'

const URL = 'https://example.test/track'

function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size
    },
    clear: () => m.clear(),
  }
}

let beacon: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>

async function bodies(): Promise<unknown[]> {
  return Promise.all(beacon.mock.calls.map(async (c) => JSON.parse(await (c[1] as Blob).text())))
}

beforeEach(() => {
  resetQueueForTests()
  beacon = vi.fn(() => true)
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
  vi.stubEnv('VITE_TRACK_URL', URL)
  vi.stubGlobal('localStorage', fakeStorage())
  vi.stubGlobal('navigator', { sendBeacon: beacon, doNotTrack: null })
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('innerWidth', 1280)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const today = localDateKey()
const daily = { mode: 'daily' as const, gameKey: today, targetId: 25 }
const endless = { mode: 'endless' as const, gameKey: '2026-11-07T10:00:00.000Z', targetId: 6 }

describe('Gen hint flag', () => {
  it('tags events with config.hint_used once the hint is taken, and the server accepts it', async () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    const hinted = { ...daily, hinted: true }
    trackGuess(hinted, { guessId: 25, guessNumber: 2, isCorrect: true })
    trackFinish(hinted, 'won', 2)
    const [body] = await bodies()
    expect(validateBatch(body).ok).toBe(true)
    const events = (body as { events: { event: string; config: Record<string, unknown> }[] }).events
    expect(events.map((e) => [e.event, e.config.hint_used])).toEqual([
      ['game_started', false],
      ['guess_made', false],
      ['guess_made', true],
      ['game_finished', true],
    ])
    expect(events.every((e) => !('hard_mode' in e.config))).toBe(true)
  })
  it('is false for games without the hint', async () => {
    trackGuess(daily, { guessId: 25, guessNumber: 1, isCorrect: true })
    trackFinish(daily, 'won', 1)
    const [body] = await bodies()
    const events = (body as { events: { config: Record<string, unknown> }[] }).events
    expect(events.every((e) => e.config.hint_used === false)).toBe(true)
  })
})

describe('payload', () => {
  it('sends a full daily win that the server accepts', async () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    trackGuess(daily, { guessId: 25, guessNumber: 2, isCorrect: true })
    trackFinish(daily, 'won', 2)
    expect(beacon).toHaveBeenCalledTimes(1)
    const [body] = await bodies()
    const r = validateBatch(body)
    expect(r.ok).toBe(true)
    const events = (body as { events: { event: string; puzzle_date?: string }[] }).events
    expect(events.map((e) => e.event)).toEqual(['game_started', 'guess_made', 'guess_made', 'game_finished'])
    expect(events[0].puzzle_date).toBe(today)
    expect(events.some((e) => 'streak' in e)).toBe(false)
  })

  it('sends an endless win after more than ten guesses that the server accepts, without puzzle_date', async () => {
    for (let n = 1; n <= 12; n++) trackGuess(endless, { guessId: 100 + n, guessNumber: n, isCorrect: false })
    trackGuess(endless, { guessId: 1, guessNumber: 13, isCorrect: true })
    trackFinish(endless, 'won', 13)
    const [body] = await bodies()
    const r = validateBatch(body)
    expect(r.ok).toBe(true)
    const events = (body as { events: Record<string, unknown>[] }).events
    expect(events).toHaveLength(15)
    expect(events.every((e) => !('puzzle_date' in e))).toBe(true)
  })

  it('classifies devices by width', async () => {
    vi.stubGlobal('innerWidth', 400)
    trackGuess(endless, { guessId: 1, guessNumber: 1, isCorrect: false })
    flush()
    const [body] = await bodies()
    expect((body as { events: { device: string }[] }).events[0].device).toBe('phone')
  })

  it('splits one game into batches of at most 60', async () => {
    for (let i = 0; i < 130; i++) trackGuess(endless, { guessId: 1, guessNumber: 1, isCorrect: false })
    flush()
    expect(beacon).toHaveBeenCalledTimes(3)
  })

  it('falls back to fetch when sendBeacon is unavailable or refuses', () => {
    beacon.mockReturnValue(false)
    trackGuess(endless, { guessId: 1, guessNumber: 1, isCorrect: false })
    flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true })
  })

  it('never throws when everything is broken', () => {
    beacon.mockImplementation(() => {
      throw new Error('x')
    })
    fetchMock.mockImplementation(() => {
      throw new Error('y')
    })
    expect(() => {
      trackGuess(endless, { guessId: 1, guessNumber: 1, isCorrect: false })
      flush()
    }).not.toThrow()
  })
})

describe('opt-out and no endpoint', () => {
  const attempt = () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    trackFinish(daily, 'won', 1)
    flush()
  }
  const silent = () => {
    expect(beacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  }

  it('is a no-op without VITE_TRACK_URL', () => {
    vi.stubEnv('VITE_TRACK_URL', '')
    expect(isTrackingEnabled()).toBe(false)
    attempt()
    silent()
  })
  it('respects Global Privacy Control', () => {
    vi.stubGlobal('navigator', { sendBeacon: beacon, globalPrivacyControl: true })
    attempt()
    silent()
  })
  it('respects Do Not Track', () => {
    vi.stubGlobal('navigator', { sendBeacon: beacon, doNotTrack: '1' })
    attempt()
    silent()
  })
  it('respects the opt-out flag and drops queued events', () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    setTrackingOptOut(true)
    expect(isTrackingEnabled()).toBe(false)
    attempt()
    silent()
    setTrackingOptOut(false)
    expect(isTrackingEnabled()).toBe(true)
  })
  it('clears the queue on opt-out so flush sends nothing', () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    expect(setTrackingOptOut(true)).toBe(true)
    flush()
    silent()
    setTrackingOptOut(false)
    flush()
    silent()
  })
  it('opt-out holds when localStorage throws', () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    const boom = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom, key: boom, length: 0 })
    expect(setTrackingOptOut(true)).toBe(false)
    expect(isOptedOutByPlayer()).toBe(true)
    expect(isTrackingEnabled()).toBe(false)
    attempt()
    silent()
    expect(setTrackingOptOut(false)).toBe(false)
    expect(isOptedOutByPlayer()).toBe(false)
  })
  it('detects browser privacy signals', () => {
    expect(isBrowserDoNotTrack()).toBe(false)
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    expect(isBrowserDoNotTrack()).toBe(true)
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    expect(isBrowserDoNotTrack()).toBe(true)
    vi.stubGlobal('navigator', { doNotTrack: '0', globalPrivacyControl: false })
    expect(isBrowserDoNotTrack()).toBe(false)
  })
})

describe('duplicates', () => {
  it('sends game_finished only once when finish is reported twice', async () => {
    trackGuess(daily, { guessId: 25, guessNumber: 1, isCorrect: true })
    trackFinish(daily, 'won', 1)
    trackFinish(daily, 'won', 1)
    const sent = (await bodies()).flatMap((b) => (b as { events: { event: string }[] }).events)
    expect(sent.filter((e) => e.event === 'game_finished')).toHaveLength(1)
  })

  it('sends game_started only once, even across a reload', async () => {
    trackGuess(daily, { guessId: 1, guessNumber: 1, isCorrect: false })
    flush()
    resetQueueForTests() // simulated reload: memory gone, localStorage kept
    trackGuess(daily, { guessId: 2, guessNumber: 2, isCorrect: false })
    flush()
    const all = (await bodies()).flatMap((b) => (b as { events: { event: string }[] }).events)
    expect(all.filter((e) => e.event === 'game_started')).toHaveLength(1)
    const ids = new Set(all.map((e) => (e as unknown as { game_id: string }).game_id))
    expect(ids.size).toBe(1)
  })

  it('does not resend game_finished for a finished game after reload', async () => {
    trackGuess(daily, { guessId: 25, guessNumber: 1, isCorrect: true })
    trackFinish(daily, 'won', 1)
    resetQueueForTests()
    trackFinish(daily, 'won', 1)
    flush()
    expect(beacon).toHaveBeenCalledTimes(1)
    const events = ((await bodies())[0] as { events: { event: string }[] }).events
    expect(events.filter((e) => e.event === 'game_finished')).toHaveLength(1)
  })

  it('gives a new endless game a new game_id', async () => {
    trackGuess(endless, { guessId: 1, guessNumber: 1, isCorrect: false })
    trackGuess({ ...endless, gameKey: '2026-11-07T11:00:00.000Z' }, { guessId: 1, guessNumber: 1, isCorrect: false })
    flush()
    expect(beacon).toHaveBeenCalledTimes(2)
  })
})
