/**
 * Date-seeded puzzle selection. Everyone who plays on the same calendar day
 * (in their own time zone) gets the same answer.
 */

/** First daily puzzle. Puzzle numbers count up from here. */
export const LAUNCH_DATE_KEY = '2026-11-07'

/** "YYYY-MM-DD" for the given moment in the player's local time zone. */
export function localDateKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Puzzle #1 is the launch day. */
export function puzzleNumber(dateKey: string): number {
  return dayNumber(dateKey) - dayNumber(LAUNCH_DATE_KEY) + 1
}

/** 32-bit FNV-1a hash of a string. */
export function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32: small, fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The day's answer, chosen by rendezvous hashing: every candidate gets a score
 * from hash(date + id) and the highest score wins. Unlike "index into the
 * list", this doesn't depend on list order or size, so regenerating the data
 * or toggling a form category only changes a day's answer if that day's
 * winner itself was removed (or a newly added Pokémon outscores it).
 */
export function dailyPick<T extends { id: number }>(dateKey: string, pool: readonly T[]): T {
  if (pool.length === 0) throw new Error('Answer pool is empty')
  let best = pool[0]
  let bestScore = -1
  for (const p of pool) {
    const score = mulberry32(hashString(`pokemondle:${dateKey}:${p.id}`))()
    if (score > bestScore || (score === bestScore && p.id < best.id)) {
      best = p
      bestScore = score
    }
  }
  return best
}
