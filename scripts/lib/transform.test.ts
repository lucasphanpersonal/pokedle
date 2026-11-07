import { describe, expect, it } from 'vitest'
import {
  type ApiEvolutionNode,
  type ApiPokemon,
  type ApiPokemonForm,
  categorize,
  displayName,
  evolutionStage,
  generationNumber,
  idFromUrl,
  sortedTypes,
} from './transform.ts'

const ref = (name: string, url = '') => ({ name, url })
const en = (name: string) => [{ name, language: ref('en') }]

function mon(over: Partial<ApiPokemon> & { name: string }): ApiPokemon {
  return {
    id: 1,
    is_default: false,
    height: 10,
    weight: 100,
    types: [{ slot: 1, type: ref('fire') }],
    stats: [{ base_stat: 50, stat: ref('hp') }],
    species: ref(over.name.split('-')[0], '/api/v2/pokemon-species/1/'),
    forms: [],
    ...over,
  }
}

function form(over: Partial<ApiPokemonForm> = {}): ApiPokemonForm {
  return {
    name: '',
    form_name: '',
    is_mega: false,
    is_battle_only: false,
    version_group: ref('x-y'),
    names: [],
    form_names: [],
    ...over,
  }
}

const vulpix = mon({ name: 'vulpix', is_default: true })

describe('categorize', () => {
  it('marks default forms as base', () => {
    expect(categorize(vulpix, null, vulpix)).toBe('base')
  })
  it('detects regional forms even when types match the base', () => {
    expect(categorize(mon({ name: 'vulpix-alola' }), null, vulpix)).toBe('regional')
  })
  it('detects megas, primals and gigantamax', () => {
    expect(categorize(mon({ name: 'charizard-mega-x' }), form({ is_mega: true }), vulpix)).toBe('mega')
    expect(categorize(mon({ name: 'groudon-primal' }), null, vulpix)).toBe('mega')
    expect(categorize(mon({ name: 'pikachu-gmax' }), null, vulpix)).toBe('gmax')
  })
  it('treats totems and Pikachu caps as cosmetic, even regional totems', () => {
    expect(categorize(mon({ name: 'raticate-alola-totem' }), null, vulpix)).toBe('cosmetic')
    expect(categorize(mon({ name: 'pikachu-hoenn-cap' }), null, vulpix)).toBe('cosmetic')
  })
  it('treats same-types-same-stats variants as cosmetic', () => {
    expect(categorize(mon({ name: 'vulpix-shiny' }), null, vulpix)).toBe('cosmetic')
  })
  it('treats other battle-relevant forms as other', () => {
    const rotomWash = mon({ name: 'rotom-wash', types: [{ slot: 1, type: ref('electric') }, { slot: 2, type: ref('water') }] })
    expect(categorize(rotomWash, null, vulpix)).toBe('other')
  })
})

describe('displayName', () => {
  it('uses the species name for default forms', () => {
    expect(displayName(vulpix, form({ names: en('ignored') }), 'Vulpix')).toBe('Vulpix')
  })
  it('prefers the official form name', () => {
    expect(displayName(mon({ name: 'vulpix-alola' }), form({ names: en('Alolan Vulpix') }), 'Vulpix')).toBe('Alolan Vulpix')
  })
  it('falls back to "Species (Form)"', () => {
    expect(displayName(mon({ name: 'vulpix-x' }), form({ form_names: en('X Form') }), 'Vulpix')).toBe('Vulpix (X Form)')
    expect(displayName(mon({ name: 'vulpix-big-one' }), null, 'Vulpix')).toBe('Vulpix (Big One)')
  })
  it('uses straight apostrophes', () => {
    expect(displayName(mon({ name: 'farfetchd', is_default: true }), null, 'Farfetch\u2019d')).toBe("Farfetch'd")
  })
  it('applies overrides for colliding official names', () => {
    expect(displayName(mon({ name: 'meowstic-female-mega' }), form({ names: en('Mega Meowstic') }), 'Meowstic')).toBe(
      'Mega Meowstic (Female)',
    )
  })
})

describe('evolutionStage', () => {
  const node = (name: string, ...next: ApiEvolutionNode[]): ApiEvolutionNode => ({ species: ref(name), evolves_to: next })
  const chain = node('bulbasaur', node('ivysaur', node('venusaur')))
  it('maps chain depth to stage', () => {
    expect(evolutionStage(chain, 'bulbasaur')).toBe('Basic')
    expect(evolutionStage(chain, 'ivysaur')).toBe('Stage 1')
    expect(evolutionStage(chain, 'venusaur')).toBe('Stage 2')
  })
  it('handles branching chains', () => {
    const eevee = node('eevee', node('vaporeon'), node('sylveon'))
    expect(evolutionStage(eevee, 'sylveon')).toBe('Stage 1')
  })
  it('throws when the species is missing', () => {
    expect(() => evolutionStage(chain, 'pikachu')).toThrow()
  })
})

describe('small helpers', () => {
  it('orders types by slot and title-cases them', () => {
    const p = mon({ name: 'x', types: [{ slot: 2, type: ref('flying') }, { slot: 1, type: ref('fire') }] })
    expect(sortedTypes(p)).toEqual(['Fire', 'Flying'])
  })
  it('parses generations and ids', () => {
    expect(generationNumber('generation-ix')).toBe(9)
    expect(() => generationNumber('generation-x')).toThrow()
    expect(idFromUrl('/api/v2/pokemon/37/')).toBe(37)
  })
})
