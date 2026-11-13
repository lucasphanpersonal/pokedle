import { puzzleNumber } from '../lib/daily'
import { computeEndlessStats, computeStats, type EndlessRecord, type HistoryEntry } from '../lib/history'
import { iconUrl, POKEDEX_BY_ID } from '../lib/pokedex'
import { Modal } from './Modal'
import { PixelStar } from './PixelStar'

interface HistoryModalProps {
  history: HistoryEntry[]
  /** Endless tally on this device: caught, given up and guess totals. */
  endless: EndlessRecord
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

/** Past Dailies solved on this device, with streaks and a few totals, plus Endless stats. */
export function HistoryModal({ history, endless, onClose }: HistoryModalProps) {
  const stats = computeStats(history)
  const endlessStats = computeEndlessStats(endless)
  const avg = (n: number | null) => (n === null ? '-' : n.toFixed(1))
  return (
    <Modal title="History" onClose={onClose}>
      <div className="space-y-4 tx-10 leading-5">
        <div className="grid grid-cols-6 gap-2">
          <Stat label="Streak" value={stats.currentStreak} />
          <Stat label="Best streak" value={stats.bestStreak} />
          <Stat label="Solved" value={stats.solved} />
          <Stat wide label="Avg guesses" value={avg(stats.averageGuesses)} />
          <Stat wide label="Fewest" value={stats.fewestGuesses ?? '-'} />
          {stats.gaveUp > 0 && <Stat full label="Dailies given up" value={stats.gaveUp} />}
        </div>

        {history.length === 0 ? (
          <p>No finished Dailies yet. Solve today's Pokémon and it will show up here.</p>
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
                    <div className="tx-9 text-ds-frame">
                      {puzzleNumber(h.date) >= 1 && `#${puzzleNumber(h.date)} · `}
                      <span className="whitespace-nowrap">{h.date}</span>
                      {h.hard && (
                        <span className="ml-2 inline-flex items-center gap-1 whitespace-nowrap">
                          <PixelStar />
                          Hard
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tx-9">
                    {h.lost && <div>Gave up</div>}
                    <div className={h.lost ? 'text-ds-frame' : undefined}>
                      {h.guesses} {h.guesses === 1 ? 'guess' : 'guesses'}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <section aria-labelledby="history-endless">
          <h3 id="history-endless" className="mb-2 tx-11">Endless</h3>
          <div className="grid grid-cols-6 gap-2">
            <Stat label="Played" value={endlessStats.played} />
            <Stat label="Caught" value={endlessStats.caught} />
            <Stat label="Gave up" value={endlessStats.gaveUp} />
            <Stat wide label="Avg guesses" value={avg(endlessStats.averageGuesses)} />
            <Stat wide label="Fewest" value={endlessStats.fewestGuesses ?? '-'} />
          </div>
        </section>
        <p className="tx-9 text-ds-frame">
          Saved on this device only: it doesn't carry over to other devices or browsers, and clearing site data erases it.
          Finished Dailies are listed, solved or given up. Missing a day, or giving up, resets your streak; the Daily average and fewest count solved games only. Endless games are counted when you catch
          the Pokémon or give up; the Endless average and fewest count caught games only.
        </p>
      </div>
    </Modal>
  )
}
