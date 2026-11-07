import { MAX_GUESSES } from '../config/gameConfig'
import type { Pokemon } from '../types/pokemon'
import { dailyPick } from './daily'

export type GameMode = 'daily' | 'endless'
export type GameStatus = 'playing' | 'won' | 'lost'

/**
 * Everything needed to restore a game. Stored as ids so saved games stay small
 * and survive dataset regeneration (ids are PokéAPI ids, which don't change).
 */
export const SAVE_VERSION = 1

export interface SavedGame {
  /** Bumped when the save format changes, so old saves can be migrated or dropped. */
  v: typeof SAVE_VERSION
  mode: GameMode
  /** Daily: the puzzle's date key. Endless: when the game started (ISO). */
  key: string
  targetId: number
  guessIds: number[]
}

export function newDailyGame(dateKey: string, pool: Pokemon[]): SavedGame {
  return { v: SAVE_VERSION, mode: 'daily', key: dateKey, targetId: dailyPick(dateKey, pool).id, guessIds: [] }
}

export function newEndlessGame(
  pool: Pokemon[],
  random: () => number = Math.random,
  avoidId?: number,
  now: Date = new Date(),
): SavedGame {
  if (pool.length === 0) throw new Error('Answer pool is empty')
  let target = pool[Math.floor(random() * pool.length)]
  // Don't hand out the same answer twice in a row.
  if (target.id === avoidId && pool.length > 1) {
    target = pool[(pool.indexOf(target) + 1) % pool.length]
  }
  return { v: SAVE_VERSION, mode: 'endless', key: now.toISOString(), targetId: target.id, guessIds: [] }
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
export function isValidSave(
  game: unknown,
  byId: Map<number, Pokemon>,
  maxGuesses = MAX_GUESSES,
): game is SavedGame {
  if (!game || typeof game !== 'object') return false
  const g = game as Partial<SavedGame>
  if (!Array.isArray(g.guessIds)) return false
  const ids = g.guessIds
  const winAt = ids.indexOf(g.targetId as number)
  return (
    g.v === SAVE_VERSION &&
    (g.mode === 'daily' || g.mode === 'endless') &&
    typeof g.key === 'string' &&
    typeof g.targetId === 'number' &&
    byId.has(g.targetId) &&
    ids.length <= maxGuesses &&
    new Set(ids).size === ids.length &&
    // Nothing may be recorded after the winning guess.
    (winAt === -1 || winAt === ids.length - 1) &&
    ids.every((id) => Number.isInteger(id) && byId.has(id))
  )
}
