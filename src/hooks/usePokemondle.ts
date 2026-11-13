import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { compareGuess, type GuessFeedback } from '../lib/compare'
import { localDateKey, puzzleNumber } from '../lib/daily'
import {
  applyGuessToGames,
  canGiveUp,
  decodeSave,
  giveUp as giveUpGame,
  encodeSave,
  gameGens,
  matchEndlessToGens,
  rollOverGames,
  gameStatus as statusOf,
  isValidSave,
  newDailyGame,
  newEndlessGameForGens,
  type AppliedGuess,
  type GameMode,
  type Games,
  type GameStatus,
  type GuessResult,
  type SavedGame,
} from '../lib/game'
import { ALL_GENS, getGensPref, reloadGensPref, setGensPref, subscribeGensPref } from '../lib/gens'
import { effectiveHard, hardLocked, isHardPref, reloadHardPref, subscribeHardPref } from '../lib/hardMode'
import { parseEndlessRecord, parseHistory, recordEndless, recordSolve, type EndlessRecord, type HistoryEntry } from '../lib/history'
import { POKEDEX, POKEDEX_BY_ID } from '../lib/pokedex'
import { loadJson, saveJson, storageKey } from '../lib/storage'
import type { Pokemon } from '../types/pokemon'

export type { GameMode, GameStatus, GuessResult }

function loadDaily(dateKey: string): SavedGame {
  const saved = decodeSave(loadJson('daily'))
  const fresh = newDailyGame(dateKey, POKEDEX)
  // Keep today's save only if it is for the same puzzle. A save from an
  // earlier day, or a corrupt one, starts fresh.
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'daily' && saved.key === dateKey && saved.targetId === fresh.targetId) {
    return saved
  }
  return fresh
}

function loadEndless(): SavedGame {
  const saved = decodeSave(loadJson('endless'))
  // A saved game with no guesses follows the chosen Gens (they may have changed in another tab).
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'endless') return matchEndlessToGens(saved, POKEDEX, getGensPref(), ALL_GENS)
  return newEndlessGameForGens(POKEDEX, getGensPref())
}

const loadGames = (): Games => ({ daily: loadDaily(localDateKey()), endless: loadEndless() })

/** Replaces the daily game if the local date has moved on. */
function rollOver(games: Games): Games {
  return rollOverGames(games, localDateKey(), POKEDEX)
}

/**
 * Reads the saved history and adds the Daily if it is solved (once per date),
 * saving the result. Also picks up a Daily solved before history existed.
 */
function syncHistory(daily: SavedGame): HistoryEntry[] {
  const stored = parseHistory(loadJson('history'))
  if (statusOf(daily) !== 'won') return stored
  const next = recordSolve(stored, {
    date: daily.key,
    targetId: daily.targetId,
    guesses: daily.guessIds.length,
    ...(daily.hard ? { hard: true as const } : {}),
  })
  if (next !== stored) saveJson('history', next)
  return next
}

/** Reads the saved Endless tally and counts the Endless game if it has just finished (once per game). */
function syncEndlessRecord(endless: SavedGame): EndlessRecord {
  const stored = parseEndlessRecord(loadJson('endless-record'))
  const status = statusOf(endless)
  if (status === 'playing') return stored
  const next = recordEndless(stored, endless.key, status, endless.guessIds.length)
  if (next !== stored) saveJson('endless-record', next)
  return next
}

/** Redraws an Endless game that has no guesses yet if it doesn't match the chosen Gens. */
function followGens(games: Games): Games {
  const endless = matchEndlessToGens(games.endless, POKEDEX, getGensPref(), ALL_GENS)
  return endless === games.endless ? games : { ...games, endless }
}

const lookup = (id: number) => POKEDEX_BY_ID.get(id) as Pokemon

const msUntilLocalMidnight = () => {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return midnight.getTime() - now.getTime()
}

/**
 * Game state for both modes. Each mode keeps its own game, so switching
 * between Daily and Endless never loses progress. Both are saved to
 * localStorage on every change and kept in sync across open tabs.
 */
