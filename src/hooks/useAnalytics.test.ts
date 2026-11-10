import { describe, expect, it } from 'vitest'
import { finishedTransition, type SeenGame } from './useAnalytics'

const playing: SeenGame = { id: 'daily:2026-11-08', status: 'playing' }

describe('finishedTransition', () => {
  it('ignores a game that is already won on first mount', () => {
    expect(finishedTransition(null, { ...playing, status: 'won' })).toBeNull()
  })
  it('reports playing -> won', () => {
    expect(finishedTransition(playing, { ...playing, status: 'won' })).toBe('won')
  })
  it('reports playing -> lost when an Endless game is given up', () => {
    const endless: SeenGame = { id: 'endless:x', status: 'playing' }
    expect(finishedTransition(endless, { ...endless, status: 'lost' })).toBe('lost')
  })
  it('ignores a mode switch or new game, even from playing to won', () => {
    expect(finishedTransition(playing, { id: 'endless:x', status: 'won' })).toBeNull()
    expect(finishedTransition(playing, { id: 'daily:2026-11-09', status: 'won' })).toBeNull()
  })
  it('sends once when the same state is seen twice (StrictMode)', () => {
    const won: SeenGame = { ...playing, status: 'won' }
    expect(finishedTransition(playing, won)).toBe('won')
    expect(finishedTransition(won, won)).toBeNull()
    expect(finishedTransition(playing, playing)).toBeNull()
  })
})
