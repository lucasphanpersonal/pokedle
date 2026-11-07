import { useEffect, useState } from 'react'
import { SHARE_URL_FALLBACK } from '../config/uiConfig'
import type { GuessFeedback } from '../lib/compare'
import type { GameMode } from '../lib/game'
import { iconUrl, spriteUrl } from '../lib/pokedex'
import { buildShareText, shareResult, shareRow, type ShareOutcome } from '../lib/share'
import type { Pokemon } from '../types/pokemon'
import { Modal } from './Modal'

interface ResultModalProps {
  mode: GameMode
  target: Pokemon
  feedback: GuessFeedback[]
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
  cancelled: '',
  failed: "Couldn't share. Try again.",
}

/** End-of-game screen: the answer's artwork, score, emoji grid and Share. */
export function ResultModal({ mode, target, feedback, puzzleNumber, onClose, onNewGame }: ResultModalProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const text = buildShareText({ mode, puzzleNumber, feedback, url: shareUrl() })

  return (
    <Modal title="Gotcha!" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 text-center text-[10px] leading-5">
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
        <p className="text-xs leading-6">
          You caught <strong>{target.name}</strong> in {feedback.length} {feedback.length === 1 ? 'guess' : 'guesses'}!
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
