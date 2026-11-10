import { useCallback, useState, useSyncExternalStore } from 'react'
import { Confetti } from './components/Confetti'
import { GiveUpModal } from './components/GiveUpModal'
import { GuessGrid } from './components/GuessGrid'
import { HardNotice } from './components/HardNotice'
import { HardToggle } from './components/HardToggle'
import { Header } from './components/Header'
import { HelpModal } from './components/HelpModal'
import { HistoryModal } from './components/HistoryModal'
import { ResultModal } from './components/ResultModal'
import { SearchBar } from './components/SearchBar'
import { useAnalytics } from './hooks/useAnalytics'
import { useRevealEffects } from './hooks/useRevealEffects'
import { usePokemondle, type GameMode, type GuessResult } from './hooks/usePokemondle'
import { dismissHardNotice, isHardNoticePending, subscribeHardPref } from './lib/hardMode'
import { computeStats } from './lib/history'
import { POKEDEX } from './lib/pokedex'
import { loadJson, saveJson } from './lib/storage'
import type { Pokemon } from './types/pokemon'

export default function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  // Show the rules automatically on a player's first visit.
  const [showHelp, setShowHelp] = useState(() => loadJson('seen-help') !== true)
  const [showHistory, setShowHistory] = useState(false)
  const game = usePokemondle(mode)
  const stats = computeStats(game.history)
  const submitGuess = useAnalytics(game)
  const gameId = `${mode}:${game.gameKey}`
  const hard = game.hard

  const { revealing, confetti, endConfetti, play } = useRevealEffects(gameId, hard)
  const onGuess = useCallback(
    (pokemon: Pokemon): GuessResult => {
      const { result, applied } = submitGuess(pokemon)
      if (result === 'ok' && applied) {
        // Judge the win by the game the guess landed in, not the rendered one:
        // just after local midnight the rendered game can still be yesterday's.
        play(pokemon, `${applied.mode}:${applied.gameKey}`, applied.status === 'won')
      }
      return result
    },
    [submitGuess, play],
  )

  const [dismissedResult, setDismissedResult] = useState<string | null>(null)
  const finished = game.gameStatus !== 'playing'
  const showResult = finished && !revealing && dismissedResult !== gameId

  // Endless "Give up" asks first. Keyed by game, so switching modes or starting a new game drops a pending ask.
  const [giveUpAsk, setGiveUpAsk] = useState<string | null>(null)
  // Game whose locked Hard button was tapped: shows the "locked" note for that game only.
  const [lockNoteGame, setLockNoteGame] = useState<string | null>(null)
  const showGiveUp = giveUpAsk === gameId && game.canGiveUp
  const confirmGiveUp = () => {
    setGiveUpAsk(null)
    game.giveUp()
  }

  // First time Hard is switched on: explain it, once any open dialog (e.g. Help, where it can also be switched) closes.
  const hardNotice = useSyncExternalStore(subscribeHardPref, isHardNoticePending, () => false)
  const showHardNotice = hardNotice && !showHelp && !showHistory && !showResult && !showGiveUp && !revealing

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
        onHardLockedPress={() => setLockNoteGame(gameId)}
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
          {/* Only shown once the player taps the locked Hard button, so it doesn't cost two lines every game. */}
          {game.hardSwitchLocked && lockNoteGame === gameId && (
            <p id="hard-lock-note" role="status" className="max-w-md text-[8px] leading-4 text-ds-frame">
              Hard mode is locked for this game. It applies to your next Daily or a new Endless game.
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="ds-button bevel-paper h-11 px-3 text-[9px] sm:px-4 sm:text-[10px]"
            >
              History · Streak {stats.currentStreak}
            </button>
            {/* Phones have no room for this in the header; wide screens show it there. */}
            <HardToggle
              hard={hard}
              hardLocked={game.hardSwitchLocked}
              onLockedPress={() => setLockNoteGame(gameId)}
              className="inline-flex sm:hidden"
            />
          </div>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <SearchBar
            pokedex={POKEDEX}
            guessedIds={game.guesses.map((g) => g.id)}
            onGuess={onGuess}
            disabled={finished}
            doneText={game.gameStatus === 'lost' ? 'It got away!' : undefined}
          />
        </div>

        {game.canGiveUp && (
          <div className="flex justify-center">
            <button type="button" onClick={() => setGiveUpAsk(gameId)} className="ds-button bevel-paper px-4 text-[10px]">
              Give up
            </button>
          </div>
        )}

        {finished && !revealing && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setDismissedResult(null)}
              className="ds-button bevel-paper px-4 text-[10px]"
            >
              See results
            </button>
            {mode === 'endless' && (
              <button type="button" onClick={game.startNewEndlessGame} className="ds-button bevel-red px-4 text-[10px] text-ds-paper">
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
          gaveUp={game.gameStatus === 'lost'}
          onClose={() => setDismissedResult(gameId)}
          onNewGame={mode === 'endless' ? game.startNewEndlessGame : undefined}
        />
      )}
      {confetti && <Confetti onDone={endConfetti} />}
      {showGiveUp && (
        <GiveUpModal guesses={game.guesses.length} onConfirm={confirmGiveUp} onCancel={() => setGiveUpAsk(null)} />
      )}
      {showHistory && (
        <HistoryModal history={game.history} endless={game.endlessRecord} onClose={() => setShowHistory(false)} />
      )}
      {showHardNotice && <HardNotice appliesNow={game.guesses.length === 0} onDismiss={dismissHardNotice} />}
      {showHelp && <HelpModal onClose={closeHelp} hardLocked={game.hardSwitchLocked} gameHard={hard} />}
    </div>
  )
}
