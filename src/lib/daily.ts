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

const dayNumber = (key: string) => {
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

/** Index of the day's answer in a pool of `poolSize` Pokémon. */
export function dailyIndex(dateKey: string, poolSize: number): number {
  if (poolSize <= 0) throw new Error('Answer pool is empty')
  const rng = mulberry32(hashString(`pokemondle:${dateKey}`))
  return Math.floor(rng() * poolSize)
}
