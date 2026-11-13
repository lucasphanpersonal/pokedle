/** The catch (win) and escape (give up) scenes in components/CaptureScene.tsx. */
export type CaptureKind = 'catch' | 'escape'

/** Timings (ms). Keep the CSS animation lengths in index.css (.capture-*) in step. */
export const DROP_MS = 450
export const SHAKE_MS = 520
/** Three shakes and a click for a catch; the ball bursts on the second shake when it fails. */
const SHAKES: Record<CaptureKind, number> = { catch: 3, escape: 2 }
/** How long the stars stay after the click before the result screen. */
const CLICK_HOLD_MS = 700
/** Burst until the Pokémon starts to run, then the run itself. */
const BURST_HOLD_MS = 600
const FLEE_MS = 800

/** When each beat of a scene starts: shakes after the drop, then the click or burst (`settle`), the run, and the end. */
export function captureTimeline(kind: CaptureKind): { shakes: number; settle: number; flee?: number; end: number } {
  const settle = DROP_MS + SHAKES[kind] * SHAKE_MS
  return kind === 'catch'
    ? { shakes: SHAKES.catch, settle, end: settle + CLICK_HOLD_MS }
    : { shakes: SHAKES.escape, settle, flee: settle + BURST_HOLD_MS, end: settle + BURST_HOLD_MS + FLEE_MS }
}
