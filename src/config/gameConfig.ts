import type { FormCategory } from '../types/pokemon'

/**
 * Which kinds of Pokémon can appear as answers and guesses.
 * Set a category to `false` to remove it from the game, e.g. `cosmetic: false`
 * if near-duplicate forms turn out to be too frustrating.
 */
export const ENABLED_FORM_CATEGORIES: Record<FormCategory, boolean> = {
  base: true,
  regional: true,
  mega: true,
  gmax: true,
  cosmetic: true,
  other: true,
}

/** Maximum guesses before the game is lost. */
export const MAX_GUESSES = 10

/** Column headers for the guess grid, in display order. */
export const GRID_COLUMNS = [
  'Pokémon',
  'Type 1',
  'Type 2',
  'Gen',
  'Height',
  'Weight',
  'Color',
  'Evolution',
] as const
