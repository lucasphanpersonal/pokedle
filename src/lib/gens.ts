import type { Pokemon } from '../types/pokemon'
import { loadJson, saveJson } from './storage'

/**
 * Endless mode's generation filter: the player picks which Gens the answer can
 * come from. It is a per-device preference (all nine by default). Each Endless
 * game records the Gens it was drawn from (`gens` on the save, absent = all),
 * so the screen can always say what the game on screen was picked from.
 * A Pokémon's Gen is its `generation` field, so forms count by their own debut
 * (Megas are Gen 6, Alolan forms Gen 7). The Daily never uses this.
 */
export const ALL_GENS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export const isAllGens = (gens: readonly number[]) => ALL_GENS.every((g) => gens.includes(g))

export const sameGens = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((g, i) => g === b[i])

/** A sorted, duplicate-free list of valid Gens, or null if `raw` isn't a non-empty list of them. */
export function parseGens(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  if (!raw.every((g) => ALL_GENS.includes(g))) return null
  if (new Set(raw).size !== raw.length) return null
  return [...(raw as number[])].sort((a, b) => a - b)
}

/** The Pokémon an Endless answer may be drawn from. */
export const poolForGens = (pool: readonly Pokemon[], gens: readonly number[]): Pokemon[] =>
  pool.filter((p) => gens.includes(p.generation))

/** "All Gens", "Gen 4", or "Gens 1-3, 5" (runs of three or more are joined). */
export function gensLabel(gens: readonly number[]): string {
  if (isAllGens(gens)) return 'All Gens'
  const parts: string[] = []
  for (let i = 0; i < gens.length; ) {
    let j = i
    while (j + 1 < gens.length && gens[j + 1] === gens[j] + 1) j++
    if (j - i >= 2) parts.push(`${gens[i]}-${gens[j]}`)
    else for (let k = i; k <= j; k++) parts.push(String(gens[k]))
    i = j + 1
  }
  return `${gens.length === 1 ? 'Gen' : 'Gens'} ${parts.join(', ')}`
}

const KEY = 'endless-gens'
let pref: readonly number[] | null = null

/** The saved choice. Anything unreadable (or empty) means all Gens. Stable between changes, for useSyncExternalStore. */
export function getGensPref(): readonly number[] {
  if (pref === null) pref = parseGens(loadJson(KEY)) ?? ALL_GENS
  return pref
}

const listeners = new Set<() => void>()

export function subscribeGensPref(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** Saves the choice. An empty or invalid list is ignored: at least one Gen must stay on. */
export function setGensPref(gens: readonly number[]): void {
  const next = parseGens(gens)
  if (!next || sameGens(next, getGensPref())) return
  pref = isAllGens(next) ? ALL_GENS : next
  saveJson(KEY, pref)
  listeners.forEach((l) => l())
}

/** Another tab changed the choice: forget our cached copy and re-read it. */
export function reloadGensPref(): void {
  pref = null
  listeners.forEach((l) => l())
}