export function usePokemondle(mode: GameMode) {
  const [games, setGamesState] = useState<Games>(loadGames)
  // The latest state, updated synchronously so back-to-back guesses (before a
  // re-render) are each validated against the result of the one before.
  const gamesRef = useRef(games)
  const [history, setHistory] = useState<HistoryEntry[]>(() => syncHistory(games.daily))
  const [endlessRecord, setEndlessRecord] = useState<EndlessRecord>(() => syncEndlessRecord(games.endless))

  const commit = useCallback((next: Games) => {
    if (next === gamesRef.current) return
    gamesRef.current = next
    setGamesState(next)
    setHistory(syncHistory(next.daily))
    setEndlessRecord(syncEndlessRecord(next.endless))
  }, [])

  useEffect(() => saveJson('daily', encodeSave(games.daily)), [games.daily])
  useEffect(() => saveJson('endless', encodeSave(games.endless)), [games.endless])

  useEffect(() => {
    const check = () => commit(rollOver(gamesRef.current))
    // Another tab saved progress: pick it up instead of overwriting it later.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey('daily') || e.key === storageKey('endless')) commit(rollOver(loadGames()))
      if (e.key === storageKey('hard-mode')) reloadHardPref()
      if (e.key === storageKey('endless-gens')) {
        reloadGensPref()
        const current = gamesRef.current
        commit(followGens(current))
      }
      if (e.key === storageKey('history')) setHistory(parseHistory(loadJson('history')))
      if (e.key === storageKey('endless-record')) setEndlessRecord(parseEndlessRecord(loadJson('endless-record')))
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('storage', onStorage)
    // Also roll over at local midnight while the tab stays open.
    let timer: number
    const schedule = () => {
      timer = window.setTimeout(() => {
        check()
        schedule()
      }, msUntilLocalMidnight() + 1000)
    }
    schedule()
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('storage', onStorage)
      window.clearTimeout(timer)
    }
  }, [commit])

  const game = games[mode]
  const targetPokemon = lookup(game.targetId)
  const guesses = useMemo(() => game.guessIds.map(lookup), [game.guessIds])
  const feedback = useMemo<GuessFeedback[]>(
    () => guesses.map((g) => compareGuess(g, targetPokemon)),
    [guesses, targetPokemon],
  )
  const gameStatus = statusOf(game)
  const hardPref = useSyncExternalStore(subscribeHardPref, isHardPref, () => false)
  const hard = effectiveHard(game, hardPref)
  const hardSwitchLocked = hardLocked(game)

  /**
   * Records a guess in the current mode. `result` is 'ok' if it was accepted,
   * and then `applied` says which game it landed in (it can differ from the
   * rendered game if local midnight passed before the rollover was committed).
   * Side effects for an accepted guess (analytics, sounds) belong in the
   * caller, keyed on this.
   */
  const submitGuessDetailed = useCallback(
    (pokemon: Pokemon): { result: GuessResult; applied: AppliedGuess | null } => {
      const { games: next, result, applied } = applyGuessToGames(
        gamesRef.current,
        mode,
        pokemon.id,
        localDateKey(),
        POKEDEX,
        isHardPref(),
      )
      commit(next)
      return { result, applied }
    },
    [commit, mode],
  )

  const submitGuess = useCallback((pokemon: Pokemon): GuessResult => submitGuessDetailed(pokemon).result, [submitGuessDetailed])

  const endlessGens = useSyncExternalStore(subscribeGensPref, getGensPref, () => ALL_GENS)

  const startNewEndlessGame = useCallback(() => {
    const current = gamesRef.current
    commit({ ...current, endless: newEndlessGameForGens(POKEDEX, getGensPref(), Math.random, current.endless.targetId) })
  }, [commit])

  /**
   * Chooses which Gens Endless answers come from (at least one; an empty list is ignored).
   * An Endless game with no guesses yet is redrawn from the new choice straight away;
   * one with guesses keeps its answer, and the choice applies from the next game.
   */
  const setEndlessGens = useCallback(
    (gens: readonly number[]) => {
      setGensPref(gens)
      const current = gamesRef.current
      commit(followGens(current))
    },
    [commit],
  )

  /** Ends the current Endless game as given up, revealing the answer. Does nothing if it can't be given up. */
  const giveUp = useCallback(() => {
    const current = gamesRef.current
    commit({ ...current, endless: giveUpGame(current.endless) })
  }, [commit])

  return {
    mode,
    /** Identity of the current game: Daily = date key, Endless = start time (ISO). */
    gameKey: game.key,
    targetPokemon,
    guesses,
    feedback,
    gameStatus,
    /** True if this game is played in Hard mode (no Gen column). */
    hard,
    /** True while the Hard switch can't be changed (this game is in progress). */
    hardSwitchLocked,
    /** The player's Endless Gens choice (used for the next Endless game). */
    endlessGens,
    /** The Gens the game on screen was drawn from (always all nine for the Daily). */
    gameGens: gameGens(game, ALL_GENS),
    setEndlessGens,
    /** Solved Dailies on this device, newest first. */
    history,
    /** Endless games caught and given up on this device. */
    endlessRecord,
    /** True if the current game can be given up (Endless, in progress, at least one guess). */
    canGiveUp: canGiveUp(game),
    /** Daily puzzle number (#1 = launch day); null in Endless mode. */
    puzzleNumber: mode === 'daily' ? puzzleNumber(game.key) : null,
    submitGuess,
    submitGuessDetailed,
    startNewEndlessGame,
    giveUp,
  }
}
