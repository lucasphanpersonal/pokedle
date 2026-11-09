import { puzzleNumber } from '../lib/daily'
import { computeStats, type HistoryEntry } from '../lib/history'
import { iconUrl, POKEDEX_BY_ID } from '../lib/pokedex'
import { Modal } from './Modal'
import { PixelStar } from './PixelStar'

interface HistoryModalProps {
  history: HistoryEntry[]
  onClose: () => void
}

function Stat({ label, value, wide }: { label: string; value: string | number; wide?: boolean }) {
  return (
    <div className={`${wide ? 'col-span-3' : 'col-span-2'} border-2 border-ds-frame bg-ds-paper px-1 py-2 text-center`}>
      <div className="text-sm leading-5">{value}</div>
      <div className="text-[9px] leading-4 text-ds-frame">{label}</div>
    </div>
  )
}

/** Past Dailies solved on this device, with streaks and a few totals. */
export function HistoryModal({ history, onClose }: HistoryModalProps) {
  const stats = computeStats(history)
  return (
    <Modal title="History" onClose={onClose}>
      <div className="space-y-4 text-[10px] leading-5">
        <div className="grid grid-cols-6 gap-2">
          <Stat label="Streak" value={stats.currentStreak} />
          <Stat label="Best streak" value={stats.bestStreak} />
          <Stat label="Solved" value={stats.solved} />
          <Stat wide label="Avg guesses" value={stats.averageGuesses === null ? '-' : stats.averageGuesses.toFixed(1)} />
          <Stat wide label="Fewest" value={stats.fewestGuesses ?? '-'} />
        </div>

        {history.length === 0 ? (
          <p>No solved Dailies yet. Solve today's Pokémon and it will show up here.</p>
        ) : (
          <ul className="divide-y-2 divide-ds-frame-light border-y-2 border-ds-frame-light">
            {history.map((h) => {
              const name = POKEDEX_BY_ID.get(h.targetId)?.name ?? `#${h.targetId}`
              return (
                <li key={h.date} className="flex items-center gap-3 py-1">
                  <img
                    src={iconUrl(h.targetId)}
                    alt=""
                    width={40}
                    height={40}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 [image-rendering:pixelated]"
                  />
                  <div className="min-w-0 flex-1">
                    {/* Long form names wrap rather than being cut off. */}
                    <div className="[overflow-wrap:anywhere]">{name}</div>
                    <div className="text-[9px] text-ds-frame">
                      #{puzzleNumber(h.date)} · {h.date}
                      {h.hard && (
                        <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap">
                          <PixelStar />
                          Hard
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[9px]">
                    {h.guesses} {h.guesses === 1 ? 'guess' : 'guesses'}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-[9px] text-ds-frame">
          Saved on this device only: it doesn't carry over to other devices or browsers, and clearing site data erases it.
          Only solved Dailies are listed, and missing a day resets your streak.
        </p>
      </div>
    </Modal>
  )
}
