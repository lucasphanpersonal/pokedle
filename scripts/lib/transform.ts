/**
 * Pure helpers used by fetchPokemonData.ts. Kept free of network code so
 * they can be unit-tested.
 */
import type { EvolutionStage, FormCategory } from '../../src/types/pokemon.ts'

export interface NamedRef {
  name: string
  url: string
}

export interface ApiName {
  name: string
  language: NamedRef
}

export interface ApiStat {
  base_stat: number
  stat: NamedRef
}

export interface ApiPokemon {
  id: number
  name: string
  is_default: boolean
  height: number // decimetres
  weight: number // hectograms
  types: { slot: number; type: NamedRef }[]
  stats: ApiStat[]
  abilities: { slot: number; is_hidden: boolean; ability: NamedRef }[]
  species: NamedRef
  forms: NamedRef[]
}

export interface ApiPokemonForm {
  name: string
  form_name: string
  is_mega: boolean
  is_battle_only: boolean
  version_group: NamedRef
  names: ApiName[]
  form_names: ApiName[]
}

export interface ApiEvolutionNode {
  species: NamedRef
  evolves_to: ApiEvolutionNode[]
}

const REGIONAL_TAGS = ['alola', 'galar', 'hisui', 'paldea']

/** Names of cosmetic variants that differ from their base only in looks. */
const COSMETIC_PATTERNS = [/-totem\b/, /-power-construct$/, /^pikachu-.*-cap$/, /^pikachu-(rock-star|belle|pop-star|phd|libre|cosplay|starter|world-cap)$/]

/**
 * Hand-picked names for entries whose official English names collide.
 * Keyed by PokéAPI pokemon slug.
 */
const NAME_OVERRIDES: Record<string, string> = {
  'darmanitan-galar-standard': 'Galarian Darmanitan',
  'darmanitan-galar-zen': 'Galarian Darmanitan (Zen Mode)',
  'meowstic-male-mega': 'Mega Meowstic (Male)',
  'meowstic-female-mega': 'Mega Meowstic (Female)',
  'zygarde-10-power-construct': '10% Zygarde (Power Construct)',
  'zygarde-50-power-construct': '50% Zygarde (Power Construct)',
}

export function englishName(names: ApiName[] | undefined): string | null {
  return names?.find((n) => n.language.name === 'en')?.name ?? null
}

/** "vulpix-alola" -> "Vulpix Alola" (fallback when the API has no English name). */
export function titleCase(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

export function sortedTypes(p: ApiPokemon): [string, string | null] {
  const types = [...p.types].sort((a, b) => a.slot - b.slot).map((t) => titleCase(t.type.name))
  return [types[0], types[1] ?? null]
}

/** Minimal shape of /ability/{id}, just enough to get the English name. */
export interface ApiAbility {
  name: string
  names: ApiName[]
}

/** Ability slugs in slot order (regular abilities, then hidden), without repeats. */
export function abilitySlugs(p: ApiPokemon): NamedRef[] {
  const seen = new Set<string>()
  return [...p.abilities]
    .sort((a, b) => a.slot - b.slot)
    .map((a) => a.ability)
    .filter((a) => !seen.has(a.name) && seen.add(a.name))
}

function statLine(p: ApiPokemon): string {
  return p.stats.map((s) => `${s.stat.name}:${s.base_stat}`).sort().join(',')
}

/**
 * Same types and same base stats as the species' default form: guessing it
 * tells the player nothing the base form wouldn't.
 */
export function isCosmeticVariant(p: ApiPokemon, base: ApiPokemon): boolean {
  if (COSMETIC_PATTERNS.some((re) => re.test(p.name))) return true
  const [a1, a2] = sortedTypes(p)
  const [b1, b2] = sortedTypes(base)
  return a1 === b1 && a2 === b2 && statLine(p) === statLine(base)
}

export function categorize(p: ApiPokemon, form: ApiPokemonForm | null, base: ApiPokemon): FormCategory {
  if (p.is_default) return 'base'
  const parts = p.name.split('-')
  if (parts.includes('gmax')) return 'gmax'
  if (form?.is_mega || parts.includes('mega') || parts.includes('primal')) return 'mega'
  if (COSMETIC_PATTERNS.some((re) => re.test(p.name))) return 'cosmetic'
  if (parts.some((part) => REGIONAL_TAGS.includes(part))) return 'regional'
  if (isCosmeticVariant(p, base)) return 'cosmetic'
  return 'other'
}

/**
 * Display name. Default forms use the species name ("Vulpix"). Other forms use
 * the official English form name when PokéAPI has one ("Alolan Vulpix",
 * "Mega Charizard X"), otherwise "Species (Form)".
 */
export function displayName(
  p: ApiPokemon,
  form: ApiPokemonForm | null,
  speciesName: string,
): string {
  // Straight apostrophes so typed guesses like "Farfetch'd" match.
  return rawDisplayName(p, form, speciesName).replaceAll('\u2019', "'")
}

function rawDisplayName(
  p: ApiPokemon,
  form: ApiPokemonForm | null,
  speciesName: string,
): string {
  if (p.is_default) return speciesName
  if (NAME_OVERRIDES[p.name]) return NAME_OVERRIDES[p.name]
  const official = englishName(form?.names)
  if (official) return official
  const formLabel = englishName(form?.form_names)
  if (formLabel) return `${speciesName} (${formLabel})`
  const suffix = p.name.startsWith(`${p.species.name}-`) ? p.name.slice(p.species.name.length + 1) : p.name
  return `${speciesName} (${titleCase(suffix)})`
}

/**
 * Evolution stage: position in the family's line, counted from 1. Baby
 * Pokémon count like any other stage, so Pichu = 1, Pikachu = 2, Raichu = 3.
 */
export function evolutionStage(chain: ApiEvolutionNode, speciesName: string): EvolutionStage {
  const walk = (node: ApiEvolutionNode, stage: number): number | null => {
    if (node.species.name === speciesName) return stage
    for (const next of node.evolves_to) {
      const found = walk(next, stage + 1)
      if (found !== null) return found
    }
    return null
  }
  const stage = walk(chain, 1)
  if (stage === null) throw new Error(`${speciesName} not found in its evolution chain`)
  return Math.min(stage, 3) as EvolutionStage
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }

/** "generation-vii" -> 7 */
export function generationNumber(name: string): number {
  const n = ROMAN[name.replace('generation-', '')]
  if (!n) throw new Error(`Unknown generation: ${name}`)
  return n
}

/** Trailing numeric id from a PokéAPI resource URL ("/api/v2/pokemon/37/" -> 37). */
export function idFromUrl(url: string): number {
  const m = url.match(/\/(\d+)\/?$/)
  if (!m) throw new Error(`No id in URL: ${url}`)
  return Number(m[1])
}
