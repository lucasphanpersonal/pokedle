import { describe, expect, it } from 'vitest'
import { cardTileSpan } from './cardLayout'

/** Sum of spans per 12-column row, for the class prefix given ('' = normal, 'big:max-sm:'). */
function rows(count: number, hard: boolean, prefix: string): number[][] {
  const spans = Array.from({ length: count }, (_, i) => {
    const cls = cardTileSpan(i, hard).split(' ').find((c) => c.startsWith(`${prefix}col-span-`))
    return Number(cls!.split('col-span-')[1])
  })
  const out: number[][] = [[]]
  for (const s of spans) {
    const row = out[out.length - 1]
    if (row.reduce((a, b) => a + b, 0) + s > 12) out.push([s])
    else row.push(s)
  }
  return out
}

describe('cardTileSpan', () => {
  it('lays out two rows of four normally, and three wider tiles on top in Hard mode', () => {
    expect(rows(8, false, '')).toEqual([[3, 3, 3, 3], [3, 3, 3, 3]])
    expect(rows(7, true, '')).toEqual([[4, 4, 4], [3, 3, 3, 3]])
  })

  it('uses rows of three with Larger text on phones, filling the last row', () => {
    expect(rows(8, false, 'big:max-sm:')).toEqual([[4, 4, 4], [4, 4, 4], [6, 6]])
    expect(rows(7, true, 'big:max-sm:')).toEqual([[4, 4, 4], [4, 4, 4], [12]])
  })
})
