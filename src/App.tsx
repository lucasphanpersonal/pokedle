import { useCallback, useState } from 'react'
import { CaptureScene } from './components/CaptureScene'
import { Confetti } from './components/Confetti'
import { GensModal } from './components/GensModal'
import { GiveUpModal } from './components/GiveUpModal'
import { GuessGrid } from './components/GuessGrid'
import { Header } from './components/Header'
import { HelpModal } from './components/HelpModal'
import { HintPrompt } from './components/HintPrompt'
import { HistoryModal } from './components/HistoryModal'
import { PixelBulb } from './components/PixelBulb'
import { ResultModal } from './components/ResultModal'
import { SearchBar } from './components/SearchBar'
import { useAnalytics } from './hooks/useAnalytics'
import { useRevealEffects } from './hooks/useRevealEffects'
import { usePokemondle, type GameMode, type GuessResult } from './hooks/usePokemondle'
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

  const { revealing, capture, endCapture, confetti, endConfetti, play, escape } = useRevealEffects(gameId)
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
  // Which locked button (Gens or Give up) was tapped, and in which game: shows that "locked" note for that game only.
  const [lockNote, setLockNote] = useState<{ game: string; what: 'gens' | 'giveup' } | null>(null)
  const showGiveUp = giveUpAsk === gameId && game.canGiveUp
  const confirmGiveUp = () => {
    setGiveUpAsk(null)
    game.giveUp()
    // The ball bursts and the answer runs off before the result screen.
    escape(game.targetPokemon, gameId)
  }

  // The Gen hint. It is pointless when the answer can only come from one Gen (an Endless game limited to one).
  const hintUseful = game.gameGens.length > 1
  const canHint = game.canTakeHint && hintUseful
  const showHint = game.hinted && hintUseful
  // It pops up once per game, after the guess that makes it available has flipped in; after that it is a button.
  // Remembered per mode (the game it was last offered in), so switching modes doesn't offer it again.
  const [hintOffered, setHintOffered] = useState<Record<string, unknown>>(() => {
    const raw = loadJson('hint-offered')
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  })
  const showHintPrompt =
    canHint && hintOffered[mode] !== gameId && !showHelp && !showHistory && !showGens && !showGiveUp && !revealing
  const [hintPromptOpen, setHintPromptOpen] = useState<string | null>(null)
  const closeHintPrompt = () => {
    setHintPromptOpen(null)
    const next = { ...hintOffered, [mode]: gameId }
    setHintOffered(next)
    saveJson('hint-offered', next)
  }
  // Opened from the Gen hint button, or kept open (for its "from Gen N" reply) once the hint is taken.
  const hintPromptShown = showHintPrompt || hintPromptOpen === gameId
  const takeHint = () => {
    setHintPromptOpen(gameId)
    game.takeHint()
  }

  const closeHelp = () => {
    setShowHelp(false)
    saveJson('seen-help', true)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header mode={mode} onModeChange={setMode} onHelp={() => setShowHelp(true)} />
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
          </p>
          {/* Only shown once the player taps the locked Gens or Give up button, so it doesn't cost two lines every game. */}
          {/* Always mounted so screen readers announce the text when it appears. */}
          <div role="status" className="contents">
            {mode === 'endless' && game.inProgress && lockNote?.game === gameId && lockNote.what === 'gens' && (
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
            Game menu. Give up lives here, away from the guess box, so the thing you tap most is never next to the
            one that ends the game. It is always shown (locked, with a note on tap, until the first guess) so nothing
            jumps when it becomes available. Phones: History and Give up, then Gens and Gen hint when there are any.
            Wider screens: one row, Give up last.
          */}
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
            <div className="flex justify-center gap-2 sm:contents">
              <button
                type="button"
                onClick={() => setShowHistory(true)}
                className="ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px]"
              >
                History · Streak {stats.currentStreak}
              </button>
              <button
                type="button"
                // Locked like Gens (same look, focusable, explains itself on tap) rather than faded, so it keeps its contrast.
                // After the game ends it stays, locked, so the row doesn't shift; a tap then does nothing.
                onClick={() => {
                  if (game.canGiveUp) setGiveUpAsk(gameId)
                  else setLockNote({ game: gameId, what: 'giveup' })
                }}
                aria-disabled={!game.canGiveUp || undefined}
                title={game.canGiveUp ? 'Reveal the answer and end this game' : 'Give up unlocks after your first guess'}
                className={`ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:order-last sm:px-4 sm:text-[10px] ${
                  game.canGiveUp ? '' : 'cursor-not-allowed text-ds-frame'
                }`}
              >
                Give up
              </button>
            </div>
            {(mode === 'endless' || canHint || showHint) && (
              <div className="flex justify-center gap-2 sm:contents">
                {mode === 'endless' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (game.inProgress) setLockNote({ game: gameId, what: 'gens' })
                      else setShowGens(true)
                    }}
                    aria-disabled={game.inProgress || undefined}
                    title={
                      game.inProgress
                        ? 'Gens are locked for this game. Change them after you catch it or give up.'
                        : `Endless picks from: ${gensLabel(game.endlessGens)}`
                    }
                    className={`ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px] ${
                      game.inProgress ? 'cursor-not-allowed text-ds-frame' : ''
                    }`}
                  >
                    Gens · {isAllGens(game.endlessGens) ? 'All' : `${game.endlessGens.length}/9`}
                  </button>
                )}
                {canHint && (
                  <button
                    type="button"
                    onClick={() => setHintPromptOpen(gameId)}
                    className="ds-button bevel-paper inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px]"
                  >
                    <PixelBulb />
                    Gen hint
                  </button>
                )}
                {/* Once taken, the hint button stays in its place pressed in (the "on" look) and shows the Gen. */}
                {showHint && (
                  <p className="ds-button bevel-paper bevel-pressed inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px]">
                    <PixelBulb />
                    <span aria-hidden="true">Hint · Gen {game.targetPokemon.generation}</span>
                    <span className="sr-only">Hint: the answer is from Gen {game.targetPokemon.generation}</span>
                  </p>
                )}
              </div>
            )}
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
        <GuessGrid key={gameId} guesses={game.guesses} feedback={game.feedback} />
      </main>

      {showResult && (
        <ResultModal
          mode={mode}
          target={game.targetPokemon}
          feedback={game.feedback}
          puzzleDate={game.gameKey}
          streak={stats.currentStreak}
          bestStreak={stats.bestStreak}
          hinted={game.hinted}
          gaveUp={game.gameStatus === 'lost'}
          onClose={() => setDismissedResult(gameId)}
          onNewGame={mode === 'endless' ? game.startNewEndlessGame : undefined}
        />
      )}
      {capture && <CaptureScene key={capture.gameId} kind={capture.kind} pokemon={capture.pokemon} onDone={endCapture} />}
      {confetti && <Confetti onDone={endConfetti} />}
      {showGiveUp && (
        <GiveUpModal mode={mode} guesses={game.guesses.length} streak={stats.currentStreak} onConfirm={confirmGiveUp} onCancel={() => setGiveUpAsk(null)} />
      )}
      {showHistory && (
        <HistoryModal history={game.history} endless={game.endlessRecord} onClose={() => setShowHistory(false)} />
      )}
      {showGens && mode === 'endless' && !game.inProgress && (
        <GensModal
          gens={game.endlessGens}
          counts={GEN_COUNTS}
          gameStarted={game.guesses.length > 0}
          onSave={game.setEndlessGens}
          onClose={() => setShowGens(false)}
        />
      )}
      {hintPromptShown && (
        <HintPrompt
          key={gameId}
          gen={game.targetPokemon.generation}
          guesses={game.guesses.length}
          onTake={takeHint}
          onClose={closeHintPrompt}
        />
      )}
      {showHelp && <HelpModal onClose={closeHelp} />}
    </div>
  )
}
