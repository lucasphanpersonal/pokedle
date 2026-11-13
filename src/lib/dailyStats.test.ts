import { describe, expect, it } from 'vitest'
import { parseDailyStats, statsUrl, summarize } from './dailyStats'

describe('statsUrl', () => {
  it('swaps /track for /stats', () => {
    expect(statsUrl('https://x.supabase.co/functions/v1/track')).toBe('https://x.supabase.co/functions/v1/stats')
  })
  it('is null without a usable track URL', () => {
    expect(statsUrl(undefined)).toBeNull()
    expect(statsUrl('')).toBeNull()
    expect(statsUrl('https://example.com/other')).toBeNull()
  })
})

describe('parseDailyStats', () => {
  it('reads the histogram and skips non-numeric keys', () => {
    expect(parseDailyStats({ histogram: { '3': 4, '5': 2, lost: 1 } })).toEqual({ histogram: { 3: 4, 5: 2 } })
  })
  it('returns null when there is nothing to show', () => {
    expect(parseDailyStats(null)).toBeNull()
    expect(parseDailyStats({})).toBeNull()
    expect(parseDailyStats({ histogram: {} })).toBeNull()
    expect(parseDailyStats({ histogram: { '2': 'many', '0': 3, '-1': 1 } })).toBeNull()
  })
})

describe('parseDailyStats and Hard mode', () => {
  it('only accepts a response that matches the stats asked for', () => {
    const body = { hard: true, histogram: { '4': 6 } }
    expect(parseDailyStats(body, true)).toEqual({ histogram: { 4: 6 } })
    expect(parseDailyStats(body, false)).toBeNull()
    expect(parseDailyStats({ hard: false, histogram: { '4': 6 } }, true)).toBeNull()
    // An older server without the echo only serves normal stats.
    expect(parseDailyStats({ histogram: { '4': 6 } }, true)).toBeNull()
    expect(parseDailyStats({ histogram: { '4': 6 } }, false)).toEqual({ histogram: { 4: 6 } })
  })
})

describe('summarize', () => {
  const stats = { histogram: { 2: 2, 4: 6, 12: 2 } }

  it('counts players and averages guesses', () => {
    const s = summarize(stats, 4)!
    expect(s.players).toBe(10)
    expect(s.average).toBeCloseTo((2 * 2 + 4 * 6 + 12 * 2) / 10)
  })

  it('ranks you against everyone else', () => {
    const s = summarize(stats, 4)!
    expect(s.fasterThanPercent).toBe(20)
    expect(s.samePercent).toBe(60)
    expect(summarize(stats, 1)!.fasterThanPercent).toBe(100)
  })

  it('groups long games into the last bar and marks yours', () => {
    const s = summarize(stats, 15)!
    expect(s.bars).toHaveLength(10)
    expect(s.bars[9]).toEqual({ label: '10+', count: 2, isYou: true })
    expect(s.bars[3]).toEqual({ label: '4', count: 6, isYou: false })
  })

  it('is null with no solvers', () => {
    expect(summarize({ histogram: { 3: 0 } }, 3)).toBeNull()
  })
})

describe('summarize when you gave up', () => {
  it('compares nothing with your result', () => {
    const s = summarize({ histogram: { 3: 4, 5: 2 } }, null)
    expect(s?.fasterThanPercent).toBe(0)
    expect(s?.samePercent).toBe(0)
    expect(s?.bars.some((b) => b.isYou)).toBe(false)
  })
})
