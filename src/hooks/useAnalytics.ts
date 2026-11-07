import { useCallback, useEffect, useRef } from 'react'
import { startAnalytics, trackFinish, trackGuess } from '../lib/analytics'
import type { AppliedGuess, GameStatus, GuessResult } from '../lib/game'
import type { Pokemon } from '../types/pokemon'

interface GameView {
  mode: 'daily' | 'endless'
  gameKey: string
  targetPokemon: Pokemon
  guesses: Pokemon[]
  gameStatus: GameStatus
  submitGuessDetailed: (pokemon: Pokemon) => { result: GuessResult; applied: AppliedGuess | null }
}

/** What the previous render of the hook saw: which game, and its status. */
export interface SeenGame {
  id: string
  status: GameStatus
}

/**
 * Decides whether this render is the moment a game finished. Only a
 * playing -> won/lost change within the same game counts, so a finished game
 * seen on first mount, a mode switch or new game, and the same state seen
 * twice (StrictMode's double effect) all report nothing.
 */
export function finishedTransition(last: SeenGame | null, current: SeenGame): 'won' | 'lost' | null {
  if (!last || last.id !== current.id) return null
  if (last.status !== 'playing' || current.status === 'playing') return null
  return current.status
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
  const { mode, gameKey, targetPokemon, guesses, gameStatus, submitGuessDetailed } = game
  useEffect(() => startAnalytics(), [])

  // Tagged with the game the guess was actually applied to (not the rendered
  // one), so a guess just after local midnight isn't filed under yesterday.
  const wrapped = useCallback(
    (pokemon: Pokemon): GuessResult => {
      const { result, applied } = submitGuessDetailed(pokemon)
      if (result === 'ok' && applied) {
        const ref = { mode: applied.mode, gameKey: applied.gameKey, targetId: applied.targetId }
        trackGuess(ref, {
          guessId: pokemon.id,
          guessNumber: applied.guessNumber,
          isCorrect: pokemon.id === applied.targetId,
        })
        // Finish for the applied game right away: after a midnight rollover the
        // rendered game differs, so the effect below would never see this
        // transition. trackFinish is once-per-game, so the effect can't double-send.
        if (applied.status !== 'playing') trackFinish(ref, applied.status, applied.guessNumber)
      }
      return result
    },
    [submitGuessDetailed],
  )

  const prev = useRef<SeenGame | null>(null)
  useEffect(() => {
    const current = { id: `${mode}:${gameKey}`, status: gameStatus }
    const finished = finishedTransition(prev.current, current)
    prev.current = current
    if (finished) trackFinish({ mode, gameKey, targetId: targetPokemon.id }, finished, guesses.length)
  }, [mode, gameKey, gameStatus, targetPokemon.id, guesses.length])

  return wrapped
}
