import { describe, expect, it } from 'vitest'
import { cardTileSpan } from './cardLayout'

/** Sum of spans per 12-column row, for the class prefix given ('' = normal, 'big:max-sm:'). */
function rows(count: number, prefix: string): number[][] {
  const spans = Array.from({ length: count }, (_, i) => {
    const cls = cardTileSpan(i).split(' ').find((c) => c.startsWith(`${prefix}col-span-`))
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
  it('lays out three wider tiles on top, then a row of four', () => {
    expect(rows(7, '')).toEqual([[4, 4, 4], [3, 3, 3, 3]])
  })

  it('uses rows of three with Larger text on phones, filling the last row', () => {
    expect(rows(7, 'big:max-sm:')).toEqual([[4, 4, 4], [4, 4, 4], [12]])
  })
})
