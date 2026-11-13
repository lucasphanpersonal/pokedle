/** The catch (win) and escape (give up) scenes in components/CaptureScene.tsx. */
export type CaptureKind = 'catch' | 'escape'

/** Timings (ms). Keep the CSS animation lengths in index.css (.capture-*) in step. */
export const DROP_MS = 700
/** One shake: a rock left and right in the first ~36%, then a rest, at about the games' pace. */
export const SHAKE_MS = 1000
/** Three shakes either way, as in the games; then a click (caught) or a burst (broke free). */
const SHAKES: Record<CaptureKind, number> = { catch: 3, escape: 3 }
/** How long the stars stay after the click before the result screen. */
const CLICK_HOLD_MS = 1000
/** Burst until the Pokémon starts to run, then the run itself. */
const BURST_HOLD_MS = 800
const FLEE_MS = 1000

/** When each beat of a scene starts: shakes after the drop, then the click or burst (`settle`), the run, and the end. */
export function captureTimeline(kind: CaptureKind): { shakes: number; settle: number; flee?: number; end: number } {
  const settle = DROP_MS + SHAKES[kind] * SHAKE_MS
  return kind === 'catch'
    ? { shakes: SHAKES.catch, settle, end: settle + CLICK_HOLD_MS }
    : { shakes: SHAKES.escape, settle, flee: settle + BURST_HOLD_MS, end: settle + BURST_HOLD_MS + FLEE_MS }
}
