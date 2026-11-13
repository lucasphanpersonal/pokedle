import { useCallback, useState, useSyncExternalStore } from 'react'
import { Confetti } from './components/Confetti'
import { GensModal } from './components/GensModal'
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
import { ALL_GENS, gensLabel, isAllGens } from './lib/gens'
import { computeStats } from './lib/history'
import { POKEDEX } from './lib/pokedex'
import { loadJson, saveJson } from './lib/storage'
import type { Pokemon } from './types/pokemon'

/** How many Pokémon each Gen has (index 0 = Gen 1), for the Endless Gen picker. */
const GEN_COUNTS = ALL_GENS.map((gen) => POKEDEX.filter((p) => p.generation === gen).length)

export default function App() {
  const [mode, setMode] = useState<GameMode>('daily')
  // Show the rules automatically on a player's first visit.
  const [showHelp, setShowHelp] = useState(() => loadJson('seen-help') !== true)
  const [showHistory, setShowHistory] = useState(false)
  const [showGens, setShowGens] = useState(false)
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

  // "Give up" (Daily and Endless) asks first. Keyed by game, so switching modes or starting a new game drops a pending ask.
  const [giveUpAsk, setGiveUpAsk] = useState<string | null>(null)
  // Which locked button (Hard or Gens) was tapped, and in which game: shows that "locked" note for that game only.
  const [lockNote, setLockNote] = useState<{ game: string; what: 'hard' | 'gens' | 'giveup' } | null>(null)
  const showGiveUp = giveUpAsk === gameId && game.canGiveUp
  const confirmGiveUp = () => {
    setGiveUpAsk(null)
    game.giveUp()
  }

  // First time Hard is switched on: explain it, once any open dialog (e.g. Help, where it can also be switched) closes.
  const hardNotice = useSyncExternalStore(subscribeHardPref, isHardNoticePending, () => false)
  const showHardNotice = hardNotice && !showHelp && !showHistory && !showGens && !showResult && !showGiveUp && !revealing

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
        onHardLockedPress={() => setLockNote({ game: gameId, what: 'hard' })}
      />
      <main className="mx-auto flex w-full max-w-5xl big:max-w-[80rem] flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="tx-10 sm:text-xs">
            {game.puzzleNumber !== null
              ? `Daily #${game.puzzleNumber}`
              : isAllGens(game.gameGens)
                ? 'Endless mode'
                : `Endless · ${gensLabel(game.gameGens)}`}
          </p>
          <p className="tx-9 text-ds-frame">
            {game.guesses.length} {game.guesses.length === 1 ? 'guess' : 'guesses'}
            {hard && ' · Hard mode'}
          </p>
          {/* Only shown once the player taps a locked Hard, Gens or Give up button, so it doesn't cost two lines every game. */}
          {/* Always mounted so screen readers announce the text when it appears. */}
          <div role="status" className="contents">
            {game.hardSwitchLocked && lockNote?.game === gameId && lockNote.what === 'hard' && (
              <p className="max-w-md tx-8 leading-4 text-ds-frame">
                Hard mode is locked for this game. It applies to your next Daily or a new Endless game.
              </p>
            )}
            {mode === 'endless' && game.hardSwitchLocked && lockNote?.game === gameId && lockNote.what === 'gens' && (
              <p className="max-w-md tx-8 leading-4 text-ds-frame">
                Gens are locked for this game, which was drawn from {gensLabel(game.gameGens)}. Change them after you catch it
                or give up, and they apply to your next Pokémon.
              </p>
            )}
            {!game.canGiveUp && game.gameStatus === 'playing' && lockNote?.game === gameId && lockNote.what === 'giveup' && (
              <p className="max-w-md tx-8 leading-4 text-ds-frame">Give up unlocks after your first guess.</p>
            )}
          </div>
          {/*
            Game menu, with Give up last (rightmost). Give up lives here, away from the guess box, so it is never
            next to the thing you tap most, and it is always shown (locked, with a note on tap, until the first guess) so nothing
            jumps when it becomes available. Phones: History on its own row, then the game's controls (Gens, Hard,
            Give up). Wider screens use one row and show Hard in the header.
          */}
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px]"
            >
              History · Streak {stats.currentStreak}
            </button>
            <div className="flex justify-center gap-2 sm:contents">
              {mode === 'endless' && (
                <button
                  type="button"
                  onClick={() => {
                    if (game.hardSwitchLocked) setLockNote({ game: gameId, what: 'gens' })
                    else setShowGens(true)
                  }}
                  aria-disabled={game.hardSwitchLocked || undefined}
                  title={
                    game.hardSwitchLocked
                      ? 'Gens are locked for this game. Change them after you catch it or give up.'
                      : `Endless picks from: ${gensLabel(game.endlessGens)}`
                  }
                  className={`ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px] ${
                    game.hardSwitchLocked ? 'cursor-not-allowed text-ds-frame' : ''
                  }`}
                >
                  Gens · {isAllGens(game.endlessGens) ? 'All' : `${game.endlessGens.length}/9`}
                </button>
              )}
              {/* Phones have no room for this in the header; wide screens show it there. */}
              <HardToggle
                hard={hard}
                hardLocked={game.hardSwitchLocked}
                onLockedPress={() => setLockNote({ game: gameId, what: 'hard' })}
                className="inline-flex sm:hidden"
              />
              <button
                type="button"
                // Locked like Hard and Gens (same look, focusable, explains itself on tap) rather than faded, so it keeps its contrast.
                // After the game ends it stays, locked, so the row doesn't shift; a tap then does nothing.
                onClick={() => {
                  if (game.canGiveUp) setGiveUpAsk(gameId)
                  else setLockNote({ game: gameId, what: 'giveup' })
                }}
                aria-disabled={!game.canGiveUp || undefined}
                title={game.canGiveUp ? 'Reveal the answer and end this game' : 'Give up unlocks after your first guess'}
                className={`ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px] ${
                  game.canGiveUp ? '' : 'cursor-not-allowed text-ds-frame'
                }`}
              >
                Give up
              </button>
            </div>
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
        <GiveUpModal mode={mode} guesses={game.guesses.length} streak={stats.currentStreak} onConfirm={confirmGiveUp} onCancel={() => setGiveUpAsk(null)} />
      )}
      {showHistory && (
        <HistoryModal history={game.history} endless={game.endlessRecord} onClose={() => setShowHistory(false)} />
      )}
      {showGens && mode === 'endless' && !game.hardSwitchLocked && (
        <GensModal
          gens={game.endlessGens}
          counts={GEN_COUNTS}
          gameStarted={game.guesses.length > 0}
          onSave={game.setEndlessGens}
          onClose={() => setShowGens(false)}
        />
      )}
      {showHardNotice && <HardNotice appliesNow={game.guesses.length === 0} onDismiss={dismissHardNotice} />}
      {showHelp && <HelpModal onClose={closeHelp} hardLocked={game.hardSwitchLocked} gameHard={hard} />}
    </div>
  )
}
