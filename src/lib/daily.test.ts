import { describe, expect, it } from 'vitest'
import { dailyIndex, hashString, localDateKey, mulberry32, puzzleNumber } from './daily'

describe('daily selection', () => {
  it('is stable for a given date', () => {
    expect(dailyIndex('2026-11-08', 1351)).toBe(dailyIndex('2026-11-08', 1351))
  })
  it('changes between days', () => {
    const picks = new Set(Array.from({ length: 30 }, (_, i) => dailyIndex(`2026-12-${String(i + 1).padStart(2, '0')}`, 1351)))
    expect(picks.size).toBeGreaterThan(25)
  })
  it('stays within the pool', () => {
    for (let d = 1; d <= 28; d++) {
      const i = dailyIndex(`2027-02-${String(d).padStart(2, '0')}`, 10)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(10)
    }
  })
  it('rejects an empty pool', () => {
    expect(() => dailyIndex('2026-11-08', 0)).toThrow()
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
