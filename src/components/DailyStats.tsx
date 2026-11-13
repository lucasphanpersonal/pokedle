import { useEffect, useState } from 'react'
import { fetchDailyStats, summarize, type DailyStatsResult } from '../lib/dailyStats'

/** Give the player's own result a moment to reach the server before we ask for totals. */
const FETCH_DELAY_MS = 1500

interface DailyStatsProps {
  /** Daily puzzle date, YYYY-MM-DD. */
  date: string
  /** Your guess count, or null if you gave up (then nothing is compared with your result). */
  guesses: number | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * "Today's stats" panel on the Daily result screen. It is always shown: while loading, when you are
 * the first to solve it, and with a short note if stats are switched off or can't be reached.
 */
export function DailyStats({ date, guesses }: DailyStatsProps) {
  // Tagged with what it was fetched for, so a new date or guess count shows "Counting" until it arrives.
  const key = `${date}:${guesses}`
  const [loaded, setLoaded] = useState<{ key: string; result: DailyStatsResult } | null>(null)
  const result = loaded?.key === key ? loaded.result : null

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const next = await fetchDailyStats(date, controller.signal)
      if (!controller.signal.aborted) setLoaded({ key: `${date}:${guesses}`, result: next })
    }, FETCH_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [date, guesses])

  const footnote = 'Anonymous totals, one per network a day.'
  let body
  if (result === null) {
    body = <p className="text-ds-frame">Counting today&apos;s players…</p>
  } else if (result.kind === 'off') {
    body = <p className="text-ds-frame">Switch on Share anonymous stats in How to play to compare with other players.</p>
  } else if (result.kind === 'error') {
    body = <p className="text-ds-frame">Today&apos;s stats can&apos;t be reached right now. Try again later.</p>
  } else {
    // Nobody counted yet means your own result hasn't reached the server: count it here so the chart shows your bar.
    const { stats } = result
    // A give up has no bar, so it only adds to the finished count.
    const counted =
      stats.finished === 0
        ? { ...stats, histogram: guesses === null ? {} : { [guesses]: 1 }, finished: 1 }
        : stats
    const summary = summarize(counted, guesses)
    const max = Math.max(...summary.bars.map((b) => b.count), 1)
    // Only claim "first" when the server counted nobody (your result was added above); one counted player may be someone else.
    const first = stats.finished === 0
    body = (
      <>
        {first && guesses === null ? (
          <p>Nobody has solved today&apos;s Pokémon yet. Check back later to see how other players do.</p>
        ) : summary.players === 0 ? (
          <p>Nobody has solved today&apos;s Pokémon yet.</p>
        ) : first ? (
          <>
            <p>You&apos;re the first to solve today&apos;s Pokémon!</p>
            <p className="text-ds-frame">Check back later to see how other players do.</p>
          </>
        ) : (
          <>
            <p>
              {plural(summary.players, 'player has', 'players have')} solved it, in{' '}
              {(summary.average ?? 0).toFixed(1)} guesses on average.
            </p>
            {guesses !== null && (
              <p className="text-ds-frame">
                {summary.fasterThanPercent > 0
                  ? `You were faster than ${summary.fasterThanPercent}% of players.`
                  : `${summary.samePercent}% of players needed ${plural(guesses, 'guess', 'guesses')} too.`}
              </p>
            )}
          </>
        )}
        {(summary.gaveUp > 0 || (!first && summary.hintPercent !== null)) && (
          <p className="text-ds-frame">
            {summary.gaveUp > 0 && `${plural(summary.gaveUp, 'player', 'players')} gave up. `}
            {!first &&
              summary.hintPercent !== null &&
              (summary.hintPercent > 0 ? `${summary.hintPercent}% used the Gen hint.` : 'Nobody has used the Gen hint yet.')}
          </p>
        )}
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
        <div className="flex gap-1 tx-8 text-ds-frame" aria-hidden="true">
          {summary.bars.map((bar) => (
            <span key={bar.label} className={`flex-1 text-center ${bar.isYou ? 'text-ds-ink underline underline-offset-2' : ''}`}>
              {bar.label}
            </span>
          ))}
        </div>
        <p className="mt-1 tx-8 text-ds-frame">Guesses to solve. {footnote}</p>
      </>
    )
  }

  return (
    <section aria-label="Today's stats" aria-live="polite" className="w-full border-t-2 border-ds-frame-light pt-3 tx-10 leading-5">
      <h3 className="mb-1 tx-11">Today&apos;s stats</h3>
      {body}
    </section>
  )
}
