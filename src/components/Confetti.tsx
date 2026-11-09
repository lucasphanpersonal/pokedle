import { useEffect, useState, type CSSProperties } from 'react'

/** Pixel confetti in the game's palette, with a few Poké Balls and stars mixed in. */
const COLORS = ['#e04848', '#48b848', '#e8c030', '#78c8f0', '#f8f8f8', '#a02828']
const PIECE_COUNT = 40
/** How long the burst stays on screen (ms); keep at or above the longest fall in Confetti's pieces. */
export const CONFETTI_MS = 2200

type Kind = 'square' | 'ball' | 'star'

interface Piece {
  id: number
  kind: Kind
  color: string
  left: number
  delay: number
  duration: number
  drift: number
  spin: number
  size: number
}

function makePieces(): Piece[] {
  const kinds: Kind[] = ['square', 'square', 'square', 'ball', 'star']
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
  return Array.from({ length: PIECE_COUNT }, (_, id) => ({
    id,
    kind: pick(kinds),
    color: pick(COLORS),
    left: Math.random() * 100,
    delay: Math.random() * 350,
    duration: 1500 + Math.random() * 500,
    drift: (Math.random() * 2 - 1) * 60,
    spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
    size: 8 + pick([0, 2, 4]),
  }))
}

/**
 * A short, non-blocking burst shown on a win. Purely decorative: hidden from
 * assistive tech, ignores pointer input, and calls onDone once it has finished.
 * App only mounts it when the player hasn't asked for reduced motion.
 */
export function Confetti({ onDone }: { onDone: () => void }) {
  const [pieces] = useState(makePieces)

  useEffect(() => {
    const id = window.setTimeout(onDone, CONFETTI_MS)
    return () => window.clearTimeout(id)
  }, [onDone])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((p) => {
        const style = {
          left: `${p.left}%`,
          color: p.color,
          animationDelay: `${p.delay}ms`,
          animationDuration: `${p.duration}ms`,
          backgroundColor: p.kind === 'square' ? p.color : undefined,
          '--drift': `${p.drift}px`,
          '--spin': `${p.spin}deg`,
          '--size': `${p.size}px`,
        } as CSSProperties
        return (
          <span key={p.id} className={`confetti-piece confetti-${p.kind}`} style={style}>
            {p.kind === 'star' ? '★' : null}
          </span>
        )
      })}
    </div>
  )
}
