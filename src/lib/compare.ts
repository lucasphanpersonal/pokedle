import type { FormCategory, Pokemon } from '../types/pokemon'

/** Feedback for text attributes (types, colour). */
export type MatchFeedback = 'match' | 'partial' | 'mismatch'

/**
 * Feedback for number attributes. 'higher' means the answer's value is higher
 * than the guess (show an up arrow); 'lower' means it is lower. 'unknown'
 * means one side has no official value, so no direction can be given.
 */
export type NumberFeedback = 'match' | 'higher' | 'lower' | 'unknown'

export interface GuessFeedback {
  pokemon: 'match' | 'mismatch'
  type1: MatchFeedback
  type2: MatchFeedback
  generation: NumberFeedback
  height: NumberFeedback
  weight: NumberFeedback
  color: 'match' | 'mismatch'
  evolutionStage: NumberFeedback
  form: 'match' | 'mismatch'
  eggGroup: MatchFeedback
  ability: AbilityFeedback
}

/** Shared Ability: 'match' with the shared names (all of them), or 'mismatch' with none. */
export interface AbilityFeedback {
  result: 'match' | 'mismatch'
  shared: string[]
}

export type FeedbackKey = keyof GuessFeedback

/**
 * Compares numbers at one decimal place, which is the precision of the data
 * (heights in 0.1 m, weights in 0.1 kg). Avoids float noise like 0.1 + 0.2.
 */
export function compareNumber(guess: number, target: number): NumberFeedback {
  const g = Math.round(guess * 10)
  const t = Math.round(target * 10)
  if (g === t) return 'match'
  return t > g ? 'higher' : 'lower'
}

/**
 * Type 1: green if it matches the answer's Type 1, yellow if it matches the
 * answer's Type 2 instead, red otherwise.
 * Type 2: green if it matches the answer's Type 2 (two single-type Pokémon
 * both match on "none"), yellow if it matches the answer's Type 1 instead,
 * red otherwise.
 */
export function compareTypes(guess: Pokemon, target: Pokemon): Pick<GuessFeedback, 'type1' | 'type2'> {
  const type1: MatchFeedback =
    guess.type1 === target.type1 ? 'match' : guess.type1 === target.type2 ? 'partial' : 'mismatch'
  const type2: MatchFeedback =
    guess.type2 === target.type2
      ? 'match'
      : guess.type2 !== null && guess.type2 === target.type1
        ? 'partial'
        : 'mismatch'
  return { type1, type2 }
}

/**
 * Weight 0 means "no official weight" (Eternamax Eternatus shows "???" in the
 * games). Comparing against it would give a misleading arrow.
 */
export function compareWeight(guess: number, target: number): NumberFeedback {
  if (guess <= 0 || target <= 0) return guess === target ? 'match' : 'unknown'
  return compareNumber(guess, target)
}

/** Abilities both Pokémon can have (hidden ones included), in the guess's order. */
export function compareAbilities(guess: Pokemon, target: Pokemon): AbilityFeedback {
  // The exact answer is always a full match, even if it has no ability data.
  if (guess.id === target.id) return { result: 'match', shared: [...guess.abilities] }
  const theirs = new Set(target.abilities)
  const shared = [...new Set(guess.abilities)].filter((a) => theirs.has(a))
  return { result: shared.length > 0 ? 'match' : 'mismatch', shared }
}

/**
 * What the Shared Ability cell shows. On a match: the shared names. On no
 * match: all of the guess's own abilities, so the player can see none of
 * them are the answer's. "Unknown" only shows for a Pokémon with no ability data at all
 * (the data script now gives new forms their base species' abilities, so none are left).
 */
export function abilityCellText(guess: Pokemon, feedback: AbilityFeedback): string {
  if (feedback.result === 'match') return feedback.shared.length > 0 ? feedback.shared.join(', ') : 'Unknown'
  return guess.abilities.length > 0 ? guess.abilities.join(', ') : 'Unknown'
}

/**
 * Egg Group: green if both have exactly the same groups, yellow if they share at
 * least one (e.g. Monster + Dragon vs. Dragon alone), red if none.
 */
export function compareEggGroups(guess: Pokemon, target: Pokemon): MatchFeedback {
  const ours = new Set(guess.eggGroups)
  const theirs = new Set(target.eggGroups)
  const shared = [...ours].filter((g) => theirs.has(g)).length
  if (shared === 0) return 'mismatch'
  return shared === ours.size && shared === theirs.size ? 'match' : 'partial'
}

/** Form: green if both are the same kind of form (Base, Mega, Regional, ...), red otherwise. */
export function compareForm(guess: Pokemon, target: Pokemon): 'match' | 'mismatch' {
  return guess.formCategory === target.formCategory ? 'match' : 'mismatch'
}

const FORM_LABEL: Record<FormCategory, string> = {
  base: 'Base',
  regional: 'Regional',
  mega: 'Mega',
  gmax: 'Gigantamax',
  cosmetic: 'Cosmetic',
  other: 'Other',
}

/** What the Form cell shows: the guess's own form category. */
export function formCellText(guess: Pokemon): string {
  return FORM_LABEL[guess.formCategory]
}

export function compareGuess(guess: Pokemon, target: Pokemon): GuessFeedback {
  return {
    pokemon: guess.id === target.id ? 'match' : 'mismatch',
    ...compareTypes(guess, target),
    generation: compareNumber(guess.generation, target.generation),
    height: compareNumber(guess.height, target.height),
    weight: compareWeight(guess.weight, target.weight),
    color: guess.color === target.color ? 'match' : 'mismatch',
    evolutionStage: compareNumber(guess.evolutionStage, target.evolutionStage),
    form: compareForm(guess, target),
    eggGroup: compareEggGroups(guess, target),
    ability: compareAbilities(guess, target),
  }
}
