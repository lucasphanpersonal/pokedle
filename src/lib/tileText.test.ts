import { describe, expect, it } from 'vitest'
import { breakable, lineChars, longestPiece, longestWord } from './tileText'

describe('tile text helpers', () => {
  it('finds the longest word across parts, ignoring soft hyphens', () => {
    expect(longestWord('Monster, Dragon')).toBe(8) // "Monster,": the comma is drawn on the same line
    expect(longestWord('Gen', 9)).toBe(3)
    expect(longestWord(breakable('Undiscovered'))).toBe(12)
  })

  it('measures the unsplittable pieces, counting the hyphen drawn at a break', () => {
    expect(longestPiece('Undiscovered')).toBe(7) // "Undis-" (6), "covered" (7)
    expect(longestPiece('Human-Like')).toBe(6) // "Human-"
    expect(longestPiece('Fire')).toBe(4)
  })

  it('adds a soft hyphen only to known long words', () => {
    expect(breakable('Undiscovered')).toBe('Undis\u00ADcovered')
    expect(breakable('Fire')).toBe('Fire')
    expect(breakable('Human-Like, Electric')).toBe('Human-Like, Elec\u00ADtric')
  })

  it('finds the narrowest line that keeps a name within a number of lines', () => {
    expect(lineChars('Pikachu', 3)).toBe(7)
    expect(lineChars('Gigantamax Venusaur', 3)).toBe(10)
    expect(lineChars('Gigantamax Single Strike Urshifu', 3)).toBe(13) // "Gigantamax" / "Single Strike" / "Urshifu"
    expect(lineChars('Paldean Tauros (Combat Breed)', 3)).toBe(14) // "Paldean Tauros" / "(Combat" / "Breed)"
    expect(lineChars('Mega Charizard X', 1)).toBe(16)
  })
})

describe('abilityColumnFit', () => {
  it('uses the most demanding row for the whole column, never less than any one row', async () => {
    const { POKEDEX } = await import('./pokedex')
    const { compareGuess } = await import('./compare')
    const { abilityColumnFit, abilityFit } = await import('./tileText')
    const { abilityCellText } = await import('./compare')
    const target = POKEDEX.find((p) => p.name === 'Dusknoir')!
    const guesses = ['Bulbasaur', 'Nidorina', 'Hydrapple'].map((n) => POKEDEX.find((p) => p.name === n)!)
    const feedback = guesses.map((g) => compareGuess(g, target))
    const col = abilityColumnFit(guesses, feedback)
    for (const [i, g] of guesses.entries()) {
      const own = abilityFit(abilityCellText(g, feedback[i].ability))
      expect(col.chars).toBeGreaterThanOrEqual(own.chars)
      expect(col.piece).toBeGreaterThanOrEqual(own.piece)
    }
    expect(abilityColumnFit([], [])).toEqual({ chars: 1, piece: 1 })
  })
})
