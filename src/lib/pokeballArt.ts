/**
 * The hand-drawn pixel Poké Ball (scripts/icons/pokeball.txt), shared by the site icons
 * (`npm run icons`) and the in-game catch and escape animations, so both use the same drawing.
 *
 * The drawing holds two grids separated by a blank line: 16x16 for small tab icons and 32x32
 * for everything larger. Each letter is a colour from BALL_PALETTE; `.` is transparent.
 */
export const BALL_PALETTE: Record<string, string> = {
  k: '#202830', // outline and band (--color-ds-ink)
  R: '#e84040', // red
  r: '#a82028', // red shade
  L: '#ffa098', // red highlight
  W: '#f8f8f8', // white (--color-ds-paper)
  w: '#b0b8c4', // white shade
}

/** Splits the drawing into its 16x16 and 32x32 grids, checking their size and colours. */
export function parseBallArt(text: string): { grid16: string[]; grid32: string[] } {
  const [grid16, grid32] = text
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim().split(/\r?\n/).map((row) => row.trim()))
  for (const [grid, size] of [
    [grid16, 16],
    [grid32, 32],
  ] as const) {
    if (!grid || grid.length !== size || grid.some((row) => row.length !== size)) {
      throw new Error(`pokeball.txt: expected a ${size}x${size} grid`)
    }
    for (const ch of grid.join('')) if (ch !== '.' && !(ch in BALL_PALETTE)) throw new Error(`pokeball.txt: unknown colour "${ch}"`)
  }
  return { grid16, grid32 }
}

/**
 * SVG paths for rows [from, to) of a grid: one path per colour, made of 1x1 squares
 * run-length merged along each row. Coordinates are in grid pixels. Other pixel drawings
 * (the catch stars) pass their own palette.
 */
export function ballPaths(
  grid: string[],
  from = 0,
  to = grid.length,
  palette: Record<string, string> = BALL_PALETTE,
): { color: string; d: string }[] {
  const byColor = new Map<string, string>()
  for (let y = from; y < to; y++) {
    for (const m of grid[y].matchAll(/([^.])\1*/g)) {
      const ch = m[1]
      const run = `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`
      byColor.set(ch, (byColor.get(ch) ?? '') + run)
    }
  }
  return [...byColor].map(([ch, d]) => ({ color: palette[ch], d }))
}

/** A 9x9 pixel star with an ink outline: the stars that pop out of the ball after a catch. */
export const STAR_ART = [
  '....k....',
  '...kYk...',
  'kkkYYYkkk',
  'kYYYLYYYk',
  '.kYYYYYk.',
  '..kYYYk..',
  '.kYYkYYk.',
  '.kYk.kYk.',
  '.kk...kk.',
]
export const STAR_PALETTE: Record<string, string> = { k: '#202830', Y: '#f8d030', L: '#fff8c8' }
