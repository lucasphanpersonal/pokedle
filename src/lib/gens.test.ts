import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Pokemon } from '../types/pokemon'
import { ALL_GENS, gensLabel, getGensPref, isAllGens, parseGens, poolForGens, reloadGensPref, setGensPref } from './gens'

describe('parseGens', () => {
  it('sorts a valid list', () => {
    expect(parseGens([3, 1, 9])).toEqual([1, 3, 9])
  })
  it('rejects empty, duplicate, out-of-range and non-list values', () => {
    for (const bad of [[], [1, 1], [0], [10], [1.5], ['1'], null, 'all', { 0: 1 }]) expect(parseGens(bad)).toBeNull()
  })
})

describe('gensLabel', () => {
  it('names the selection compactly', () => {
    expect(gensLabel(ALL_GENS)).toBe('All Gens')
    expect(gensLabel([4])).toBe('Gen 4')
    expect(gensLabel([1, 2])).toBe('Gens 1, 2')
    expect(gensLabel([1, 2, 3, 5])).toBe('Gens 1-3, 5')
    expect(gensLabel([1, 3, 5, 7, 9])).toBe('Gens 1, 3, 5, 7, 9')
    expect(gensLabel([2, 3, 4, 5, 6, 7, 8, 9])).toBe('Gens 2-9')
  })
})

describe('poolForGens', () => {
  it('keeps only Pokémon from the chosen Gens, by their own generation field', () => {
    const pool = [
      { id: 3, generation: 1 },
      { id: 10033, generation: 6 }, // Mega Venusaur counts as Gen 6
      { id: 152, generation: 2 },
    ] as Pokemon[]
    expect(poolForGens(pool, [1, 6]).map((p) => p.id)).toEqual([3, 10033])
    expect(poolForGens(pool, ALL_GENS)).toHaveLength(3)
  })
})

describe('Gens preference', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stubStorage = () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    })
    reloadGensPref()
    return store
  }

  it('defaults to all Gens, saves a choice and never accepts none', () => {
    const store = stubStorage()
    expect(isAllGens(getGensPref())).toBe(true)
    setGensPref([4, 1])
    expect(getGensPref()).toEqual([1, 4])
    expect(store.get('pokemondle:endless-gens')).toBe('[1,4]')
    setGensPref([])
    expect(getGensPref()).toEqual([1, 4])
  })

  it('falls back to all Gens when the saved value is unreadable', () => {
    const store = stubStorage()
    store.set('pokemondle:endless-gens', '[0,12]')
    reloadGensPref()
    expect(getGensPref()).toBe(ALL_GENS)
  })

  it('keeps the same list object between changes', () => {
    stubStorage()
    setGensPref([2])
    expect(getGensPref()).toBe(getGensPref())
  })
})
