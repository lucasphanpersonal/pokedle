import { useEffect, useRef, useState } from 'react'
import { GuessGrid } from './components/GuessGrid'
import { Header } from './components/Header'
import { HelpModal } from './components/HelpModal'
import { ResultModal } from './components/ResultModal'
import { SearchBar } from './components/SearchBar'
import { GRID_COLUMNS } from './config/gameConfig'
import { TILE_FLIP_DURATION_MS, TILE_FLIP_STAGGER_MS } from './config/uiConfig'
import { useAnalytics } from './hooks/useAnalytics'
import { usePokemondle, type GameMode } from './hooks/usePokemondle'
import { POKEDEX } from './lib/pokedex'
import { loadJson, saveJson } from './lib/storage'

/** Time for a whole new row to finish flipping. */
const ROW_REVEAL_MS = (GRID_COLUMNS.length - 1) * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS

function GuessPips({ used, max }: { used: number; max: number }) {
  return (
    <div className="flex items-center justify-center gap-1" aria-label={`${used} of ${max} guesses used`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-full border-2 border-ds-frame ${i < used ? 'bg-ds-red' : 'bg-ds-paper'}`}
        />
      ))}
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  // Show the rules automatically on a player's first visit.
  const [showHelp, setShowHelp] = useState(() => loadJson('seen-help') !== true)
  const game = usePokemondle(mode)
  const submitGuess = useAnalytics(game)
  const gameId = `${mode}:${game.gameKey}`

  // Hold the result screen until the winning/losing row has flipped in.
  const [revealing, setRevealing] = useState(false)
  const lastCount = useRef({ gameId, count: game.guesses.length })
  useEffect(() => {
    const prev = lastCount.current
    lastCount.current = { gameId, count: game.guesses.length }
    if (prev.gameId !== gameId || game.guesses.length <= prev.count) return
    setRevealing(true)
    const t = window.setTimeout(() => setRevealing(false), ROW_REVEAL_MS)
    return () => window.clearTimeout(t)
  }, [gameId, game.guesses.length])

  const [dismissedResult, setDismissedResult] = useState<string | null>(null)
  const finished = game.gameStatus !== 'playing'
  const showResult = finished && !revealing && dismissedResult !== gameId

  const closeHelp = () => {
    setShowHelp(false)
    saveJson('seen-help', true)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header mode={mode} onModeChange={setMode} onHelp={() => setShowHelp(true)} />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] sm:text-xs">
            {game.puzzleNumber !== null ? `Daily #${game.puzzleNumber}` : 'Endless mode'}
          </p>
          <GuessPips used={game.guesses.length} max={game.maxGuesses} />
        </div>

        <div className="mx-auto w-full max-w-xl">
          <SearchBar
            pokedex={POKEDEX}
            guessedIds={game.guesses.map((g) => g.id)}
            onGuess={submitGuess}
            disabled={finished}
          />
        </div>

        {finished && !revealing && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setDismissedResult(null)}
              className="ds-button bg-ds-paper px-4 text-[10px]"
            >
              {game.gameStatus === 'won' ? 'See results' : `It was ${game.targetPokemon.name}`}
            </button>
            {mode === 'endless' && (
              <button type="button" onClick={game.startNewEndlessGame} className="ds-button bg-ds-red px-4 text-[10px] text-ds-paper">
                New Pokémon
              </button>
            )}
          </div>
        )}

        {/* Remount per game so only guesses made now animate. */}
        <GuessGrid key={gameId} guesses={game.guesses} feedback={game.feedback} />
      </main>

      {showResult && (
        <ResultModal
          mode={mode}
          status={game.gameStatus as 'won' | 'lost'}
          target={game.targetPokemon}
          feedback={game.feedback}
          maxGuesses={game.maxGuesses}
          puzzleNumber={game.puzzleNumber}
          onClose={() => setDismissedResult(gameId)}
          onNewGame={mode === 'endless' ? game.startNewEndlessGame : undefined}
        />
      )}
      {showHelp && <HelpModal onClose={closeHelp} />}
    </div>
  )
}
