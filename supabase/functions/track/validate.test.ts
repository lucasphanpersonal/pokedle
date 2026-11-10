import { describe, expect, it } from 'vitest'
import { MAX_BATCH, validateBatch } from './validate.ts'

const NOW = new Date('2026-11-07T12:00:00Z')
const GAME = '3fa85b3a-8158-46e3-8e84-af7319e0d0a4'

const base = {
  game_id: GAME,
  mode: 'daily',
  puzzle_date: '2026-11-07',
  target_id: 25,
  device: 'phone',
  app_version: '1.2.3',
  config: { gens: 3, hard: true },
}
const started = { ...base, event: 'game_started' }
const guess = { ...base, event: 'guess_made', guess_id: 4, guess_number: 1, is_correct: false }
const finished = { ...base, event: 'game_finished', result: 'won', guess_count: 3, streak: 2, duration_s: 90 }

const run = (events: unknown[]) => validateBatch({ events }, NOW)
const err = (events: unknown[]) => {
  const r = run(events)
  return r.ok ? null : r.error
}

describe('valid batches', () => {
  it('accepts each event type', () => {
    for (const e of [started, guess, finished]) expect(run([e]).ok).toBe(true)
  })
  it('accepts a full game and normalises rows', () => {
    const r = run([started, guess, finished])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.game_id).toBe(GAME)
      expect(r.rows).toHaveLength(3)
      expect(r.rows[0].guess_id).toBeNull()
      expect(r.rows[2].result).toBe('won')
    }
  })
  it('accepts endless without puzzle_date, and optional fields omitted', () => {
    const e = { event: 'game_started', game_id: GAME, mode: 'endless', target_id: 1, device: 'desktop' }
    expect(run([e]).ok).toBe(true)
    expect(run([{ ...finished, streak: undefined, duration_s: undefined }]).ok).toBe(true)
  })
})

