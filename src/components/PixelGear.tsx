/**
 * Small pixel-art gear: the "settings" mark on the Endless Gens button. Drawn as SVG (an 11×11 grid) because
 * the pixel font has no gear glyph and an emoji would break the pixel look.
 */
export function PixelGear({ scale = 2, className = '' }: { scale?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 11 11"
      width={11 * scale}
      height={11 * scale}
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M4 0h3v1H4zM1 1h2v1H1zM4 1h3v1H4zM8 1h2v1H8zM1 2h9v1H1zM2 3h7v1H2zM0 4h4v1H0zM7 4h4v1H7zM0 5h4v1H0zM7 5h4v1H7zM0 6h4v1H0zM7 6h4v1H7zM2 7h7v1H2zM1 8h9v1H1zM1 9h2v1H1zM4 9h3v1H4zM8 9h2v1H8zM4 10h3v1H4z" />
    </svg>
  )
}
