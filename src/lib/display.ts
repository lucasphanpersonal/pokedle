import { loadJson, saveJson } from './storage'

/**
 * The CRT screen effect (scanlines, vignette, flicker) is on by default and
 * remembered per device. It is applied as a class on <html> so it can be set
 * before the first paint.
 */
export function isCrtOn(): boolean {
  return loadJson('crt') !== false
}

export function applyCrt(on: boolean): void {
  document.documentElement.classList.toggle('crt', on)
}

export function setCrt(on: boolean): void {
  saveJson('crt', on)
  applyCrt(on)
}

/**
 * "Larger text" (off by default, remembered per device): adds .big-text to <html>,
 * which sets --ts to 1.25 so every tx-N text size and the guess-tile text grow by a
 * quarter (see index.css). Applied before the first paint, like the CRT effect.
 */
// Kept in memory so the setting still holds (and matches the page) when storage is blocked.
let bigText: boolean | null = null

export function isBigText(): boolean {
  if (bigText === null) bigText = loadJson('big-text') === true
  return bigText
}

export function applyBigText(on: boolean): void {
  bigText = on
  document.documentElement.classList.toggle('big-text', on)
}

const bigTextListeners = new Set<() => void>()

/** For useSyncExternalStore: components that lay out differently with Larger text (the guess grid). */
export function subscribeBigText(listener: () => void): () => void {
  bigTextListeners.add(listener)
  return () => bigTextListeners.delete(listener)
}

export function setBigText(on: boolean): void {
  saveJson('big-text', on)
  applyBigText(on)
  bigTextListeners.forEach((l) => l())
}
