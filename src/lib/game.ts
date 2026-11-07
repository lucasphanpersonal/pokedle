import { MAX_GUESSES } from '../config/gameConfig'
import type { Pokemon } from '../types/pokemon'
import { dailyIndex } from './daily'

export type GameMode = 'daily' | 'endless'
export type GameStatus = 'playing' | 'won' | 'lost'

/**
 * Everything needed to restore a game. Stored as ids so saved games stay small
 * and survive dataset regeneration (ids are PokéAPI ids, which don't change).
 */
export interface SavedGame {
  mode: GameMode
  /** Daily: the puzzle's date key. Endless: when the game started (ISO). */
  key: string
  targetId: number
  guessIds: number[]
}

export function newDailyGame(dateKey: string, pool: Pokemon[]): SavedGame {
  return { mode: 'daily', key: dateKey, targetId: pool[dailyIndex(dateKey, pool.length)].id, guessIds: [] }
}

export function newEndlessGame(pool: Pokemon[], random: () => number = Math.random, avoidId?: number): SavedGame {
  if (pool.length === 0) throw new Error('Answer pool is empty')
  let target = pool[Math.floor(random() * pool.length)]
  // Don't hand out the same answer twice in a row.
  if (target.id === avoidId && pool.length > 1) {
    target = pool[(pool.indexOf(target) + 1) % pool.length]
  }
  return { mode: 'endless', key: new Date().toISOString(), targetId: target.id, guessIds: [] }
}

export function gameStatus(game: SavedGame, maxGuesses = MAX_GUESSES): GameStatus {
  if (game.guessIds.includes(game.targetId)) return 'won'
  if (game.guessIds.length >= maxGuesses) return 'lost'
  return 'playing'
}

export type GuessResult = 'ok' | 'duplicate' | 'game-over'

/** Returns the updated game, or the reason the guess was rejected. */
export function applyGuess(
  game: SavedGame,
  guessId: number,
  maxGuesses = MAX_GUESSES,
): { game: SavedGame; result: GuessResult } {
  if (gameStatus(game, maxGuesses) !== 'playing') return { game, result: 'game-over' }
  if (game.guessIds.includes(guessId)) return { game, result: 'duplicate' }
  return { game: { ...game, guessIds: [...game.guessIds, guessId] }, result: 'ok' }
}

/** True if a saved game still makes sense against the current Pokédex. */
export function isValidSave(game: unknown, byId: Map<number, Pokemon>): game is SavedGame {
  if (!game || typeof game !== 'object') return false
  const g = game as Partial<SavedGame>
  return (
    (g.mode === 'daily' || g.mode === 'endless') &&
    typeof g.key === 'string' &&
    typeof g.targetId === 'number' &&
    byId.has(g.targetId) &&
    Array.isArray(g.guessIds) &&
    g.guessIds.every((id) => typeof id === 'number' && byId.has(id))
  )
}
