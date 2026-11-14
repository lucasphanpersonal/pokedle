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
import { PixelGear } from './components/PixelGear'
import { ResultModal } from './components/ResultModal'
import { SearchBar } from './components/SearchBar'
import { useAnalytics } from './hooks/useAnalytics'
import { useRevealEffects } from './hooks/useRevealEffects'
import { usePokemondle, type GameMode, type GuessResult } from './hooks/usePokemondle'
import { ALL_GENS, gensLabel } from './lib/gens'
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
  // The game whose locked Give up button was tapped: shows its "locked" note for that game only.
  const [lockNote, setLockNote] = useState<string | null>(null)
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
          {mode === 'endless' ? (
            // The title names the Gens this game was drawn from, in its own box (the guess box's look); the gear,
            // a smaller box inside it like the Guess button in the guess box, opens the Gens picker (view-only
            // mid-game, since the game keeps its Gens).
            <div className="ds-box flex max-w-full items-center gap-2 p-2 pl-4">
              <p className="tx-10 leading-4 sm:text-xs">Endless · {gensLabel(game.gameGens)}</p>
              <button
                type="button"
                onClick={() => setShowGens(true)}
                aria-label="Endless Gens settings"
                title={game.inProgress ? 'Gens for this game' : 'Choose which Gens Endless picks from'}
                className="ds-button bevel-paper flex h-11 w-11 shrink-0 items-center justify-center text-ds-ink"
              >
                <PixelGear />
              </button>
            </div>
          ) : (
            <p className="tx-10 sm:text-xs">Daily #{game.puzzleNumber}</p>
          )}
          <p className="tx-9 text-ds-frame">
            {game.guesses.length} {game.guesses.length === 1 ? 'guess' : 'guesses'}
          </p>
          {/* Only shown once the player taps the locked Give up button, so it doesn't cost a line every game. */}
          {/* Always mounted so screen readers announce the text when it appears. */}
          <div role="status" className="contents">
            {!game.canGiveUp && game.gameStatus === 'playing' && lockNote === gameId && (
              <p className="max-w-md tx-8 leading-4 text-ds-frame">Give up unlocks after your first guess.</p>
            )}
          </div>
          {/*
            Game menu: the Gen hint and Give up (Endless's Gens settings are the gear in the title box). Give up sits beside the hint, away from the guess box,
            so the thing you tap most is never next to the one that ends the game. It is shown all game (locked, with a
            note on tap, until the first guess) and gone once the game is over and its tiles have flipped. History and the streak are not here:
            they belong to the end of a game, so they live on the result screen. The row wraps on narrow phones.
          */}
          {(canHint || showHint || game.gameStatus === 'playing' || revealing) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
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
              {/* Kept (locked) while the last guess's tiles flip, so the row doesn't vanish mid-reveal. */}
              {(game.gameStatus === 'playing' || revealing) && (
                <button
                  type="button"
                  // Locked (same look, focusable, explains itself on tap) rather than faded, so it keeps its contrast.
                  onClick={() => {
                    if (game.canGiveUp) setGiveUpAsk(gameId)
                    else setLockNote(gameId)
                  }}
                  aria-disabled={!game.canGiveUp || undefined}
                  title={game.canGiveUp ? 'Reveal the answer and end this game' : 'Give up unlocks after your first guess'}
                  className={`ds-button bevel-paper h-11 whitespace-nowrap px-3 text-[9px] sm:px-4 sm:text-[10px] ${
                    game.canGiveUp ? '' : 'cursor-not-allowed text-ds-frame'
                  }`}
                >
                  Give up
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-xl">
          <SearchBar
            pokedex={POKEDEX}
            guessedIds={game.guesses.map((g) => g.id)}
            onGuess={onGuess}
            disabled={finished}
            doneText={game.gameStatus === 'lost' ? 'It got away!' : undefined}
            // Once the tiles have flipped, the Guess button's spot reopens the result screen; in Endless, New Pokémon
            // joins it. Red marks the main action, so in Endless that is New Pokémon and See results turns white.
            doneAction={
              finished && !revealing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setDismissedResult(null)}
                    className={`ds-button whitespace-nowrap px-3 text-[10px] ${mode === 'endless' ? 'bevel-paper' : 'bevel-red text-ds-paper'}`}
                  >
                    See results
                  </button>
                  {mode === 'endless' && (
                    <button type="button" onClick={game.startNewEndlessGame} className="ds-button bevel-red whitespace-nowrap px-3 text-[10px] text-ds-paper">
                      New Pokémon
                    </button>
                  )}
                </>
              ) : undefined
            }
            doneWide={mode === 'endless'}
          />
        </div>

        {/* Remount per game so only guesses made now animate. */}
        <GuessGrid key={gameId} guesses={game.guesses} feedback={game.feedback} />
      </main>

      {/* History opens from the result screen and hides it meanwhile; closing History brings the result back. */}
      {showResult && !showHistory && (
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
          onHistory={() => setShowHistory(true)}
          onNewGame={mode === 'endless' ? game.startNewEndlessGame : undefined}
        />
      )}
      {capture && <CaptureScene key={capture.gameId} kind={capture.kind} pokemon={capture.pokemon} onDone={endCapture} />}
      {confetti && <Confetti onDone={endConfetti} />}
      {showGiveUp && (
        <GiveUpModal mode={mode} guesses={game.guesses.length} streak={stats.currentStreak} onConfirm={confirmGiveUp} onCancel={() => setGiveUpAsk(null)} />
      )}
      {showHistory && (
        <HistoryModal
          key={mode}
          history={game.history}
          endless={game.endlessRecord}
          endlessGames={game.endlessGames}
          initialMode={mode}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showGens && mode === 'endless' && (
        <GensModal
          // Mid-game the box only shows the Gens this game was drawn from; they can change once it is over.
          gens={game.inProgress ? game.gameGens : game.endlessGens}
          locked={game.inProgress}
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
