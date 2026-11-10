import type { Pokemon } from '../types/pokemon'
import { dailyPick, hashString } from './daily'

export type GameMode = 'daily' | 'endless'
/**
 * There is no guess limit: a game ends when the player guesses the answer
 * ('won'), or, in Endless only, when they give up ('lost').
 */
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
  /** Set when the first guess is made, if Hard mode (no Gen column) was on. Absent = normal. */
  hard?: true
  /** Endless only: the player gave up and the answer was revealed. Absent = still open or won. */
  gaveUp?: true
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
  if (game.guessIds.includes(game.targetId)) return 'won'
  return game.gaveUp ? 'lost' : 'playing'
}

/** Giving up is Endless only, and only once the game has at least one guess and is still open. */
export function canGiveUp(game: SavedGame): boolean {
  return game.mode === 'endless' && game.guessIds.length > 0 && gameStatus(game) === 'playing'
}

/** Ends an Endless game as given up (the answer is then revealed). Returns the same game if it can't. */
export function giveUp(game: SavedGame): SavedGame {
  return canGiveUp(game) ? { ...game, gaveUp: true } : game
}

export type GuessResult = 'ok' | 'duplicate' | 'game-over'

/** Returns the updated game, or the reason the guess was rejected. */
export function applyGuess(
  game: SavedGame,
  guessId: number,
  hard = false,
): { game: SavedGame; result: GuessResult } {
  if (gameStatus(game) !== 'playing') return { game, result: 'game-over' }
  if (game.guessIds.includes(guessId)) return { game, result: 'duplicate' }
  // The mode is fixed by the first guess; after that the switch can't change it.
  const next: SavedGame = { ...game, guessIds: [...game.guessIds, guessId] }
  if (game.guessIds.length === 0 && hard) next.hard = true
  return { game: next, result: 'ok' }
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
  /** True if that game is played in Hard mode. */
  hard: boolean
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
  hard = false,
): { games: Games; result: GuessResult; applied: AppliedGuess | null } {
  const current = rollOverGames(games, today, pool)
  const { game, result } = applyGuess(current[mode], guessId, hard)
  if (result !== 'ok') return { games: current, result, applied: null }
  return {
    games: { ...current, [mode]: game },
    result,
    applied: {
      mode,
      gameKey: game.key,
      targetId: game.targetId,
      guessNumber: game.guessIds.length,
      status: gameStatus(game),
      hard: game.hard === true,
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
    (g.hard === undefined || g.hard === true) &&
    // Only an Endless game with guesses and no win can have been given up.
    (g.gaveUp === undefined || (g.gaveUp === true && g.mode === 'endless' && winAt === -1 && ids.length > 0)) &&
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
  hard?: true
  gaveUp?: true
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
