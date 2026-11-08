import { describe, expect, it } from 'vitest'
import { parseDate } from './params.ts'

describe('parseDate', () => {
  it('accepts a real calendar date', () => {
    expect(parseDate('2026-11-07')).toBe('2026-11-07')
    expect(parseDate('2028-02-29')).toBe('2028-02-29')
  })

  it('rejects missing, malformed and impossible dates', () => {
    for (const bad of [null, '', '2026-1-7', '20261107', '2026-02-30', '2027-02-29', '2026-13-01', '2026-11-07T00:00', 'today']) {
      expect(parseDate(bad)).toBeNull()
    }
  })
})
