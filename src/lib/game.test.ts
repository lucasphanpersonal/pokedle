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
    expect(applied).toEqual({ mode: 'endless', gameKey: 'e', targetId: 1, guessNumber: 1, status: 'playing', hard: false })
  })
  it('tags a guess after midnight with the new day, not the stale cached one', () => {
    const stale = games('2026-11-08')
    const fresh = newDailyGame('2026-11-09', pool)
    const out = applyGuessToGames(stale, 'daily', 5, '2026-11-09', pool)
    expect(out.applied).toEqual({ mode: 'daily', gameKey: '2026-11-09', targetId: fresh.targetId, guessNumber: 1, status: 'playing', hard: false })
    expect(out.games.daily.key).toBe('2026-11-09')
    expect(out.games.daily.guessIds).toEqual([5])
  })
  it('reports a finishing guess as won, for the new day after midnight', () => {
    const target = newDailyGame('2026-11-09', pool).targetId
    const out = applyGuessToGames(games('2026-11-08'), 'daily', target, '2026-11-09', pool)
    expect(out.applied).toMatchObject({ gameKey: '2026-11-09', status: 'won' })
  })
  it('does not report a win for yesterday\'s answer guessed just after midnight', () => {
    // The rendered (stale) game still holds yesterday's answer; the guess lands in today's game.
    const yesterdayTarget = newDailyGame('2026-11-08', pool).targetId
    // Pick a following day whose answer differs, so the guess really is a miss today.
    const today = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].find(
      (k) => newDailyGame(k, pool).targetId !== yesterdayTarget,
    )
    expect(today).toBeDefined()
    const out = applyGuessToGames(games('2026-11-08'), 'daily', yesterdayTarget, today as string, pool)
    expect(out.result).toBe('ok')
    expect(out.applied).toMatchObject({ gameKey: today, status: 'playing' })
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

describe('hard mode flag', () => {
  const fresh = (): SavedGame => ({ v: 1, mode: 'endless', key: 'x', targetId: 1, guessIds: [] })
  it('is recorded on the first guess only', () => {
    const first = applyGuess(fresh(), 2, true).game
    expect(first.hard).toBe(true)
    // Turning the preference off mid-game doesn't change the game.
    expect(applyGuess(first, 3, false).game.hard).toBe(true)
    // And turning it on mid-game doesn't make a normal game hard.
    const normal = applyGuess(fresh(), 2, false).game
    expect(applyGuess(normal, 3, true).game.hard).toBeUndefined()
  })
  it('is reported for the game a guess landed in, and survives save and load', () => {
    const games = { daily: newDailyGame('2026-11-08', pool), endless: fresh() }
    const { games: next, applied } = applyGuessToGames(games, 'endless', 2, '2026-11-08', pool, true)
    expect(applied?.hard).toBe(true)
    expect(isValidSave(decodeSave(encodeSave(next.endless)), byId)).toBe(true)
    expect((decodeSave(encodeSave(next.endless)) as SavedGame).hard).toBe(true)
  })
  it('rejects a corrupt hard flag', () => {
    expect(isValidSave({ ...fresh(), targetId: 1, hard: 'yes' }, byId)).toBe(false)
  })
})
