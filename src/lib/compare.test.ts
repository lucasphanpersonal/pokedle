import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../types/pokemon'
import { compareAbilities, compareGuess, compareNumber, compareTypes, compareWeight } from './compare'

const mon = (over: Partial<Pokemon>): Pokemon => ({
  id: 1,
  dexNumber: 1,
  name: 'Test',
  type1: 'Fire',
  type2: null,
  generation: 1,
  height: 1,
  weight: 10,
  color: 'Red',
  evolutionStage: 1,
  abilities: [],
  formCategory: 'base',
  ...over,
})

describe('compareTypes', () => {
  const target = mon({ type1: 'Water', type2: 'Fire' })
  it('marks same-slot types as match', () => {
    expect(compareTypes(mon({ type1: 'Water', type2: 'Fire' }), target)).toEqual({ type1: 'match', type2: 'match' })
  })
  it('marks swapped types as partial', () => {
    expect(compareTypes(mon({ type1: 'Fire', type2: 'Water' }), target)).toEqual({ type1: 'partial', type2: 'partial' })
  })
  it('marks absent types as mismatch', () => {
    expect(compareTypes(mon({ type1: 'Grass', type2: 'Rock' }), target)).toEqual({ type1: 'mismatch', type2: 'mismatch' })
  })
  it('treats two missing Type 2s as a match', () => {
    expect(compareTypes(mon({ type1: 'Fire' }), mon({ type1: 'Fire' })).type2).toBe('match')
  })
  it('does not count a missing Type 2 as partial', () => {
    expect(compareTypes(mon({ type1: 'Fire', type2: null }), mon({ type1: 'Water', type2: 'Fire' }))).toEqual({
      type1: 'partial',
      type2: 'mismatch',
    })
  })
  it('marks a guess with Type 2 against a single-type answer as mismatch', () => {
    expect(compareTypes(mon({ type1: 'Water', type2: 'Fire' }), mon({ type1: 'Water' })).type2).toBe('mismatch')
  })
})

describe('compareNumber', () => {
  it('says which way the answer lies', () => {
    expect(compareNumber(1, 3)).toBe('higher')
    expect(compareNumber(3, 1)).toBe('lower')
    expect(compareNumber(2, 2)).toBe('match')
  })
  it('ignores floating point noise', () => {
    expect(compareNumber(0.1 + 0.2, 0.3)).toBe('match')
  })
})

describe('compareWeight', () => {
  it('gives no direction when a weight is unknown (Eternamax Eternatus)', () => {
    expect(compareWeight(0, 950)).toBe('unknown')
    expect(compareWeight(950, 0)).toBe('unknown')
    expect(compareWeight(0, 0)).toBe('match')
  })
  it('compares known weights normally', () => {
    expect(compareWeight(6, 7.2)).toBe('higher')
  })
})

describe('compareGuess', () => {
  it('compares every attribute', () => {
    const target = mon({ id: 2, generation: 3, height: 2, weight: 5, color: 'Blue', evolutionStage: 2, abilities: ['Blaze'] })
    expect(compareGuess(mon({ abilities: ['Blaze', 'Intimidate'] }), target)).toEqual({
      pokemon: 'mismatch',
      type1: 'match',
      type2: 'match',
      generation: 'higher',
      height: 'higher',
      weight: 'lower',
      color: 'mismatch',
      evolutionStage: 'higher',
      ability: { result: 'match', shared: ['Blaze'] },
    })
  })
  it('matches the answer itself on every attribute', () => {
    const p = mon({ type2: 'Flying', abilities: ['Blaze'] })
    expect(Object.values(compareGuess(p, p)).every((v) => (typeof v === 'string' ? v === 'match' : v.result === 'match'))).toBe(true)
  })
})

describe('compareAbilities', () => {
  const target = mon({ abilities: ['Blaze', 'Solar Power'] })
  it('matches and lists every shared ability, hidden ones included', () => {
    expect(compareAbilities(mon({ abilities: ['Solar Power', 'Blaze', 'Torrent'] }), target)).toEqual({
      result: 'match',
      shared: ['Solar Power', 'Blaze'],
    })
  })
  it('matches on a single shared ability', () => {
    expect(compareAbilities(mon({ abilities: ['Overgrow', 'Solar Power'] }), target)).toEqual({
      result: 'match',
      shared: ['Solar Power'],
    })
  })
  it('is a mismatch with nothing shared', () => {
    expect(compareAbilities(mon({ abilities: ['Torrent'] }), target)).toEqual({ result: 'mismatch', shared: [] })
  })
  it('is a mismatch when either side has no abilities', () => {
    expect(compareAbilities(mon({}), target).result).toBe('mismatch')
    expect(compareAbilities(target, mon({})).result).toBe('mismatch')
  })
  it('is included in compareGuess', () => {
    expect(compareGuess(mon({ abilities: ['Blaze'] }), target).ability).toEqual({ result: 'match', shared: ['Blaze'] })
  })
})
