/**
 * localStorage wrapper that never throws: storage can be unavailable in
 * private browsing, blocked by settings, or full.
 */
const PREFIX = 'pokemondle:'

export function loadJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Progress just won't persist; the game still works.
  }
}
