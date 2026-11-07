import { ENABLED_FORM_CATEGORIES } from '../config/gameConfig'
import rawPokemon from '../data/pokemon.json'
import type { Pokemon } from '../types/pokemon'

const allPokemon = rawPokemon as Pokemon[]

/** Every Pokémon allowed in the game, after applying the form filter. */
export const POKEDEX: Pokemon[] = allPokemon.filter(
  (p) => ENABLED_FORM_CATEGORIES[p.formCategory],
)

export const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`