describe('invalid input', () => {
  it('rejects non-object bodies and wrong envelope', () => {
    expect(validateBatch(null, NOW).ok).toBe(false)
    expect(validateBatch([], NOW).ok).toBe(false)
    expect(validateBatch({ events: 'x' }, NOW).ok).toBe(false)
    expect(validateBatch({ events: [started], extra: 1 }, NOW).ok).toBe(false)
    expect(err([])).toBe('empty_batch')
  })
  it('rejects unknown event and unknown fields', () => {
    expect(err([{ ...started, event: 'nope' }])).toBe('unknown_event')
    expect(err([{ ...started, ip: '1.2.3.4' }])).toBe('unknown_field')
    expect(err([{ ...started, guess_id: 4 }])).toBe('unknown_field')
  })
  it('rejects missing event-specific fields', () => {
    for (const k of ['guess_id', 'guess_number', 'is_correct']) {
      expect(err([{ ...guess, [k]: undefined }])).toBe('missing_field')
    }
    for (const k of ['result', 'guess_count']) {
      expect(err([{ ...finished, [k]: undefined }])).toBe('missing_field')
    }
  })
  it('rejects bad mode / puzzle_date combinations', () => {
    expect(err([{ ...started, mode: 'weekly' }])).toBe('invalid_mode')
    expect(err([{ ...started, puzzle_date: undefined }])).toBe('invalid_puzzle_date')
    expect(err([{ ...started, mode: 'endless' }])).toBe('invalid_puzzle_date')
    expect(err([{ ...started, puzzle_date: '2026-02-30' }])).toBe('invalid_puzzle_date')
    expect(err([{ ...started, puzzle_date: '07/11/2026' }])).toBe('invalid_puzzle_date')
    expect(err([{ ...started, puzzle_date: '2030-01-01' }])).toBe('invalid_puzzle_date')
  })
  it('rejects oversize batches', () => {
    expect(run(Array(MAX_BATCH).fill(guess)).ok).toBe(true)
    expect(err(Array(MAX_BATCH + 1).fill(guess))).toBe('batch_too_large')
  })
  it('rejects mixed game_ids and bad uuids', () => {
    expect(err([started, { ...guess, game_id: '3fa85b3a-8158-46e3-8e84-af7319e0d0a5' }])).toBe('mixed_game_ids')
    expect(err([{ ...started, game_id: 'abc' }])).toBe('invalid_game_id')
  })
  it('rejects out-of-range or wrong-typed numbers', () => {
    expect(err([{ ...guess, guess_number: 0 }])).toBe('invalid_guess_number')
    expect(err([{ ...guess, guess_number: 501 }])).toBe('invalid_guess_number')
    expect(err([{ ...guess, guess_id: 1.5 }])).toBe('invalid_guess_id')
    expect(err([{ ...guess, guess_id: '4' }])).toBe('invalid_guess_id')
    expect(err([{ ...guess, is_correct: 'no' }])).toBe('invalid_is_correct')
    expect(err([{ ...started, target_id: 0 }])).toBe('invalid_target_id')
    expect(err([{ ...finished, guess_count: 501 }])).toBe('invalid_guess_count')
    expect(err([{ ...finished, streak: -1 }])).toBe('invalid_streak')
    expect(err([{ ...finished, duration_s: 86401 }])).toBe('invalid_duration')
    expect(err([{ ...finished, result: 'draw' }])).toBe('invalid_result')
  })
  it('rejects bad device, version and config', () => {
    expect(err([{ ...started, device: 'tv' }])).toBe('invalid_device')
    expect(err([{ ...started, app_version: 'x'.repeat(40) }])).toBe('invalid_app_version')
    expect(err([{ ...started, config: { Bad: 1 } }])).toBe('invalid_config')
    expect(err([{ ...started, config: { a: { b: 1 } } }])).toBe('invalid_config')
    expect(err([{ ...started, config: { a: 'has spaces and symbols!' } }])).toBe('invalid_config')
  })
  it('enforces the +-3 day puzzle_date window', () => {
    expect(run([{ ...started, puzzle_date: '2026-11-10' }]).ok).toBe(true)
    expect(run([{ ...started, puzzle_date: '2026-11-04' }]).ok).toBe(true)
    expect(err([{ ...started, puzzle_date: '2026-11-11' }])).toBe('invalid_puzzle_date')
    expect(err([{ ...started, puzzle_date: '2026-11-03' }])).toBe('invalid_puzzle_date')
  })
  it('rejects bad config shapes', () => {
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, i]))
    expect(err([{ ...started, config: many }])).toBe('invalid_config')
    expect(err([{ ...started, config: { a: 2e9 } }])).toBe('invalid_config')
    expect(err([{ ...started, config: { a: Number.NaN } }])).toBe('invalid_config')
    expect(err([{ ...started, config: JSON.parse('{"__proto__": 1}') }])).toBe('invalid_config')
    expect(err([{ ...started, config: [1] }])).toBe('invalid_config')
  })
  it('lowercases uppercase UUIDs', () => {
    const r = run([{ ...started, game_id: GAME.toUpperCase() }])
    expect(r.ok && r.game_id).toBe(GAME)
    expect(r.ok && r.rows[0].game_id).toBe(GAME)
  })
  it('accepts explicit nulls for optional fields', () => {
    const r = run([{ ...finished, streak: null, duration_s: null, app_version: null, config: null }])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.rows[0].streak).toBeNull()
      expect(r.rows[0].app_version).toBeNull()
      expect(r.rows[0].config).toEqual({})
    }
  })
  it("accepts result 'lost' for endless (give up)", () => {
    const r = run([{ ...finished, mode: 'endless', puzzle_date: undefined, result: 'lost', guess_count: 6 }])
    expect(r.ok && r.rows[0].result).toBe('lost')
  })
  it("rejects result 'lost' for daily (no loss state)", () => {
    expect(err([{ ...finished, result: 'lost', guess_count: 6 }])).toBe('invalid_result')
  })
  it('rejects bad app_version characters', () => {
    for (const v of ['1 2', '1.0;drop', '<b>', '']) {
      expect(err([{ ...started, app_version: v }])).toBe('invalid_app_version')
    }
  })
  it('rejects the batch when a later event in the same game is invalid', () => {
    expect(err([started, guess, { ...guess, guess_number: 501 }])).toBe('invalid_guess_number')
  })
})
