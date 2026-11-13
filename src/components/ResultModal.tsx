import { useEffect, useState } from 'react'
import type { GuessFeedback } from '../lib/compare'
import type { GameMode } from '../lib/game'
import { iconUrl, spriteUrl } from '../lib/pokedex'
import type { Pokemon } from '../types/pokemon'
import { DailyStats } from './DailyStats'
import { DexEntryCard } from './DexEntryCard'
import { Modal } from './Modal'
import { PixelBulb } from './PixelBulb'

interface ResultModalProps {
  mode: GameMode
  target: Pokemon
  feedback: GuessFeedback[]
  /** Daily puzzle date (YYYY-MM-DD), for the global stats; ignored in Endless. */
  puzzleDate: string
  /** Current and best Daily streaks on this device. */
  streak: number
  bestStreak: number
  /** The Gen hint was taken in this game. */
  hinted: boolean
  /** The player gave up (Daily or Endless): the answer is revealed instead of caught. */
  gaveUp?: boolean
  onClose: () => void
  onNewGame?: () => void
}

function untilLocalMidnight(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const s = Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

function Countdown() {
  const [text, setText] = useState(untilLocalMidnight)
  useEffect(() => {
    const id = window.setInterval(() => setText(untilLocalMidnight()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return <span className="tabular-nums">{text}</span>
}

/** End-of-game screen: the answer's artwork, guess count, streak, daily stats and New Pokémon. */
export function ResultModal({ mode, target, feedback, puzzleDate, streak, bestStreak, hinted, gaveUp, onClose, onNewGame }: ResultModalProps) {
  const guessText = `${feedback.length} ${feedback.length === 1 ? 'guess' : 'guesses'}`
  return (
    <Modal title={gaveUp ? 'It got away!' : 'Gotcha!'} onClose={onClose}>
      <div className="flex flex-col items-center gap-4 text-center tx-10 leading-5">
        {/* The game's own pixel sprite, scaled up crisply; official artwork if a form has none. */}
        <img
          src={iconUrl(target.id)}
          alt={target.name}
          width={192}
          height={192}
          onError={(e) => {
            const img = e.currentTarget
            if (img.src !== spriteUrl(target.id)) img.src = spriteUrl(target.id)
          }}
          className="h-40 w-40 drop-shadow-[0_4px_0_rgb(0_0_0/0.15)] [image-rendering:pixelated] sm:h-48 sm:w-48"
        />
        {gaveUp ? (
          <p className="text-xs leading-6">
            It was <strong>{target.name}</strong>! You gave up after {guessText}.
          </p>
        ) : (
          <p className="text-xs leading-6">
            You caught <strong>{target.name}</strong> in {guessText}!
          </p>
        )}
        {hinted && (
          <p className="inline-flex items-center gap-1.5 border-2 border-ds-frame bg-ds-paper px-2 py-1 tx-9">
            <PixelBulb />
            Used the Gen hint
          </p>
        )}

        <DexEntryCard key={target.id} target={target} />

        {onNewGame && (
          <button type="button" onClick={onNewGame} className="ds-button bevel-red px-4 text-[10px] text-ds-paper">
            New Pokémon
          </button>
        )}

        {mode === 'daily' && (
          <p className="tx-10">
            Streak: <strong>{streak}</strong> {streak === 1 ? 'day' : 'days'} · Best: <strong>{bestStreak}</strong>
            {gaveUp && <span className="mt-1 block text-ds-frame">Giving up ends your streak.</span>}
          </p>
        )}

        {mode === 'daily' && <DailyStats date={puzzleDate} guesses={gaveUp ? null : feedback.length} />}

        {mode === 'daily' && (
          <p className="tx-9 text-ds-frame">
            Next daily Pokémon in <Countdown />
          </p>
        )}
      </div>
    </Modal>
  )
}
