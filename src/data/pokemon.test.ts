import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../types/pokemon'
import raw from './pokemon.json'

const data = raw as Pokemon[]
const TYPES = new Set([
  'Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
])

describe('pokemon.json', () => {
  it('covers all 1025 species', () => {
    expect(new Set(data.map((p) => p.dexNumber)).size).toBe(1025)
    expect(data.filter((p) => p.formCategory === 'base')).toHaveLength(1025)
  })
  it('has unique ids and display names', () => {
    expect(new Set(data.map((p) => p.id)).size).toBe(data.length)
    expect(new Set(data.map((p) => p.name.toLowerCase())).size).toBe(data.length)
  })
  it('has valid attribute values', () => {
    for (const p of data) {
      expect(TYPES.has(p.type1), `${p.name} type1`).toBe(true)
      if (p.type2 !== null) {
        expect(TYPES.has(p.type2), `${p.name} type2`).toBe(true)
        expect(p.type2).not.toBe(p.type1)
      }
      expect(p.generation).toBeGreaterThanOrEqual(1)
      expect(p.generation).toBeLessThanOrEqual(9)
      expect(p.height).toBeGreaterThan(0)
      // Eternamax Eternatus has no official weight ("???" in-game), stored as 0.
      if (p.name !== 'Eternamax Eternatus') expect(p.weight, `${p.name} weight`).toBeGreaterThan(0)
      expect([1, 2, 3]).toContain(p.evolutionStage)
    }
  })
  it('lists egg groups as display names, shared by a species and its forms', () => {
    const allowed = new Set(['Monster', 'Water 1', 'Bug', 'Flying', 'Ground', 'Fairy', 'Plant', 'Human-Like', 'Water 3', 'Mineral', 'Amorphous', 'Water 2', 'Ditto', 'Dragon', 'Undiscovered'])
    for (const p of data) {
      expect(p.eggGroups.length, `${p.name} egg groups`).toBeGreaterThanOrEqual(1)
      expect(p.eggGroups.length, `${p.name} egg groups`).toBeLessThanOrEqual(2)
      expect(new Set(p.eggGroups).size).toBe(p.eggGroups.length)
      for (const g of p.eggGroups) expect(allowed.has(g), `${p.name}: ${g}`).toBe(true)
    }
    const eggs = (name: string) => data.find((p) => p.name === name)?.eggGroups
    expect(eggs('Charizard')).toEqual(['Monster', 'Dragon'])
    expect(eggs('Mega Charizard X')).toEqual(['Monster', 'Dragon'])
    expect(eggs('Mewtwo')).toEqual(['Undiscovered'])
    expect(eggs('Ditto')).toEqual(['Ditto'])
  })
  it('lists abilities as display names', () => {
    for (const p of data) {
      expect(new Set(p.abilities).size).toBe(p.abilities.length)
      for (const a of p.abilities) expect(a, `${p.name} ability`).toMatch(/^[A-Z0-9]/)
      // Forms with no PokéAPI ability data borrow their base species' abilities in the data script.
      expect(p.abilities.length, `${p.name} abilities`).toBeGreaterThan(0)
    }
    const abilities = (name: string) => data.find((p) => p.name === name)?.abilities
    expect(abilities('Charizard')).toEqual(['Blaze', 'Solar Power'])
    expect(abilities('Greninja')).toEqual(['Torrent', 'Protean'])
    expect(abilities('Mega Stretchy Tatsugiri')).toEqual(['Commander', 'Storm Drain'])
    expect(abilities('Mega Charizard X')).toEqual(['Tough Claws'])
  })
  it('numbers stages by position in the line, babies included', () => {
    const stage = (name: string) => data.find((p) => p.name === name)?.evolutionStage
    expect([stage('Pichu'), stage('Pikachu'), stage('Raichu')]).toEqual([1, 2, 3])
    expect([stage('Munchlax'), stage('Snorlax')]).toEqual([1, 2])
    expect([stage('Mime Jr.'), stage('Mr. Mime'), stage('Mr. Rime')]).toEqual([1, 2, 3])
  })
  it('matches known reference entries', () => {
    const find = (name: string) => data.find((p) => p.name === name)
    expect(find('Charizard')).toMatchObject({ generation: 1, evolutionStage: 3, type1: 'Fire', type2: 'Flying' })
    expect(find('Alolan Vulpix')).toMatchObject({ generation: 7, type1: 'Ice', formCategory: 'regional' })
    expect(find('Mega Charizard X')).toMatchObject({ generation: 6, type2: 'Dragon', formCategory: 'mega' })
  })
})
