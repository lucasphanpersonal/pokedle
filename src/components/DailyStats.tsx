import { useEffect, useState } from 'react'
import { fetchDailyStats, summarize, type DailyStatsSummary } from '../lib/dailyStats'

/** Give the player's own result a moment to reach the server before we ask for totals. */
const FETCH_DELAY_MS = 1500

interface DailyStatsProps {
  /** Daily puzzle date, YYYY-MM-DD. */
  date: string
  guesses: number
}

/** "Today's stats" panel on the Daily result screen. Renders nothing if stats can't be loaded. */
export function DailyStats({ date, guesses }: DailyStatsProps) {
  const [summary, setSummary] = useState<DailyStatsSummary | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const stats = await fetchDailyStats(date, controller.signal)
      if (stats && !controller.signal.aborted) setSummary(summarize(stats, guesses))
    }, FETCH_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [date, guesses])

  if (!summary) return null
  const max = Math.max(...summary.bars.map((b) => b.count), 1)
  const rank =
    summary.fasterThanPercent > 0
      ? `You were faster than ${summary.fasterThanPercent}% of players.`
      : `${summary.samePercent}% of players needed ${guesses === 1 ? '1 guess' : `${guesses} guesses`} too.`

  return (
    <section aria-label="Today's stats" className="w-full border-t-2 border-ds-frame-light pt-3 text-[10px] leading-5">
      <h3 className="mb-1 text-[11px]">Today&apos;s stats</h3>
      <p>
        {summary.players} {summary.players === 1 ? 'player has' : 'players have'} solved it, in{' '}
        {summary.average.toFixed(1)} guesses on average.
      </p>
      <p className="text-ds-frame">{rank}</p>
      <div className="mt-2 flex h-16 items-end gap-1" aria-hidden="true">
        {summary.bars.map((bar) => (
          <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div
              className={`w-full ${bar.isYou ? 'bg-fb-match' : 'bg-ds-frame-light'}`}
              style={{ height: `${Math.max(bar.count > 0 ? 6 : 0, (bar.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1 text-[8px] text-ds-frame" aria-hidden="true">
        {summary.bars.map((bar) => (
          <span key={bar.label} className="flex-1 text-center">
            {bar.label}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[8px] text-ds-frame">Guesses to solve. Anonymous totals from players sharing stats.</p>
    </section>
  )
}
