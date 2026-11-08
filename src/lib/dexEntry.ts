/**
 * Pokédex entry (category and flavor text) for the result screen. Fetched from
 * PokéAPI only when a game is won, so the dataset and the game itself stay light.
 */

export interface DexEntry {
  /** Category, e.g. "Mouse Pokémon". */
  category: string
  /** English flavor text, whitespace cleaned. */
  text: string
}

interface SpeciesResponse {
  genera?: { genus: string; language: { name: string } }[]
  flavor_text_entries?: { flavor_text: string; language: { name: string } }[]
}

const SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species/'
const cache = new Map<number, DexEntry>()

/** "#025": National Dex number padded to at least three digits. */
export function formatDex(dexNumber: number): string {
  return `#${String(dexNumber).padStart(3, '0')}`
}

/** PokéAPI flavor text has hard line breaks, form feeds and soft hyphens baked in. */
export function cleanFlavorText(raw: string): string {
  return raw
    .replace(/­\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Picks the English category and the newest English flavor text; null if neither exists. */
export function parseEntry(data: SpeciesResponse): DexEntry | null {
  const genus = data.genera?.find((g) => g.language.name === 'en')?.genus ?? ''
  const english = (data.flavor_text_entries ?? []).filter((f) => f.language.name === 'en')
  const text = english.length ? cleanFlavorText(english[english.length - 1].flavor_text) : ''
  if (!genus && !text) return null
  return { category: genus, text }
}

/** Loads the entry for a species. Throws if the network or PokéAPI fails; results are cached. */
export async function fetchDexEntry(dexNumber: number, signal?: AbortSignal): Promise<DexEntry> {
  const hit = cache.get(dexNumber)
  if (hit) return hit
  const res = await fetch(`${SPECIES_URL}${dexNumber}/`, { signal })
  if (!res.ok) throw new Error(`PokéAPI ${res.status}`)
  const entry = parseEntry((await res.json()) as SpeciesResponse)
  if (!entry) throw new Error('No English entry')
  cache.set(dexNumber, entry)
  return entry
}
