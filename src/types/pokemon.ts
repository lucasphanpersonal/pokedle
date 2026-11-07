/**
 * How a Pokémon entry relates to its species. Lets us switch whole groups of
 * forms on or off in `src/config/gameConfig.ts` without regenerating data.
 */
export type FormCategory =
  | 'base' // the default form of a species
  | 'regional' // Alolan, Galarian, Hisuian, Paldean
  | 'mega' // Mega Evolutions and Primal Reversions
  | 'gmax' // Gigantamax
  | 'cosmetic' // same types and stats as the base form (Pikachu caps, Totems, ...)
  | 'other' // any other battle-relevant alternate form (Rotom, Deoxys, ...)

/** Position in the evolution line: 1 = first, 2 = second, 3 = third. Babies count (Pichu 1, Pikachu 2). */
export type EvolutionStage = 1 | 2 | 3

export interface Pokemon {
  /** Unique PokéAPI pokemon id (matches the sprite URL). */
  id: number
  /** National Dex number of the species. Equal to `id` for base forms. */
  dexNumber: number
  /** Display name, e.g. "Vulpix (Alola)". */
  name: string
  type1: string
  type2: string | null
  /** Generation the entry debuted in (1 to 9). Forms use their own debut. */
  generation: number
  /** Height in metres. */
  height: number
  /** Weight in kilograms. */
  weight: number
  color: string
  evolutionStage: EvolutionStage
  /** Every ability, hidden ones included, display-formatted ("Speed Boost"). Forms can differ from their base. */
  abilities: string[]
  formCategory: FormCategory
}
