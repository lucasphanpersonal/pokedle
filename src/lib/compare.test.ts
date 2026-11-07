import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../types/pokemon'
import { compareGuess, compareNumber, compareTypes } from './compare'

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
  it('handles the zero weight of Eternamax Eternatus', () => {
    expect(compareNumber(0, 950)).toBe('higher')
    expect(compareNumber(950, 0)).toBe('lower')
  })
})

describe('compareGuess', () => {
  it('compares every attribute', () => {
    const target = mon({ id: 2, generation: 3, height: 2, weight: 5, color: 'Blue', evolutionStage: 2 })
    expect(compareGuess(mon({}), target)).toEqual({
      pokemon: 'mismatch',
      type1: 'match',
      type2: 'match',
      generation: 'higher',
      height: 'higher',
      weight: 'lower',
      color: 'mismatch',
      evolutionStage: 'higher',
    })
  })
  it('matches the answer itself on every attribute', () => {
    const p = mon({ type2: 'Flying' })
    expect(Object.values(compareGuess(p, p)).every((v) => v === 'match')).toBe(true)
  })
})
