/**
 * Small pixel-art light bulb: the Gen hint mark (History, the result screen, the hint badge).
 * Drawn as SVG because the pixel font has no bulb glyph and an emoji would break the pixel look.
 */
export function PixelBulb({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 9 9"
      width="9"
      height="9"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M3 0h3v1H3zM2 1h5v1H2zM1 2h7v2H1zM2 4h5v1H2zM3 5h3v1H3zM3 7h3v1H3zM4 8h1v1H4z" />
    </svg>
  )
}
