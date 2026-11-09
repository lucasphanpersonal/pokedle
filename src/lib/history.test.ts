import { describe, expect, it } from 'vitest'
import { computeStats, EMPTY_ENDLESS_RECORD, parseEndlessRecord, parseHistory, recordEndless, recordSolve, type HistoryEntry } from './history'

const e = (date: string, guesses = 5, targetId = 25): HistoryEntry => ({ date, targetId, guesses })

describe('parseHistory', () => {
  it('drops junk, dedupes by date and sorts newest first', () => {
    const out = parseHistory([e('2026-11-07'), { date: 'x' }, null, e('2026-11-09'), e('2026-11-07', 9), { ...e('2026-11-08'), guesses: 0 }])
    expect(out.map((x) => x.date)).toEqual(['2026-11-09', '2026-11-07'])
    expect(out[1].guesses).toBe(5)
  })
  it('returns [] for non-arrays', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory({})).toEqual([])
  })
})

describe('recordSolve', () => {
  it('adds a new date and ignores a repeat', () => {
    const one = recordSolve([], e('2026-11-07'))
    expect(one).toHaveLength(1)
    expect(recordSolve(one, e('2026-11-07', 2))).toBe(one)
  })
})

describe('computeStats', () => {
  it('is empty for no history', () => {
    expect(computeStats([], '2026-11-08')).toEqual({
      currentStreak: 0, bestStreak: 0, solved: 0, averageGuesses: null, fewestGuesses: null,
    })
  })
  it('counts a streak that includes today', () => {
    const s = computeStats([e('2026-11-06'), e('2026-11-07'), e('2026-11-08')], '2026-11-08')
    expect(s.currentStreak).toBe(3)
    expect(s.bestStreak).toBe(3)
  })
  it('keeps the streak alive while today is still open', () => {
    expect(computeStats([e('2026-11-06'), e('2026-11-07')], '2026-11-08').currentStreak).toBe(2)
  })
  it('resets the current streak after a missed day but keeps the best', () => {
    const s = computeStats([e('2026-11-01'), e('2026-11-02'), e('2026-11-03'), e('2026-11-07')], '2026-11-09')
    expect(s.currentStreak).toBe(0)
    expect(s.bestStreak).toBe(3)
  })
  it('handles month boundaries and totals', () => {
    const s = computeStats([e('2026-10-31', 4), e('2026-11-01', 8)], '2026-11-01')
    expect(s.currentStreak).toBe(2)
    expect(s.solved).toBe(2)
    expect(s.averageGuesses).toBe(6)
    expect(s.fewestGuesses).toBe(4)
  })
})

describe('hard mode in history', () => {
  it('keeps the hard marker, drops invalid ones, and counts hard solves in streaks', () => {
    const out = parseHistory([{ ...e('2026-11-08'), hard: true }, { ...e('2026-11-07'), hard: 'yes' }])
    expect(out[0].hard).toBe(true)
    expect(out[1].hard).toBeUndefined()
    expect(computeStats(out, '2026-11-08').currentStreak).toBe(2)
  })
})

describe('Endless record', () => {
  it('counts each finished game once, by its key', () => {
    const a = recordEndless(EMPTY_ENDLESS_RECORD, 'g1', 'won')
    expect(a).toEqual({ caught: 1, gaveUp: 0, last: 'g1' })
    expect(recordEndless(a, 'g1', 'won')).toBe(a)
    expect(recordEndless(a, 'g2', 'lost')).toEqual({ caught: 1, gaveUp: 1, last: 'g2' })
  })
  it('reads junk as an empty record', () => {
    expect(parseEndlessRecord(null)).toEqual(EMPTY_ENDLESS_RECORD)
    expect(parseEndlessRecord({ caught: -1, gaveUp: 2.5, last: 3 })).toEqual(EMPTY_ENDLESS_RECORD)
    expect(parseEndlessRecord({ caught: 4, gaveUp: 1, last: 'k' })).toEqual({ caught: 4, gaveUp: 1, last: 'k' })
  })
})
