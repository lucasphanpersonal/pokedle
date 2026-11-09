/**
 * Small pixel-art star (the Hard mode mark). Drawn as SVG because the pixel font
 * has no ★ glyph, and the fallback font's star renders as a tiny dot at 9px.
 */
export function PixelStar({ className = '' }: { className?: string }) {
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
      <path d="M4 0h1v2H4zM3 2h3v1H3zM0 3h9v1H0zM1 4h7v1H1zM2 5h5v2H2zM1 7h2v1H1zM6 7h2v1H6zM1 8h1v1H1zM7 8h1v1H7z" />
    </svg>
  )
}
