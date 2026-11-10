import { describe, expect, it } from 'vitest'
import { cryGain, cryUrl, cryUrls } from './cry'
import { MAX_VOLUME, volumeGain } from './sound'
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
  eggGroups: ['Monster', 'Plant'],
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

describe('cry volume', () => {
  it('is silent when muted and half the bars gain when full', () => {
    expect(cryGain(0)).toBe(0)
    expect(cryGain(MAX_VOLUME)).toBe(volumeGain(MAX_VOLUME) / 2)
  })

  it('rises with each volume bar, always below the blips at the same level', () => {
    for (let i = 1; i <= MAX_VOLUME; i++) {
      expect(cryGain(i)).toBeGreaterThan(cryGain(i - 1))
      expect(cryGain(i)).toBeLessThan(volumeGain(i))
    }
  })
})
