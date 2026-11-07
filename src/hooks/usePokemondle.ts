import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAX_GUESSES } from '../config/gameConfig'
import { compareGuess, type GuessFeedback } from '../lib/compare'
import { localDateKey, puzzleNumber } from '../lib/daily'
import {
  applyGuess,
  gameStatus as statusOf,
  isValidSave,
  newDailyGame,
  newEndlessGame,
  type GameMode,
  type GameStatus,
  type GuessResult,
  type SavedGame,
} from '../lib/game'
import { POKEDEX, POKEDEX_BY_ID } from '../lib/pokedex'
import { loadJson, saveJson, storageKey } from '../lib/storage'
import type { Pokemon } from '../types/pokemon'

export type { GameMode, GameStatus, GuessResult }

type Games = Record<GameMode, SavedGame>

function loadDaily(dateKey: string): SavedGame {
  const saved = loadJson('daily')
  const fresh = newDailyGame(dateKey, POKEDEX)
  // Keep today's save only if it is for the same puzzle. A save from an
  // earlier day, or a corrupt one, starts fresh.
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'daily' && saved.key === dateKey && saved.targetId === fresh.targetId) {
    return saved
  }
  return fresh
}

function loadEndless(): SavedGame {
  const saved = loadJson('endless')
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'endless') return saved
  return newEndlessGame(POKEDEX)
}

const loadGames = (): Games => ({ daily: loadDaily(localDateKey()), endless: loadEndless() })

/** Replaces the daily game if the local date has moved on. */
function rollOver(games: Games): Games {
  const today = localDateKey()
  return games.daily.key === today ? games : { ...games, daily: newDailyGame(today, POKEDEX) }
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

  const commit = useCallback((next: Games) => {
    if (next === gamesRef.current) return
    gamesRef.current = next
    setGamesState(next)
  }, [])

  useEffect(() => saveJson('daily', games.daily), [games.daily])
  useEffect(() => saveJson('endless', games.endless), [games.endless])

  useEffect(() => {
    const check = () => commit(rollOver(gamesRef.current))
    // Another tab saved progress: pick it up instead of overwriting it later.
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey('daily') || e.key === storageKey('endless')) commit(rollOver(loadGames()))
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

  /**
   * Records a guess in the current mode. Returns 'ok' if it was accepted.
   * Side effects for an accepted guess (analytics, sounds) belong in the
   * caller, keyed on the returned result.
   */
  const submitGuess = useCallback(
    (pokemon: Pokemon): GuessResult => {
      const current = rollOver(gamesRef.current)
      const { game: next, result } = applyGuess(current[mode], pokemon.id)
      commit(result === 'ok' ? { ...current, [mode]: next } : current)
      return result
    },
    [commit, mode],
  )

  const startNewEndlessGame = useCallback(() => {
    const current = gamesRef.current
    commit({ ...current, endless: newEndlessGame(POKEDEX, Math.random, current.endless.targetId) })
  }, [commit])

  return {
    mode,
    targetPokemon,
    guesses,
    feedback,
    gameStatus,
    maxGuesses: MAX_GUESSES,
    guessesLeft: MAX_GUESSES - guesses.length,
    /** Daily puzzle number (#1 = launch day); null in Endless mode. */
    puzzleNumber: mode === 'daily' ? puzzleNumber(game.key) : null,
    submitGuess,
    startNewEndlessGame,
  }
}
