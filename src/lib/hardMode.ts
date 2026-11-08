import { loadJson, saveJson } from './storage'

/**
 * Hard mode hides the Gen column. It is a per-device preference (off by
 * default) that decides how the *next* game starts. Each game records its own
 * `hard` flag when its first guess is made (see applyGuess in game.ts), so
 * changing the switch later never changes a game already under way.
 */
const KEY = 'hard-mode'
let pref: boolean | null = null

export function isHardPref(): boolean {
  if (pref === null) pref = loadJson(KEY) === true
  return pref
}

const listeners = new Set<() => void>()

/** For useSyncExternalStore, so the Help switch and the game follow the same state. */
export function subscribeHardPref(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function setHardPref(on: boolean): void {
  pref = on
  saveJson(KEY, on)
  listeners.forEach((l) => l())
}

/** Another tab changed the preference: forget our cached copy and re-read it. */
export function reloadHardPref(): void {
  pref = null
  listeners.forEach((l) => l())
}

/**
 * Whether a game is played in Hard mode. A game with guesses keeps the mode it
 * started in; a fresh game follows the current preference.
 */
export function effectiveHard(game: { guessIds: number[]; hard?: boolean }, preference: boolean): boolean {
  return game.guessIds.length > 0 ? game.hard === true : preference
}

/** The switch is locked while a game is in progress (has guesses and isn't solved yet). */
export function hardLocked(game: { guessIds: number[]; targetId: number }): boolean {
  return game.guessIds.length > 0 && !game.guessIds.includes(game.targetId)
}
