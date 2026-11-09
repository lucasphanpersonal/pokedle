/**
 * A 7x7 pixel-art mark (check, tilde, cross) so a tile's result never depends on colour alone:
 * red and green look alike to many colour-blind players. One art pixel is one CSS pixel, drawn in
 * currentColor, so it takes the tile's text colour (white, or ink on yellow) and its shadow.
 */
const ART: Record<'match' | 'partial' | 'mismatch', string[]> = {
  match: [
    '.......',
    '.....##',
    '....###',
    '##.###.',
    '#####..',
    '.###...',
    '..#....',
  ],
  partial: [
    '.......',
    '.......',
    '.##...#',
    '####.##',
    '##.####',
    '#...##.',
    '.......',
  ],
  mismatch: [
    '##...##',
    '###.###',
    '.#####.',
    '..###..',
    '.#####.',
    '###.###',
    '##...##',
  ],
}

/** One SVG path of 1x1 squares per lit pixel, run-length merged along each row. */
const PATHS = Object.fromEntries(
  Object.entries(ART).map(([key, rows]) => [
    key,
    rows
      .flatMap((row, y) => [...row.matchAll(/#+/g)].map((m) => `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`))
      .join(''),
  ]),
) as Record<keyof typeof ART, string>

export type MarkKind = keyof typeof ART

/**
 * Pinned in a tile's top-right corner, just under the light top bevel (8px down, clear of the stepped
 * corner) and 3px from the right (its last column overlaps the 4px side shade), so it ends 10px from the edge and never meets the tile text.
 */
export function ResultMark({ kind, className = 'absolute right-[3px] top-2' }: { kind: MarkKind; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 7 7"
      width={7}
      height={7}
      shapeRendering="crispEdges"
      className={`result-mark pointer-events-none ${className}`}
    >
      <path d={PATHS[kind]} fill="currentColor" />
    </svg>
  )
}
