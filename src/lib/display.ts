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
