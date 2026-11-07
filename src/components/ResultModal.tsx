import { useEffect, useState } from 'react'
import { SHARE_URL_FALLBACK } from '../config/uiConfig'
import type { GuessFeedback } from '../lib/compare'
import type { GameMode, GameStatus } from '../lib/game'
import { spriteUrl } from '../lib/pokedex'
import { buildShareText, shareResult, shareRow, type ShareOutcome } from '../lib/share'
import type { Pokemon } from '../types/pokemon'
import { Modal } from './Modal'

interface ResultModalProps {
  mode: GameMode
  status: Exclude<GameStatus, 'playing'>
  target: Pokemon
  feedback: GuessFeedback[]
  maxGuesses: number
  puzzleNumber: number | null
  onClose: () => void
  onNewGame?: () => void
}

function shareUrl(): string {
  if (typeof window === 'undefined' || !window.location.protocol.startsWith('http')) return SHARE_URL_FALLBACK
  const { origin, pathname } = window.location
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return SHARE_URL_FALLBACK
  return `${origin}${pathname}`
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

const OUTCOME_TEXT: Record<ShareOutcome, string> = {
  shared: 'Shared!',
  copied: 'Copied to clipboard!',
  failed: "Couldn't share. Try again.",
}

/** End-of-game screen: the answer's artwork, score, emoji grid and Share. */
export function ResultModal({ mode, status, target, feedback, maxGuesses, puzzleNumber, onClose, onNewGame }: ResultModalProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const won = status === 'won'
  const text = buildShareText({ mode, puzzleNumber, status, feedback, maxGuesses, url: shareUrl() })

  return (
    <Modal title={won ? 'Gotcha!' : 'Out of guesses!'} onClose={onClose}>
      <div className="flex flex-col items-center gap-4 text-center text-[10px] leading-5">
        <img
          src={spriteUrl(target.id)}
          alt={target.name}
          width={160}
          height={160}
          className="h-36 w-36 drop-shadow-[0_4px_0_rgb(0_0_0/0.15)] sm:h-40 sm:w-40"
        />
        <p className="text-xs leading-6">
          {won ? (
            <>
              You caught <strong>{target.name}</strong> in {feedback.length} {feedback.length === 1 ? 'guess' : 'guesses'}!
            </>
          ) : (
            <>
              It was <strong>{target.name}</strong>.
            </>
          )}
        </p>

        <pre aria-label="Your result grid" className="font-sans text-base leading-5 tracking-tight">
          {feedback.map(shareRow).join('\n')}
        </pre>

        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={async () => setOutcome(await shareResult(text))}
            className="ds-button flex-1 bg-fb-match px-4 text-[10px] text-white"
          >
            Share
          </button>
          {onNewGame && (
            <button type="button" onClick={onNewGame} className="ds-button flex-1 bg-ds-paper px-4 text-[10px]">
              New Pokémon
            </button>
          )}
        </div>
        <p role="status" className="min-h-5 text-[9px] text-ds-frame">
          {outcome && OUTCOME_TEXT[outcome]}
        </p>

        {mode === 'daily' && (
          <p className="text-[9px] text-ds-frame">
            Next daily Pokémon in <Countdown />
          </p>
        )}
      </div>
    </Modal>
  )
}
