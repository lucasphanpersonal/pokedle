import { describe, expect, it } from 'vitest'
import { dailyPick, hashString, localDateKey, mulberry32, puzzleNumber } from './daily'

describe('dailyPick', () => {
  const pool = Array.from({ length: 1351 }, (_, i) => ({ id: i + 1 }))
  const day = (i: number) => `2026-12-${String(i + 1).padStart(2, '0')}`

  it('is stable for a given date', () => {
    expect(dailyPick('2026-11-08', pool)).toBe(dailyPick('2026-11-08', pool))
  })
  it('changes between days', () => {
    const picks = new Set(Array.from({ length: 30 }, (_, i) => dailyPick(day(i), pool).id))
    expect(picks.size).toBeGreaterThan(25)
  })
  it('does not depend on pool order', () => {
    const reversed = [...pool].reverse()
    for (let i = 0; i < 10; i++) expect(dailyPick(day(i), reversed).id).toBe(dailyPick(day(i), pool).id)
  })
  it('keeps the answer when other Pokémon are removed from the pool', () => {
    for (let i = 0; i < 10; i++) {
      const winner = dailyPick(day(i), pool)
      const smaller = pool.filter((p) => p.id === winner.id || p.id % 3 !== 0)
      expect(dailyPick(day(i), smaller).id).toBe(winner.id)
    }
  })
  it('rejects an empty pool', () => {
    expect(() => dailyPick('2026-11-08', [])).toThrow()
  })
})

describe('helpers', () => {
  it('formats local date keys', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
  it('numbers puzzles from launch day', () => {
    expect(puzzleNumber('2026-11-07')).toBe(1)
    expect(puzzleNumber('2026-11-08')).toBe(2)
    expect(puzzleNumber('2027-11-07')).toBe(366)
  })
  it('hash and PRNG are deterministic', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
