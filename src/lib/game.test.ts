import { describe, expect, it } from 'vitest'
import type { Pokemon } from '../types/pokemon'
import { decodeSave, encodeSave, applyGuess, applyGuessToGames, gameStatus, isValidSave, newDailyGame, newEndlessGame, type SavedGame } from './game'

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
  it('has no guess limit: a game stays open until the answer is guessed', () => {
    let game: SavedGame = { v: 1, mode: 'endless', key: 'x', targetId: 1, guessIds: [] }
    for (let id = 2; id <= 60; id++) game = applyGuess(game, id).game
    expect(game.guessIds).toHaveLength(59)
    expect(gameStatus(game)).toBe('playing')
    const { game: won, result } = applyGuess(game, 1)
    expect(result).toBe('ok')
    expect(gameStatus(won)).toBe('won')
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
    expect(isValidSave({ ...base, guessIds: [2, 3, 1, 4] }, byId)).toBe(false)
    expect(isValidSave({ ...base, guessIds: [2.5] }, byId)).toBe(false)
  })
})

describe('applyGuessToGames', () => {
  const games = (dailyKey: string) => ({
    daily: newDailyGame(dailyKey, pool),
    endless: { v: 1 as const, mode: 'endless' as const, key: 'e', targetId: 1, guessIds: [] },
  })

  it('reports the game the guess landed in', () => {
    const g = games('2026-11-08')
    const { applied, result } = applyGuessToGames(g, 'endless', 2, '2026-11-08', pool)
    expect(result).toBe('ok')
    expect(applied).toEqual({ mode: 'endless', gameKey: 'e', targetId: 1, guessNumber: 1, status: 'playing' })
  })
  it('tags a guess after midnight with the new day, not the stale cached one', () => {
    const stale = games('2026-11-08')
    const fresh = newDailyGame('2026-11-09', pool)
    const out = applyGuessToGames(stale, 'daily', 5, '2026-11-09', pool)
    expect(out.applied).toEqual({ mode: 'daily', gameKey: '2026-11-09', targetId: fresh.targetId, guessNumber: 1, status: 'playing' })
    expect(out.games.daily.key).toBe('2026-11-09')
    expect(out.games.daily.guessIds).toEqual([5])
  })
  it('reports a finishing guess as won, for the new day after midnight', () => {
    const target = newDailyGame('2026-11-09', pool).targetId
    const out = applyGuessToGames(games('2026-11-08'), 'daily', target, '2026-11-09', pool)
    expect(out.applied).toMatchObject({ gameKey: '2026-11-09', status: 'won' })
  })
  it('reports nothing for rejected guesses', () => {
    const g = games('2026-11-08')
    const first = applyGuessToGames(g, 'daily', 5, '2026-11-08', pool)
    expect(applyGuessToGames(first.games, 'daily', 5, '2026-11-08', pool)).toMatchObject({ result: 'duplicate', applied: null })
  })
})

describe('save scrambling', () => {
  it('round-trips and hides the plain answer id', () => {
    const game: SavedGame = { v: 1, mode: 'daily', key: '2026-11-08', targetId: 438, guessIds: [1, 2] }
    const stored = encodeSave(game)
    expect(stored).not.toHaveProperty('targetId')
    expect(decodeSave(JSON.parse(JSON.stringify(stored)))).toEqual(game)
  })
  it('still reads the old plain format and rejects junk', () => {
    const old = { v: 1, mode: 'endless', key: 'k', targetId: 3, guessIds: [] }
    expect(decodeSave(old)).toEqual(old)
    expect(decodeSave(null)).toBeNull()
    expect(decodeSave({ v: 1, mode: 'daily', key: 'k', t: '!!', guessIds: [] })).toBeNull()
  })
})
