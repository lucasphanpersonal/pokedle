import { describe, expect, it } from 'vitest'
import type { GuessFeedback } from './compare'
import { buildShareText, shareRow } from './share'

const miss: GuessFeedback = {
  pokemon: 'mismatch',
  type1: 'partial',
  type2: 'mismatch',
  generation: 'higher',
  height: 'lower',
  weight: 'unknown',
  color: 'match',
  evolutionStage: 'match',
  ability: { result: 'mismatch', shared: [] },
}
const hit: GuessFeedback = {
  pokemon: 'match',
  type1: 'match',
  type2: 'match',
  generation: 'match',
  height: 'match',
  weight: 'match',
  color: 'match',
  evolutionStage: 'match',
  ability: { result: 'match', shared: ['Static'] },
}

describe('share text', () => {
  it('renders one emoji per attribute, Pokémon column excluded', () => {
    expect(shareRow(miss)).toBe('🟨🟥⬆️⬇️🟥🟩🟩🟥')
    expect(shareRow(hit)).toBe('🟩'.repeat(8))
  })
  it('builds a daily result', () => {
    const text = buildShareText({ mode: 'daily', puzzleNumber: 12, status: 'won', feedback: [miss, hit], maxGuesses: 10, url: 'https://x.test/' })
    expect(text).toBe(`Pokemondle #12 2/10\n${shareRow(miss)}\n${shareRow(hit)}\nhttps://x.test/`)
  })
  it('marks losses with X and labels endless games', () => {
    const text = buildShareText({ mode: 'endless', puzzleNumber: null, status: 'lost', feedback: [miss], maxGuesses: 10, url: 'u' })
    expect(text.split('\n')[0]).toBe('Pokemondle Endless X/10')
  })
  it('never reveals names', () => {
    const text = buildShareText({ mode: 'daily', puzzleNumber: 1, status: 'won', feedback: [hit], maxGuesses: 10, url: 'u' })
    expect(text).not.toContain('Static')
  })
})
