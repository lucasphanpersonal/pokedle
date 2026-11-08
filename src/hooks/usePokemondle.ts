import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { compareGuess, type GuessFeedback } from '../lib/compare'
import { localDateKey, puzzleNumber } from '../lib/daily'
import {
  applyGuessToGames,
  decodeSave,
  encodeSave,
  rollOverGames,
  gameStatus as statusOf,
  isValidSave,
  newDailyGame,
  newEndlessGame,
  type AppliedGuess,
  type GameMode,
  type Games,
  type GameStatus,
  type GuessResult,
  type SavedGame,
} from '../lib/game'
import { effectiveHard, hardLocked, isHardPref, reloadHardPref, subscribeHardPref } from '../lib/hardMode'
import { parseHistory, recordSolve, type HistoryEntry } from '../lib/history'
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
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'endless') return saved
  return newEndlessGame(POKEDEX)
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

  const commit = useCallback((next: Games) => {
    if (next === gamesRef.current) return
    gamesRef.current = next
    setGamesState(next)
    setHistory(syncHistory(next.daily))
  }, [])

  useEffect(() => saveJson('daily', encodeSave(games.daily)), [games.daily])
  useEffect(() => saveJson('endless', encodeSave(games.endless)), [games.endless])

  useEffect(() => {
    const check = () => commit(rollOver(gamesRef.current))
    // Another tab saved progress: pick it up instead of overwriting it later.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey('daily') || e.key === storageKey('endless')) commit(rollOver(loadGames()))
      if (e.key === storageKey('hard-mode')) reloadHardPref()
      if (e.key === storageKey('history')) setHistory(parseHistory(loadJson('history')))
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

  const startNewEndlessGame = useCallback(() => {
    const current = gamesRef.current
    commit({ ...current, endless: newEndlessGame(POKEDEX, Math.random, current.endless.targetId) })
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
    /** Solved Dailies on this device, newest first. */
    history,
    /** Daily puzzle number (#1 = launch day); null in Endless mode. */
    puzzleNumber: mode === 'daily' ? puzzleNumber(game.key) : null,
    submitGuess,
    submitGuessDetailed,
    startNewEndlessGame,
  }
}
