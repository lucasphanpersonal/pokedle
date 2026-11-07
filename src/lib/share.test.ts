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
    const text = buildShareText({ mode: 'daily', puzzleNumber: 12, feedback: [miss, hit], url: 'https://x.test/' })
    expect(text).toBe(`Pokemondle #12 2 guesses\n${shareRow(miss)}\n${shareRow(hit)}\nhttps://x.test/`)
  })
  it('counts guesses past ten and labels endless games', () => {
    const many = Array.from({ length: 14 }, () => miss)
    const text = buildShareText({ mode: 'endless', puzzleNumber: null, feedback: many, url: 'u' })
    expect(text.split('\n')[0]).toBe('Pokemondle Endless 14 guesses')
  })
  it('uses the singular for a one-guess win', () => {
    expect(buildShareText({ mode: 'daily', puzzleNumber: 1, feedback: [hit], url: 'u' }).split('\n')[0]).toBe('Pokemondle #1 1 guess')
  })
  it('never reveals names', () => {
    const text = buildShareText({ mode: 'daily', puzzleNumber: 1, feedback: [hit], url: 'u' })
    expect(text).not.toContain('Static')
  })
})
