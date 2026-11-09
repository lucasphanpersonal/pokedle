import { useCallback, useEffect, useRef, useState } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import { TILE_FLIP_DURATION_MS, TILE_FLIP_STAGGER_MS } from '../config/uiConfig'
import { playCry, stopCry } from '../lib/cry'
import { playSound } from '../lib/sound'
import type { Pokemon } from '../types/pokemon'

/** Time for a whole new row to finish flipping (Hard mode has one less tile). */
const rowRevealMs = (hard: boolean) =>
  (GRID_COLUMNS.length - (hard ? 2 : 1)) * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS

/** Length of the win fanfare (ms); the cry waits for it to finish. */
const WIN_FANFARE_MS = 1500

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * The timed effects of a guess: holding the result screen until the new row has
 * flipped in, the per-tile ticks, the win fanfare, the cry and the win burst.
 * `gameId` is the game currently rendered; everything is keyed by game so a mode
 * switch or new game never leaves an old game's effects pending.
 */
export function useRevealEffects(gameId: string, hard: boolean) {
  // Held until the newest row has flipped in; keyed by game so switching modes never leaves it stuck.
  const [reveal, setReveal] = useState<{ gameId: string; token: number } | null>(null)
  // Win burst, for the game it was earned in. Only set from a fresh guess, so reloading a won Daily never replays it.
  const [confettiGame, setConfettiGame] = useState<string | null>(null)
  const revealToken = useRef(0)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    stopCry()
  }, [])

  // A mode switch or new game must not play the old game's pending ticks or fanfare, or leave its win burst set to replay.
  useEffect(
    () => () => {
      clearTimers()
      setConfettiGame(null)
    },
    [gameId, clearTimers],
  )

  const endConfetti = useCallback(() => setConfettiGame(null), [])

  /** Start the effects for an accepted guess. `appliedId` is the game the guess landed in. */
  const play = useCallback(
    (pokemon: Pokemon, appliedId: string, won: boolean) => {
      clearTimers()
      const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
      if (prefersReducedMotion()) {
        if (won) {
          playSound('win')
          later(() => playCry(pokemon), WIN_FANFARE_MS)
        }
        return
      }
      const token = ++revealToken.current
      setReveal({ gameId: appliedId, token })
      later(() => setReveal((cur) => (cur?.token === token ? null : cur)), rowRevealMs(hard))
      // One tick per tile, as it turns over, climbing in pitch across the row.
      for (let i = 0; i < GRID_COLUMNS.length - (hard ? 1 : 0); i++) {
        later(() => playSound('tick', i), i * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS / 2)
      }
      if (won) {
        later(() => playSound('win'), rowRevealMs(hard) + 100)
        later(() => playCry(pokemon), rowRevealMs(hard) + 100 + WIN_FANFARE_MS)
        later(() => setConfettiGame(appliedId), rowRevealMs(hard) + 100)
      }
    },
    [clearTimers, hard],
  )

  return {
    /** True while the rendered game's newest row is still flipping in. */
    revealing: reveal?.gameId === gameId,
    /** True while the win burst for the rendered game should show. */
    confetti: confettiGame === gameId,
    endConfetti,
    play,
  }
}
