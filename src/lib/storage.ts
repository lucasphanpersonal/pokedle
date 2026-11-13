/**
 * localStorage wrapper that never throws: storage can be unavailable in
 * private browsing, blocked by settings, or full.
 */
const PREFIX = 'pokemondle:'

/** The full localStorage key for one of our entries. */
export const storageKey = (key: string) => PREFIX + key

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

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key)
  } catch {
    // Nothing to tidy up.
  }
}
