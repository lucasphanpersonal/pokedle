import { useState } from 'react'
import { puzzleNumber } from '../lib/daily'
import type { GameMode } from '../lib/game'
import {
  computeEndlessStats,
  computeStats,
  ENDLESS_GAMES_KEPT,
  type EndlessGameEntry,
  type EndlessRecord,
  type HistoryEntry,
} from '../lib/history'
import { iconUrl, POKEDEX_BY_ID } from '../lib/pokedex'
import { Modal } from './Modal'
import { PixelBulb } from './PixelBulb'

interface HistoryModalProps {
  history: HistoryEntry[]
  /** Endless tally on this device: caught, given up and guess totals. */
  endless: EndlessRecord
  /** The last few Endless games, newest first. */
  endlessGames: EndlessGameEntry[]
  /** The mode it opens on: the one being played. A switch at the top shows the other. */
  initialMode: GameMode
  onClose: () => void
}

function Stat({ label, value, wide, full }: { label: string; value: string | number; wide?: boolean; full?: boolean }) {
  return (
    <div className={`${full ? 'col-span-6' : wide ? 'col-span-3' : 'col-span-2'} border-2 border-ds-frame bg-ds-paper px-1 py-2 text-center`}>
      <div className="text-sm leading-5">{value}</div>
      <div className="tx-9 leading-4 text-ds-frame">{label}</div>
    </div>
  )
}

/** "80% of wins without a hint", once there is a win to count. */
function NoHintLine({ percent, className = '' }: { percent: number | null; className?: string }) {
  if (percent === null) return null
  return (
    <p className={`flex items-center justify-center gap-1.5 tx-9 text-ds-frame ${className}`}>
      <PixelBulb />
      {percent}% of wins without a hint
    </p>
  )
}

/** One past game in a list: sprite, name, a detail line, and the result on the right. */
function GameRow({ targetId, detail, hinted, lost, lostText, guesses }: {
  targetId: number
  detail: string
  hinted?: boolean
  lost?: boolean
  lostText: string
  guesses: number
}) {
  const name = POKEDEX_BY_ID.get(targetId)?.name ?? `#${targetId}`
  return (
    <li className="flex items-center gap-3 py-1">
      <img
        src={iconUrl(targetId)}
        alt=""
        width={40}
        height={40}
        loading="lazy"
        className="h-10 w-10 shrink-0 [image-rendering:pixelated]"
      />
      <div className="min-w-0 flex-1">
        {/* Long form names wrap rather than being cut off. */}
        <div className="[overflow-wrap:anywhere]">{name}</div>
        <div className="tx-9 text-ds-frame">
          <span className="whitespace-nowrap">{detail}</span>
          {hinted && (
            <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap">
              <PixelBulb />
              Hint
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right tx-9">
        {lost && <div>{lostText}</div>}
        <div className={lost ? 'text-ds-frame' : undefined}>
          {guesses} {guesses === 1 ? 'guess' : 'guesses'}
        </div>
      </div>
    </li>
  )
}

/** "Nov 13" in the player's own locale and time zone, from an Endless game's ISO start time. */
function shortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * History for this device, one mode at a time: it opens on the mode being played, and a Daily / Endless switch
 * (the header's segmented look: the chosen side green and pressed in) shows the other.
 */
export function HistoryModal({ history, endless, endlessGames, initialMode, onClose }: HistoryModalProps) {
  const [view, setView] = useState<GameMode>(initialMode)
  const stats = computeStats(history)
  const endlessStats = computeEndlessStats(endless)
  const avg = (n: number | null) => (n === null ? '-' : n.toFixed(1))
  const winRate = endlessStats.played ? `${Math.round((endlessStats.caught / endlessStats.played) * 100)}%` : '-'
  return (
    <Modal title="History" onClose={onClose}>
      <div className="space-y-4 tx-10 leading-5">
        <div
          className="px-notch flex h-11"
          role="radiogroup"
          aria-label="Show history for"
          onKeyDown={(e) => {
            if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
            e.preventDefault()
            const next = view === 'daily' ? 'endless' : 'daily'
            setView(next)
            e.currentTarget.querySelector<HTMLElement>(`[data-view="${next}"]`)?.focus()
          }}
        >
          {(['daily', 'endless'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              data-view={m}
              aria-checked={view === m}
              tabIndex={view === m ? 0 : -1}
              onClick={() => setView(m)}
              className={`bevel ds-focus-inset h-full flex-1 px-2.5 text-[10px] uppercase ${m === 'endless' ? '-ml-[2px]' : ''} ${
                view === m ? 'bevel-green bevel-pressed text-white [text-shadow:1px_1px_0_rgb(0_0_0/0.4)]' : 'bevel-paper text-ds-ink'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {view === 'daily' ? (
          <>
            <div className="grid grid-cols-6 gap-2">
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Best streak" value={stats.bestStreak} />
              <Stat label="Solved" value={stats.solved} />
              <Stat wide label="Avg guesses" value={avg(stats.averageGuesses)} />
              <Stat wide label="Fewest" value={stats.fewestGuesses ?? '-'} />
              {stats.gaveUp > 0 && <Stat full label="Dailies given up" value={stats.gaveUp} />}
            </div>
            <NoHintLine percent={stats.noHintPercent} className="!mt-2" />
            {history.length === 0 ? (
              <p>No finished Dailies yet. Solve today's Pokémon and it will show up here.</p>
            ) : (
              <ul className="divide-y-2 divide-ds-frame-light border-y-2 border-ds-frame-light">
                {history.map((h) => (
                  <GameRow
                    key={h.date}
                    targetId={h.targetId}
                    detail={`${puzzleNumber(h.date) >= 1 ? `#${puzzleNumber(h.date)} · ` : ''}${h.date}`}
                    hinted={h.hinted}
                    lost={h.lost}
                    lostText="Gave up"
                    guesses={h.guesses}
                  />
                ))}
              </ul>
            )}
            <p className="tx-9 text-ds-frame">
              Saved on this device only: it doesn't carry over to other devices or browsers, and clearing site data erases
              it. Missing a day or giving up resets your streak; the average and fewest count solved Dailies only. Games
              where you took the Gen hint still count as wins and keep your streak; they are marked with a bulb.
            </p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-6 gap-2">
              <Stat label="Played" value={endlessStats.played} />
              <Stat label="Caught" value={endlessStats.caught} />
              <Stat label="Escaped" value={endlessStats.gaveUp} />
              <Stat label="Win rate" value={winRate} />
              <Stat label="Avg guesses" value={avg(endlessStats.averageGuesses)} />
              <Stat label="Fewest" value={endlessStats.fewestGuesses ?? '-'} />
            </div>
            <NoHintLine percent={endlessStats.noHintPercent} className="!mt-2" />
            {endlessGames.length === 0 ? (
              <p>No finished Endless games yet. Catch a Pokémon (or let one escape) and it will show up here.</p>
            ) : (
              <ul className="divide-y-2 divide-ds-frame-light border-y-2 border-ds-frame-light">
                {endlessGames.map((g) => (
                  <GameRow
                    key={g.key}
                    targetId={g.targetId}
                    detail={shortDate(g.key)}
                    hinted={g.hinted}
                    lost={g.lost}
                    lostText="Escaped"
                    guesses={g.guesses}
                  />
                ))}
              </ul>
            )}
            <p className="tx-9 text-ds-frame">
              Saved on this device only. A game counts when you catch the Pokémon or give up (it escapes); the average and
              fewest count caught games only. The list shows your last {ENDLESS_GAMES_KEPT} games.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}
