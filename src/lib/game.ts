import type { Pokemon } from '../types/pokemon'
import { dailyPick, hashString } from './daily'

export type GameMode = 'daily' | 'endless'
/** A game ends only when the player guesses the answer. There is no guess limit. */
export type GameStatus = 'playing' | 'won'

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

export function gameStatus(game: SavedGame): GameStatus {
  return game.guessIds.includes(game.targetId) ? 'won' : 'playing'
}

export type GuessResult = 'ok' | 'duplicate' | 'game-over'

/** Returns the updated game, or the reason the guess was rejected. */
export function applyGuess(game: SavedGame, guessId: number): { game: SavedGame; result: GuessResult } {
  if (gameStatus(game) !== 'playing') return { game, result: 'game-over' }
  if (game.guessIds.includes(guessId)) return { game, result: 'duplicate' }
  return { game: { ...game, guessIds: [...game.guessIds, guessId] }, result: 'ok' }
}

export type Games = Record<GameMode, SavedGame>

/** Replaces the daily game if `today` (a local date key) is a different day. */
export function rollOverGames(games: Games, today: string, pool: Pokemon[]): Games {
  return games.daily.key === today ? games : { ...games, daily: newDailyGame(today, pool) }
}

/** The game a guess was applied to, as it stood after the guess. */
export interface AppliedGuess {
  mode: GameMode
  gameKey: string
  targetId: number
  /** 1-based position of the guess within that game. */
  guessNumber: number
  /** Status of that game after the guess. */
  status: GameStatus
}

/**
 * Applies a guess to `mode` after rolling the daily game over to `today`, and
 * reports which game it landed in. Analytics must tag the event with this, not
 * with whatever game the UI last rendered (which may be yesterday's).
 */
export function applyGuessToGames(
  games: Games,
  mode: GameMode,
  guessId: number,
  today: string,
  pool: Pokemon[],
): { games: Games; result: GuessResult; applied: AppliedGuess | null } {
  const current = rollOverGames(games, today, pool)
  const { game, result } = applyGuess(current[mode], guessId)
  if (result !== 'ok') return { games: current, result, applied: null }
  return {
    games: { ...current, [mode]: game },
    result,
    applied: { mode, gameKey: game.key, targetId: game.targetId, guessNumber: game.guessIds.length,
      status: gameStatus(game),
    },
  }
}

/** True if a saved game still makes sense against the current Pokédex. */
export function isValidSave(game: unknown, byId: Map<number, Pokemon>): game is SavedGame {
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
    new Set(ids).size === ids.length &&
    // Nothing may be recorded after the winning guess.
    (winAt === -1 || winAt === ids.length - 1) &&
    ids.every((id) => Number.isInteger(id) && byId.has(id))
  )
}

/**
 * What goes into localStorage: the answer is scrambled (not plain `targetId`),
 * so it can't be read at a glance from the browser's storage panel. This is
 * only a deterrent; the game runs entirely in the browser, so it isn't secret.
 */
export interface StoredGame {
  v: typeof SAVE_VERSION
  mode: GameMode
  key: string
  /** Scrambled answer id. */
  t: string
  guessIds: number[]
}

const mask = (key: string) => hashString(`mask:${key}`) & 0xffff

export function encodeSave(game: SavedGame): StoredGame {
  const { targetId, ...rest } = game
  return { ...rest, t: ((targetId ^ mask(game.key)) + 7919).toString(36) }
}

/** Reads a stored game. Also accepts the older plain `targetId` format. Returns null if unreadable. */
export function decodeSave(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<StoredGame> & { targetId?: unknown }
  if (typeof r.targetId === 'number') return raw
  if (typeof r.t !== 'string' || typeof r.key !== 'string') return null
  const n = parseInt(r.t, 36)
  if (!Number.isInteger(n)) return null
  const { t: _t, ...rest } = r
  return { ...rest, targetId: (n - 7919) ^ mask(r.key) }
}
