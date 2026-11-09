import { useCallback, useEffect, useRef, useState } from 'react'
import { Confetti } from './components/Confetti'
import { GuessGrid } from './components/GuessGrid'
import { HardToggle } from './components/HardToggle'
import { Header } from './components/Header'
import { HelpModal } from './components/HelpModal'
import { HistoryModal } from './components/HistoryModal'
import { ResultModal } from './components/ResultModal'
import { SearchBar } from './components/SearchBar'
import { GRID_COLUMNS } from './config/gameConfig'
import { TILE_FLIP_DURATION_MS, TILE_FLIP_STAGGER_MS } from './config/uiConfig'
import { useAnalytics } from './hooks/useAnalytics'
import { usePokemondle, type GameMode } from './hooks/usePokemondle'
import { computeStats } from './lib/history'
import { playCry, stopCry } from './lib/cry'
import { POKEDEX } from './lib/pokedex'
import { playSound } from './lib/sound'
import { loadJson, saveJson } from './lib/storage'
import type { Pokemon } from './types/pokemon'

/** Time for a whole new row to finish flipping (Hard mode has one less tile). */
const rowRevealMs = (hard: boolean) =>
  (GRID_COLUMNS.length - (hard ? 2 : 1)) * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS

/** Length of the win fanfare (ms); the cry waits for it to finish. */
const WIN_FANFARE_MS = 1500

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export default function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  // Show the rules automatically on a player's first visit.
  const [showHelp, setShowHelp] = useState(() => loadJson('seen-help') !== true)
  const [showHistory, setShowHistory] = useState(false)
  const game = usePokemondle(mode)
  const stats = computeStats(game.history)
  const submitGuess = useAnalytics(game)
  const gameId = `${mode}:${game.gameKey}`
  const targetId = game.targetPokemon.id
  const hard = game.hard

  // Hold the result screen until the newest row has flipped in. Started from
  // the guess itself; keyed by game so switching modes never leaves it stuck.
  const [reveal, setReveal] = useState<{ gameId: string; token: number } | null>(null)
  const revealToken = useRef(0)
  const soundTimers = useRef<number[]>([])
  const clearSoundTimers = () => {
    soundTimers.current.forEach((id) => window.clearTimeout(id))
    soundTimers.current = []
    stopCry()
  }
  // A mode switch or new game must not play the old game's pending ticks or fanfare.
  // A mode switch or new game must also end any win burst still on screen, so switching back can't replay it.
  useEffect(() => () => { clearSoundTimers(); setConfettiGame(null) }, [gameId])
  // Win burst, for the game it was earned in. Only set from a fresh guess, so reloading a won Daily never replays it.
  const [confettiGame, setConfettiGame] = useState<string | null>(null)
  const endConfetti = useCallback(() => setConfettiGame(null), [])
  const onGuess = useCallback(
    (pokemon: Pokemon) => {
      const result = submitGuess(pokemon)
      if (result === 'ok') {
        clearSoundTimers()
        const won = pokemon.id === targetId
        const later = (fn: () => void, ms: number) => soundTimers.current.push(window.setTimeout(fn, ms))
        if (prefersReducedMotion()) {
          if (won) {
            playSound('win')
            later(() => playCry(pokemon), WIN_FANFARE_MS)
          }
        } else {
          const token = ++revealToken.current
          setReveal({ gameId, token })
          later(() => setReveal((cur) => (cur?.token === token ? null : cur)), rowRevealMs(hard))
          // One tick per tile, as it turns over, climbing in pitch across the row.
          for (let i = 0; i < GRID_COLUMNS.length - (hard ? 1 : 0); i++) {
            later(() => playSound('tick', i), i * TILE_FLIP_STAGGER_MS + TILE_FLIP_DURATION_MS / 2)
          }
          if (won) {
            later(() => playSound('win'), rowRevealMs(hard) + 100)
            later(() => playCry(pokemon), rowRevealMs(hard) + 100 + WIN_FANFARE_MS)
            later(() => setConfettiGame(gameId), rowRevealMs(hard) + 100)
          }
        }
      }
      return result
    },
    [submitGuess, gameId, targetId, hard],
  )
  const revealing = reveal?.gameId === gameId

  const [dismissedResult, setDismissedResult] = useState<string | null>(null)
  const finished = game.gameStatus !== 'playing'
  const showResult = finished && !revealing && dismissedResult !== gameId

  const closeHelp = () => {
    setShowHelp(false)
    saveJson('seen-help', true)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header
        mode={mode}
        onModeChange={setMode}
        onHelp={() => setShowHelp(true)}
        hard={hard}
        hardLocked={game.hardSwitchLocked}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[10px] sm:text-xs">
            {game.puzzleNumber !== null ? `Daily #${game.puzzleNumber}` : 'Endless mode'}
          </p>
          <p className="text-[9px] text-ds-frame">
            {game.guesses.length} {game.guesses.length === 1 ? 'guess' : 'guesses'}
            {hard && ' · Hard mode'}
          </p>
          {game.hardSwitchLocked && (
            <p id="hard-lock-note" className="max-w-md text-[8px] leading-4 text-ds-frame">
              Hard mode is locked for this game. It applies to your next Daily or a new Endless game.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="ds-button h-11 bg-ds-paper px-3 text-[9px] sm:px-4 sm:text-[10px]"
            >
              History · Streak {stats.currentStreak}
            </button>
            {/* Phones have no room for this in the header; wide screens show it there. */}
            <HardToggle hard={hard} hardLocked={game.hardSwitchLocked} className="inline-flex sm:hidden" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <SearchBar
            pokedex={POKEDEX}
            guessedIds={game.guesses.map((g) => g.id)}
            onGuess={onGuess}
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
              See results
            </button>
            {mode === 'endless' && (
              <button type="button" onClick={game.startNewEndlessGame} className="ds-button bg-ds-red px-4 text-[10px] text-ds-paper">
                New Pokémon
              </button>
            )}
          </div>
        )}

        {/* Remount per game so only guesses made now animate. */}
        <GuessGrid key={gameId} guesses={game.guesses} feedback={game.feedback} hard={hard} />
      </main>

      {showResult && (
        <ResultModal
          mode={mode}
          target={game.targetPokemon}
          feedback={game.feedback}
          puzzleDate={game.gameKey}
          streak={stats.currentStreak}
          bestStreak={stats.bestStreak}
          hard={hard}
          onClose={() => setDismissedResult(gameId)}
          onNewGame={mode === 'endless' ? game.startNewEndlessGame : undefined}
        />
      )}
      {confettiGame === gameId && <Confetti onDone={endConfetti} />}
      {showHistory && <HistoryModal history={game.history} onClose={() => setShowHistory(false)} />}
      {showHelp && <HelpModal onClose={closeHelp} hardLocked={game.hardSwitchLocked} gameHard={hard} />}
    </div>
  )
}
