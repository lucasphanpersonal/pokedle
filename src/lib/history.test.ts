import { describe, expect, it } from 'vitest'
import { computeEndlessStats, computeStats, EMPTY_ENDLESS_RECORD, parseEndlessRecord, parseHistory, recordEndless, recordSolve, type HistoryEntry } from './history'

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
      currentStreak: 0, bestStreak: 0, solved: 0, gaveUp: 0, averageGuesses: null, fewestGuesses: null,
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

describe('giving up a Daily', () => {
  const lost = (date: string, guesses = 3): HistoryEntry => ({ ...e(date, guesses), lost: true })
  it('keeps the lost marker and records it once per date', () => {
    expect(parseHistory([{ ...e('2026-11-08'), lost: true }, { ...e('2026-11-07'), lost: 'yes' }]).map((x) => x.lost)).toEqual([true, undefined])
    const one = recordSolve([], lost('2026-11-08'))
    expect(recordSolve(one, e('2026-11-08'))).toBe(one)
  })
  it('ends the streak straight away when given up today', () => {
    const s = computeStats([e('2026-11-06'), e('2026-11-07'), lost('2026-11-08')], '2026-11-08')
    expect(s.currentStreak).toBe(0)
    expect(s.bestStreak).toBe(2)
  })
  it('breaks a run in the middle and stays out of the averages', () => {
    const s = computeStats([e('2026-11-05', 4), lost('2026-11-06', 20), e('2026-11-07', 6), e('2026-11-08', 8)], '2026-11-08')
    expect(s.currentStreak).toBe(2)
    expect(s.bestStreak).toBe(2)
    expect(s.solved).toBe(3)
    expect(s.gaveUp).toBe(1)
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
    const a = recordEndless(EMPTY_ENDLESS_RECORD, 'g1', 'won', 6)
    expect(a).toEqual({ caught: 1, gaveUp: 0, guesses: 6, scored: 1, fewest: 6, last: 'g1' })
    expect(recordEndless(a, 'g1', 'won', 6)).toBe(a)
    expect(recordEndless(a, 'g2', 'lost', 9)).toEqual({ caught: 1, gaveUp: 1, guesses: 6, scored: 1, fewest: 6, last: 'g2' })
  })
  it('keeps guess totals and the fewest for caught games only', () => {
    let r = recordEndless(EMPTY_ENDLESS_RECORD, 'a', 'won', 8)
    r = recordEndless(r, 'b', 'lost', 20)
    r = recordEndless(r, 'c', 'won', 3)
    expect(computeEndlessStats(r)).toEqual({ played: 3, caught: 2, gaveUp: 1, averageGuesses: 5.5, fewestGuesses: 3 })
  })
  it('shows no average before any caught game is scored', () => {
    expect(computeEndlessStats(EMPTY_ENDLESS_RECORD)).toEqual({ played: 0, caught: 0, gaveUp: 0, averageGuesses: null, fewestGuesses: null })
  })
  it('reads an older tally without guess totals and scores only new games', () => {
    const old = parseEndlessRecord({ caught: 4, gaveUp: 1, last: 'k' })
    expect(old).toEqual({ caught: 4, gaveUp: 1, guesses: 0, scored: 0, fewest: null, last: 'k' })
    expect(computeEndlessStats(old).averageGuesses).toBeNull()
    const next = recordEndless(old, 'n', 'won', 7)
    expect(computeEndlessStats(next)).toEqual({ played: 6, caught: 5, gaveUp: 1, averageGuesses: 7, fewestGuesses: 7 })
  })
  it('reads junk as an empty record', () => {
    expect(parseEndlessRecord(null)).toEqual(EMPTY_ENDLESS_RECORD)
    expect(parseEndlessRecord({ caught: -1, gaveUp: 2.5, last: 3 })).toEqual(EMPTY_ENDLESS_RECORD)
  })
  it('drops guess totals that do not add up', () => {
    const base = { caught: 2, gaveUp: 0, last: 'k' }
    const dropped = { ...base, guesses: 0, scored: 0, fewest: null }
    expect(parseEndlessRecord({ ...base, guesses: 10, scored: 3, fewest: 2 })).toEqual(dropped) // more scored than caught
    expect(parseEndlessRecord({ ...base, guesses: 3, scored: 2, fewest: 2 })).toEqual(dropped) // total below scored × fewest
    expect(parseEndlessRecord({ ...base, guesses: 10, scored: 2, fewest: 0 })).toEqual(dropped)
    expect(parseEndlessRecord({ ...base, guesses: 10, scored: 2, fewest: 4 })).toEqual({ ...base, guesses: 10, scored: 2, fewest: 4 })
  })
})
