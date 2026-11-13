import { useCallback, useEffect, useRef, useState } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import { TILE_FLIP_DURATION_MS, TILE_FLIP_STAGGER_MS } from '../config/uiConfig'
import type { CaptureKind } from '../lib/capture'
import { playCry, stopCry } from '../lib/cry'
import { playSound } from '../lib/sound'
import type { Pokemon } from '../types/pokemon'

/** Time for a whole new row to finish flipping. */
const ROW_REVEAL_MS = (GRID_COLUMNS.length - 1) * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS

/** Length of the win fanfare (ms); the cry waits for it to finish. */
const WIN_FANFARE_MS = 1500

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/** The catch (win) or escape (give up) scene, for the game it belongs to. */
export interface Capture {
  gameId: string
  kind: CaptureKind
  pokemon: Pokemon
}

/**
 * The timed effects of a guess: holding the result screen until the new row has
 * flipped in, the per-tile ticks, the Poké Ball catch (or escape, on giving up),
 * then the win fanfare, the cry and the win burst. `gameId` is the game currently
 * rendered; everything is keyed by game so a mode switch or new game never leaves
 * an old game's effects pending. With reduced motion there is no flip or scene:
 * the fanfare and cry play at once.
 */
export function useRevealEffects(gameId: string) {
  // Held until the newest row has flipped in; keyed by game so switching modes never leaves it stuck.
  const [reveal, setReveal] = useState<{ gameId: string; token: number } | null>(null)
  // Only set from a fresh win or give up, so reloading a finished game never replays it.
  const [capture, setCaptureState] = useState<Capture | null>(null)
  // The same, readable from callbacks without side effects inside a state updater.
  const captureRef = useRef<Capture | null>(null)
  const setCapture = useCallback((next: Capture | null) => {
    captureRef.current = next
    setCaptureState(next)
  }, [])
  // Win burst, for the game it was earned in.
  const [confettiGame, setConfettiGame] = useState<string | null>(null)
  const revealToken = useRef(0)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id))
    timers.current = []
    stopCry()
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  // A mode switch or new game must not play the old game's pending ticks or fanfare, or leave its scene or win burst set to replay.
  useEffect(
    () => () => {
      clearTimers()
      setConfettiGame(null)
      setCapture(null)
    },
    [gameId, clearTimers, setCapture],
  )

  const endConfetti = useCallback(() => setConfettiGame(null), [])

  /** The fanfare, burst and cry that follow a catch. */
  const celebrate = useCallback(
    (pokemon: Pokemon, appliedId: string) => {
      playSound('win')
      later(() => playCry(pokemon), WIN_FANFARE_MS)
      if (!prefersReducedMotion()) setConfettiGame(appliedId)
    },
    [later],
  )

  /** Start the effects for an accepted guess. `appliedId` is the game the guess landed in. */
  const play = useCallback(
    (pokemon: Pokemon, appliedId: string, won: boolean) => {
      clearTimers()
      if (prefersReducedMotion()) {
        if (won) celebrate(pokemon, appliedId)
        return
      }
      const token = ++revealToken.current
      setReveal({ gameId: appliedId, token })
      // The catch starts as the row finishes, in the same update, so the result screen never flashes in between.
      later(() => {
        setReveal((cur) => (cur?.token === token ? null : cur))
        if (won) setCapture({ gameId: appliedId, kind: 'catch', pokemon })
      }, ROW_REVEAL_MS)
      // One tick per tile, as it turns over, climbing in pitch across the row.
      for (let i = 0; i < GRID_COLUMNS.length; i++) {
        later(() => playSound('tick', i), i * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS / 2)
      }
    },
    [clearTimers, celebrate, later, setCapture],
  )

  /** The player gave up: the ball bursts and the answer runs off (skipped with reduced motion). */
  const escape = useCallback(
    (pokemon: Pokemon, appliedId: string) => {
      // Giving up while the last row is still flipping cancels its pending ticks, so let go of the hold too.
      clearTimers()
      setReveal(null)
      if (!prefersReducedMotion()) setCapture({ gameId: appliedId, kind: 'escape', pokemon })
    },
    [clearTimers, setCapture],
  )

  /** The scene finished or was skipped: a catch moves on to the fanfare, burst and cry. */
  const endCapture = useCallback(() => {
    const cur = captureRef.current
    // A skip and the scene's own end can both arrive; only the first counts.
    if (!cur) return
    captureRef.current = null
    setCapture(null)
    if (cur.kind === 'catch') celebrate(cur.pokemon, cur.gameId)
  }, [celebrate, setCapture])

  const sceneShown = capture?.gameId === gameId ? capture : null
  return {
    /** True while the rendered game's newest row is still flipping in, or its catch/escape scene is playing. */
    revealing: reveal?.gameId === gameId || sceneShown !== null,
    /** The catch or escape scene to show now, if any. */
    capture: sceneShown,
    endCapture,
    /** True while the win burst for the rendered game should show. */
    confetti: confettiGame === gameId,
    endConfetti,
    play,
    escape,
  }
}
