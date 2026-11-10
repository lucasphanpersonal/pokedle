import { describe, expect, it } from 'vitest'
import { POKEDEX, findGuessedByName, searchKey, searchPokemon } from './pokedex'

describe('searchKey', () => {
  it('strips accents, case and punctuation', () => {
    expect(searchKey('Flabébé')).toBe('flabebe')
    expect(searchKey('Mr. Mime')).toBe('mr mime')
    expect(searchKey("Farfetch'd")).toBe('farfetch d')
  })
})

describe('searchPokemon', () => {
  const names = (q: string) => searchPokemon(POKEDEX, q).map((p) => p.name)
  it('puts prefix matches first', () => {
    expect(names('pika')[0]).toBe('Pikachu')
  })
  it('finds forms by any word', () => {
    expect(names('alolan vul')).toContain('Alolan Vulpix')
    expect(names('vulpix')).toEqual(expect.arrayContaining(['Vulpix', 'Alolan Vulpix']))
  })
  it('ignores accents and punctuation in the query', () => {
    expect(names('flabebe')[0]).toBe('Flabébé')
    expect(names('mr. mime')[0]).toBe('Mr. Mime')
  })
  it('returns nothing for an empty query and respects the limit', () => {
    expect(names('  ')).toEqual([])
    expect(searchPokemon(POKEDEX, 'a', 5)).toHaveLength(5)
  })
})

describe('findGuessedByName', () => {
  const pikachu = POKEDEX.find((p) => p.name === 'Pikachu')!
  const mime = POKEDEX.find((p) => p.name === 'Mr. Mime')!
  it('finds an already-guessed Pokémon typed in full', () => {
    expect(findGuessedByName(POKEDEX, [pikachu.id], 'pikachu')?.id).toBe(pikachu.id)
    expect(findGuessedByName(POKEDEX, [mime.id], 'mr mime')?.id).toBe(mime.id)
  })
  it('ignores partial names and Pokémon not yet guessed', () => {
    expect(findGuessedByName(POKEDEX, [pikachu.id], 'pika')).toBeUndefined()
    expect(findGuessedByName(POKEDEX, [], 'pikachu')).toBeUndefined()
    expect(findGuessedByName(POKEDEX, [pikachu.id], '  ')).toBeUndefined()
  })
})
