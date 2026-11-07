import { useState } from 'react'
import type { Pokemon } from '../types/pokemon'

export type GameStatus = 'playing' | 'won' | 'lost'

/** Game state hook. Daily/Endless targets, comparison and persistence come in step 3. */
export function usePokemondle() {
  const [guesses, setGuesses] = useState<Pokemon[]>([])
  const [gameStatus] = useState<GameStatus>('playing')
  const targetPokemon: Pokemon | null = null

  const submitGuess = (pokemon: Pokemon) => setGuesses((prev) => [...prev, pokemon])

  return { targetPokemon, guesses, gameStatus, submitGuess }
}
