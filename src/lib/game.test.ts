import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../types/pokemon'
import { applyGuess, gameStatus, isValidSave, newDailyGame, newEndlessGame, type SavedGame } from './game'

const pool = [1, 2, 3, 4, 5].map((id) => ({ id }) as Pokemon)
const byId = new Map(pool.map((p) => [p.id, p]))

describe('game flow', () => {
  it('starts daily games from the date', () => {
    const a = newDailyGame('2026-11-08', pool)
    expect(a).toMatchObject({ mode: 'daily', key: '2026-11-08', guessIds: [] })
    expect(newDailyGame('2026-11-08', pool).targetId).toBe(a.targetId)
  })
  it('wins when the answer is guessed', () => {
    const game = { ...newDailyGame('2026-11-08', pool) }
    const { game: after, result } = applyGuess(game, game.targetId)
    expect(result).toBe('ok')
    expect(gameStatus(after)).toBe('won')
    expect(applyGuess(after, 99).result).toBe('game-over')
  })
  it('rejects duplicate guesses', () => {
    const game = { v: 1 as const, mode: 'endless' as const, key: 'x', targetId: 1, guessIds: [2] }
    expect(applyGuess(game, 2).result).toBe('duplicate')
  })
  it('loses after the last guess', () => {
    let game: SavedGame = { v: 1, mode: 'endless', key: 'x', targetId: 1, guessIds: [] }
    for (const id of [2, 3, 4]) game = applyGuess(game, id, 3).game
    expect(gameStatus(game, 3)).toBe('lost')
  })
  it('wins on the last guess rather than losing', () => {
    const game = { v: 1 as const, mode: 'endless' as const, key: 'x', targetId: 1, guessIds: [2, 3, 1] }
    expect(gameStatus(game, 3)).toBe('won')
  })
  it('avoids repeating the previous endless answer', () => {
    const first = newEndlessGame(pool, () => 0)
    const second = newEndlessGame(pool, () => 0, first.targetId)
    expect(second.targetId).not.toBe(first.targetId)
  })
})

describe('isValidSave', () => {
  it('accepts a well-formed save', () => {
    expect(isValidSave({ v: 1, mode: 'daily', key: '2026-11-08', targetId: 1, guessIds: [2, 3] }, byId)).toBe(true)
  })
  it('rejects junk and unknown ids', () => {
    expect(isValidSave(null, byId)).toBe(false)
    expect(isValidSave('nope', byId)).toBe(false)
    expect(isValidSave({ v: 1, mode: 'daily', key: 'k', targetId: 99, guessIds: [] }, byId)).toBe(false)
    expect(isValidSave({ v: 1, mode: 'daily', key: 'k', targetId: 1, guessIds: [99] }, byId)).toBe(false)
    expect(isValidSave({ v: 1, mode: 'weekly', key: 'k', targetId: 1, guessIds: [] }, byId)).toBe(false)
  })
  it('rejects saves without the current version', () => {
    expect(isValidSave({ mode: 'daily', key: 'k', targetId: 1, guessIds: [] }, byId)).toBe(false)
  })
  it('rejects impossible guess histories', () => {
    const base = { v: 1, mode: 'daily', key: 'k', targetId: 1 }
    expect(isValidSave({ ...base, guessIds: [2, 2] }, byId)).toBe(false)
    expect(isValidSave({ ...base, guessIds: [1, 2] }, byId)).toBe(false)
    expect(isValidSave({ ...base, guessIds: [2, 3, 4] }, byId, 2)).toBe(false)
    expect(isValidSave({ ...base, guessIds: [2.5] }, byId)).toBe(false)
  })
})
