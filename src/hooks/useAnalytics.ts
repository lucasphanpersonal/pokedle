import { useCallback, useEffect, useRef } from 'react'
import { startAnalytics, trackFinish, trackGuess } from '../lib/analytics'
import type { GameStatus, GuessResult } from '../lib/game'
import type { Pokemon } from '../types/pokemon'

interface GameView {
  mode: 'daily' | 'endless'
  gameKey: string
  targetPokemon: Pokemon
  guesses: Pokemon[]
  gameStatus: GameStatus
  submitGuess: (pokemon: Pokemon) => GuessResult
}

/**
 * Wraps submitGuess with analytics and reports game_finished when a game moves
 * from playing to won/lost. Returns the wrapped submitGuess.
 *
 * game_finished only fires on an observed transition within the same game, so
 * a finished game restored from storage on reload is never re-sent (and the
 * per-game stored flag also dedupes across StrictMode and tabs).
 */
export function useAnalytics(game: GameView): (pokemon: Pokemon) => GuessResult {
  const { mode, gameKey, targetPokemon, guesses, gameStatus, submitGuess } = game
  const latest = useRef({ mode, gameKey, targetId: targetPokemon.id, guessCount: guesses.length })
  useEffect(() => {
    latest.current = { mode, gameKey, targetId: targetPokemon.id, guessCount: guesses.length }
  })

  useEffect(() => startAnalytics(), [])

  const wrapped = useCallback(
    (pokemon: Pokemon): GuessResult => {
      const before = latest.current
      const result = submitGuess(pokemon)
      if (result === 'ok') {
        trackGuess(
          { mode: before.mode, gameKey: before.gameKey, targetId: before.targetId },
          { guessId: pokemon.id, guessNumber: before.guessCount + 1, isCorrect: pokemon.id === before.targetId },
        )
        // Back-to-back guesses before a re-render: keep the count in step.
        latest.current = { ...before, guessCount: before.guessCount + 1 }
      }
      return result
    },
    [submitGuess],
  )

  const prev = useRef<{ id: string; status: GameStatus } | null>(null)
  useEffect(() => {
    const id = `${mode}:${gameKey}`
    const last = prev.current
    prev.current = { id, status: gameStatus }
    if (last && last.id === id && last.status === 'playing' && gameStatus !== 'playing') {
      trackFinish({ mode, gameKey, targetId: targetPokemon.id }, gameStatus, guesses.length)
    }
  }, [mode, gameKey, gameStatus, targetPokemon.id, guesses.length])

  return wrapped
}
