import { describe, expect, it } from 'vitest'
import { cryUrl, cryUrls } from './cry'
import type { Pokemon } from '../types/pokemon'

const base: Pokemon = {
  id: 3,
  dexNumber: 3,
  name: 'Venusaur',
  type1: 'Grass',
  type2: 'Poison',
  generation: 1,
  height: 2,
  weight: 100,
  color: 'Green',
  evolutionStage: 3,
  abilities: ['Overgrow'],
  formCategory: 'base',
}

describe('cry urls', () => {
  it('uses the Pokémon id for a base form', () => {
    expect(cryUrls(base)).toEqual([cryUrl(3)])
  })

  it('tries the form own cry first, then the species cry', () => {
    const mega = { ...base, id: 10033, formCategory: 'mega' as const, name: 'Mega Venusaur' }
    expect(cryUrls(mega)).toEqual([cryUrl(10033), cryUrl(3)])
  })

  it('points at the latest cries of the PokéAPI cries repo', () => {
    expect(cryUrl(25)).toBe('https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/25.ogg')
  })
})
