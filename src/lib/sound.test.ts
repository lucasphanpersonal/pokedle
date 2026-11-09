import { beforeEach, describe, expect, it, vi } from 'vitest'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('sound', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', { localStorage: fakeStorage() })
  })

  it('is on by default and remembers being muted', async () => {
    const a = await import('./sound')
    expect(a.isSoundOn()).toBe(true)
    a.setSoundOn(false)
    vi.resetModules()
    const b = await import('./sound')
    expect(b.isSoundOn()).toBe(false)
  })

  it('notifies subscribers so every volume control stays in sync', async () => {
    const s = await import('./sound')
    const seen = vi.fn()
    const off = s.subscribeSound(seen)
    s.setSoundOn(false)
    expect(seen).toHaveBeenCalledTimes(1)
    off()
    s.setSoundOn(true)
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('remembers the volume level and clamps it', async () => {
    const a = await import('./sound')
    expect(a.getVolume()).toBe(a.MAX_VOLUME)
    a.setVolume(3)
    a.setVolume(99)
    expect(a.getVolume()).toBe(a.MAX_VOLUME)
    a.setVolume(2)
    vi.resetModules()
    expect((await import('./sound')).getVolume()).toBe(2)
  })

  it('migrates the old on/off setting', async () => {
    window.localStorage.setItem('pokemondle:sound', 'false')
    expect((await import('./sound')).getVolume()).toBe(0)
  })

  it('speaker toggle mutes and restores the last level', async () => {
    const s = await import('./sound')
    s.setVolume(3)
    s.toggleMute()
    expect(s.getVolume()).toBe(0)
    s.toggleMute()
    expect(s.getVolume()).toBe(3)
  })

  it('each step is louder than the last', async () => {
    const { volumeGain, MAX_VOLUME } = await import('./sound')
    expect(volumeGain(0)).toBe(0)
    for (let i = 1; i <= MAX_VOLUME; i++) expect(volumeGain(i)).toBeGreaterThan(volumeGain(i - 1))
    expect(volumeGain(MAX_VOLUME)).toBe(1)
  })

  it('does not throw when Web Audio is unavailable', async () => {
    const s = await import('./sound')
    expect(() => s.playSound('win')).not.toThrow()
  })

  it('every effect has audible, ordered notes', async () => {
    const { notesFor } = await import('./sound')
    for (const name of ['type', 'move', 'select', 'tick', 'error', 'win', 'toggle'] as const) {
      const notes = notesFor(name)
      expect(notes.length).toBeGreaterThan(0)
      for (const note of notes) {
        expect(note.f).toBeGreaterThan(20)
        expect(note.dur).toBeGreaterThan(0)
      }
    }
  })

  it('shifts pitch by semitones', async () => {
    const { notesFor } = await import('./sound')
    expect(notesFor('tick', 12)[0].f).toBeCloseTo(notesFor('tick')[0].f * 2)
  })
})

describe('button press sound', () => {
  it('has a press blip that plays at the current volume', async () => {
    const s = await import('./sound')
    expect(s.notesFor('press').length).toBeGreaterThan(0)
  })
})
