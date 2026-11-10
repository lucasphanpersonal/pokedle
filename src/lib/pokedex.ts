import { ENABLED_FORM_CATEGORIES } from '../config/gameConfig'
import rawPokemon from '../data/pokemon.json'
import type { Pokemon } from '../types/pokemon'

const allPokemon = rawPokemon as Pokemon[]

/** Every Pokémon allowed in the game, after applying the form filter. */
export const POKEDEX: Pokemon[] = allPokemon.filter(
  (p) => ENABLED_FORM_CATEGORIES[p.formCategory],
)

/** Lookup by PokéAPI id. */
export const POKEDEX_BY_ID: Map<number, Pokemon> = new Map(POKEDEX.map((p) => [p.id, p]))

/** Official artwork (large). */
export const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`

/** Small in-game sprite, used in the search list and the guess grid. */
export const iconUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`

/**
 * Lowercase, accent-free, punctuation-free form of a name for search, so
 * "flabebe" finds "Flabébé" and "mr mime" finds "Mr. Mime".
 */
export function searchKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
}

/** Search key for every enabled Pokémon, computed once instead of on every keystroke. */
const SEARCH_KEYS: Map<Pokemon, string> = new Map(POKEDEX.map((p) => [p, searchKey(p.name)]))

/**
 * The already-guessed Pokémon whose name is exactly the query (ignoring case, accents and punctuation), if any.
 */
export function findGuessedByName(pokedex: readonly Pokemon[], guessedIds: readonly number[], query: string): Pokemon | undefined {
  const q = searchKey(query)
  if (!q) return undefined
  const guessed = new Set(guessedIds)
  return pokedex.find((p) => guessed.has(p.id) && searchKey(p.name) === q)
}

/**
 * Pokémon whose name matches the query: names starting with it first, then
 * names with a word starting with it, then any other match. Ties keep Pokédex order.
 */
export function searchPokemon(pool: readonly Pokemon[], query: string, limit = 8): Pokemon[] {
  const q = searchKey(query)
  if (!q) return []
  const starts: Pokemon[] = []
  const wordStarts: Pokemon[] = []
  const contains: Pokemon[] = []
  for (const p of pool) {
    const key = SEARCH_KEYS.get(p) ?? searchKey(p.name)
    if (key.startsWith(q)) starts.push(p)
    else if (key.includes(` ${q}`)) wordStarts.push(p)
    else if (key.includes(q)) contains.push(p)
  }
  return [...starts, ...wordStarts, ...contains].slice(0, limit)
}
