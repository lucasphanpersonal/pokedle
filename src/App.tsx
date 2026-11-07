import { useState } from 'react'
import { GuessGrid } from './components/GuessGrid'
import { Header } from './components/Header'
import { HelpModal } from './components/HelpModal'
import { SearchBar } from './components/SearchBar'
import { WinModal } from './components/WinModal'
import { usePokemondle, type GameMode } from './hooks/usePokemondle'
import { POKEDEX } from './lib/pokedex'

export default function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  const [showHelp, setShowHelp] = useState(false)
  // Which finished game's win screen was dismissed, so it doesn't reopen.
  const [dismissedWin, setDismissedWin] = useState<string | null>(null)
  const game = usePokemondle(mode)
  const winKey = `${mode}:${game.targetPokemon.id}:${game.guesses.length}`

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col">
      <Header mode={mode} onModeChange={setMode} onHelp={() => setShowHelp(true)} />
      <main className="flex flex-col gap-4 p-4">
        <p className="text-center text-[10px]">
          {game.puzzleNumber !== null ? `Daily #${game.puzzleNumber}` : 'Endless'} · {game.guessesLeft} guesses left
        </p>
        <SearchBar pokedex={POKEDEX} onGuess={game.submitGuess} disabled={game.gameStatus !== 'playing'} />
        {game.gameStatus === 'lost' && (
          <p className="ds-box p-3 text-center text-[10px] leading-5">
            Out of guesses! It was {game.targetPokemon.name}.
          </p>
        )}
        {mode === 'endless' && game.gameStatus !== 'playing' && (
          <button
            type="button"
            onClick={game.startNewEndlessGame}
            className="ds-box self-center px-4 py-3 text-[10px]"
          >
            New Pokémon
          </button>
        )}
        <GuessGrid guesses={game.guesses} feedback={game.feedback} />
      </main>
      {game.gameStatus === 'won' && dismissedWin !== winKey && (
        <WinModal
          target={game.targetPokemon}
          guessCount={game.guesses.length}
          onClose={() => setDismissedWin(winKey)}
        />
      )}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
