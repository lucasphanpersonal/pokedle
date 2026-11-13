import { describe, expect, it } from 'vitest'
import art from '../../scripts/icons/pokeball.txt?raw'
import { ballPaths, BALL_PALETTE, parseBallArt, STAR_ART, STAR_PALETTE } from './pokeballArt'

describe('pokeballArt', () => {
  it('parses the 16x16 and 32x32 drawings', () => {
    const { grid16, grid32 } = parseBallArt(art)
    expect(grid16).toHaveLength(16)
    expect(grid32).toHaveLength(32)
  })

  it('rejects a drawing of the wrong size or with unknown colours', () => {
    expect(() => parseBallArt('kk\nkk\n\nkk')).toThrow()
    const { grid16, grid32 } = parseBallArt(art)
    expect(() => parseBallArt([grid16.join('\n'), grid32.map((r) => r.replace('k', 'Z')).join('\n')].join('\n\n'))).toThrow(/unknown colour/)
  })

  it('splits into lid and base with every painted pixel in exactly one half', () => {
    const { grid32 } = parseBallArt(art)
    const count = (paths: { d: string }[]) =>
      paths.reduce((n, p) => n + [...p.d.matchAll(/h(\d+)/g)].reduce((m, x) => m + Number(x[1]), 0), 0)
    const painted = grid32.join('').replace(/\./g, '').length
    expect(count(ballPaths(grid32, 0, 16)) + count(ballPaths(grid32, 16, 32))).toBe(painted)
    for (const p of ballPaths(grid32)) expect(Object.values(BALL_PALETTE)).toContain(p.color)
  })

  it('draws the star from its own palette', () => {
    for (const p of ballPaths(STAR_ART, 0, STAR_ART.length, STAR_PALETTE)) expect(Object.values(STAR_PALETTE)).toContain(p.color)
  })
})
