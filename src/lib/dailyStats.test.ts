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
  it('reads the histogram, finished count and hint count, skipping non-numeric keys', () => {
    expect(parseDailyStats({ games_finished: 8, hinted: 3, histogram: { '3': 4, '5': 2, lost: 1 } })).toEqual({
      histogram: { 3: 4, 5: 2 },
      finished: 8,
      hinted: 3,
    })
  })
  it('accepts an empty day, so the panel can still show', () => {
    expect(parseDailyStats({ games_finished: 0, histogram: {} })).toEqual({ histogram: {}, finished: 0, hinted: null })
    expect(parseDailyStats({ histogram: { '2': 'many', '0': 3, '-1': 1 } })).toEqual({ histogram: {}, finished: 0, hinted: null })
  })
  it('keeps the counts consistent', () => {
    // An older server (no hinted field, finished below the solvers) still reads sensibly.
    expect(parseDailyStats({ hard: false, games_finished: 1, histogram: { '4': 6 } })).toEqual({ histogram: { 4: 6 }, finished: 6, hinted: null })
    expect(parseDailyStats({ games_finished: 2, hinted: 9, histogram: { '4': 2 } })?.hinted).toBe(2)
  })
  it('returns null for something that is not stats', () => {
    expect(parseDailyStats(null)).toBeNull()
    expect(parseDailyStats({})).toBeNull()
    expect(parseDailyStats({ histogram: 'x' })).toBeNull()
  })
})

describe('summarize', () => {
  const stats = { histogram: { 2: 2, 4: 6, 12: 2 }, finished: 12, hinted: 3 }

  it('counts players, gave-ups and the hint, and averages guesses', () => {
    const s = summarize(stats, 4)
    expect(s.players).toBe(10)
    expect(s.gaveUp).toBe(2)
    expect(s.hintPercent).toBe(25)
    expect(s.average).toBeCloseTo((2 * 2 + 4 * 6 + 12 * 2) / 10)
  })

  it('ranks you against everyone else', () => {
    const s = summarize(stats, 4)
    expect(s.fasterThanPercent).toBe(20)
    expect(s.samePercent).toBe(60)
    expect(summarize(stats, 1).fasterThanPercent).toBe(100)
  })

  it('groups long games into the last bar and marks yours', () => {
    const s = summarize(stats, 15)
    expect(s.bars).toHaveLength(10)
    expect(s.bars[9]).toEqual({ label: '10+', count: 2, isYou: true })
    expect(s.bars[3]).toEqual({ label: '4', count: 6, isYou: false })
  })

  it('still summarizes a day nobody has finished, without dividing by zero', () => {
    const s = summarize({ histogram: {}, finished: 0, hinted: 0 }, 3)
    expect(s).toMatchObject({ players: 0, gaveUp: 0, average: null, fasterThanPercent: 0, samePercent: 0, hintPercent: null })
    expect(s.bars.every((b) => b.count === 0)).toBe(true)
  })
})

describe('summarize when you gave up', () => {
  it('compares nothing with your result', () => {
    const s = summarize({ histogram: { 3: 4, 5: 2 }, finished: 7, hinted: null }, null)
    expect(s.fasterThanPercent).toBe(0)
    expect(s.samePercent).toBe(0)
    expect(s.bars.some((b) => b.isYou)).toBe(false)
    expect(s.gaveUp).toBe(1)
  })
})
