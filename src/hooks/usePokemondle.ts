import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { loadJson, saveJson } from '../lib/storage'
import type { Pokemon } from '../types/pokemon'

export type { GameMode, GameStatus, GuessResult }

function loadDaily(dateKey: string): SavedGame {
  const saved = loadJson('daily')
  // A save from an earlier day (or one that no longer fits the data) starts fresh.
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'daily' && saved.key === dateKey) {
    const fresh = newDailyGame(dateKey, POKEDEX)
    // If the answer pool changed since the save (config toggle), trust today's pick.
    if (saved.targetId === fresh.targetId) return saved
  }
  return newDailyGame(dateKey, POKEDEX)
}

function loadEndless(): SavedGame {
  const saved = loadJson('endless')
  if (isValidSave(saved, POKEDEX_BY_ID) && saved.mode === 'endless') return saved
  return newEndlessGame(POKEDEX)
}

const lookup = (id: number) => POKEDEX_BY_ID.get(id) as Pokemon

/**
 * Game state for both modes. Each mode keeps its own game, so switching
 * between Daily and Endless never loses progress. Both are saved to
 * localStorage on every change.
 */
export function usePokemondle(mode: GameMode) {
  const [games, setGames] = useState<Record<GameMode, SavedGame>>(() => ({
    daily: loadDaily(localDateKey()),
    endless: loadEndless(),
  }))

  useEffect(() => saveJson('daily', games.daily), [games.daily])
  useEffect(() => saveJson('endless', games.endless), [games.endless])

  // Roll the daily puzzle over at local midnight when the player comes back to the tab.
  useEffect(() => {
    const checkDate = () => {
      const today = localDateKey()
      setGames((prev) => (prev.daily.key === today ? prev : { ...prev, daily: newDailyGame(today, POKEDEX) }))
    }
    window.addEventListener('focus', checkDate)
    document.addEventListener('visibilitychange', checkDate)
    return () => {
      window.removeEventListener('focus', checkDate)
      document.removeEventListener('visibilitychange', checkDate)
    }
  }, [])

  const game = games[mode]
  const targetPokemon = lookup(game.targetId)
  const guesses = useMemo(() => game.guessIds.map(lookup), [game.guessIds])
  const feedback = useMemo<GuessFeedback[]>(
    () => guesses.map((g) => compareGuess(g, targetPokemon)),
    [guesses, targetPokemon],
  )
  const gameStatus = statusOf(game)

  const submitGuess = useCallback(
    (pokemon: Pokemon): GuessResult => {
      const { game: next, result } = applyGuess(games[mode], pokemon.id)
      if (result === 'ok') setGames((prev) => ({ ...prev, [mode]: next }))
      return result
    },
    [games, mode],
  )

  const startNewEndlessGame = useCallback(() => {
    setGames((prev) => ({ ...prev, endless: newEndlessGame(POKEDEX, Math.random, prev.endless.targetId) }))
  }, [])

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
