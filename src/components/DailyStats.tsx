import { useEffect, useState } from 'react'
import { fetchDailyStats, HISTOGRAM_CAP, summarize, type DailyStatsResult, type DailyStatsSummary } from '../lib/dailyStats'

/** Give the player's own result a moment to reach the server before we ask for totals. */
const FETCH_DELAY_MS = 1500

interface DailyStatsProps {
  /** Daily puzzle date, YYYY-MM-DD. */
  date: string
  /** Your guess count, or null if you gave up (then nothing is compared with your result). */
  guesses: number | null
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Empty bars (and their labels), drawn while loading or when there is nothing to show, so the chart keeps its place. */
const EMPTY_BARS: DailyStatsSummary['bars'] = Array.from({ length: HISTOGRAM_CAP }, (_, i) => ({
  label: i + 1 === HISTOGRAM_CAP ? `${i + 1}+` : String(i + 1),
  count: 0,
  isYou: false,
}))

/** One number in the row of totals, framed like History's stat boxes. */
function Stat({ label, value, fade }: { label: string; value: string; fade: boolean }) {
  return (
    <div className="border-2 border-ds-frame bg-ds-paper px-1 py-2 text-center">
      <div className={`tx-14 leading-5 ${fade ? 'fade-in' : 'text-ds-frame'}`}>
        {value === '-' ? (
          <>
            <span aria-hidden="true">-</span>
            <span className="sr-only">not counted yet</span>
          </>
        ) : (
          value
        )}
      </div>
      <div className="tx-9 leading-4 text-ds-frame">{label}</div>
    </div>
  )
}

/**
 * "Today's stats" panel on the Daily result screen. It is always shown, and always the same shape:
 * a row of four totals, one reserved line of text, the guesses chart and its caption. While the totals
 * load (and if stats are off or can't be reached) the boxes show "-" and the chart is empty, so when
 * the numbers arrive they fade in where they belong and nothing on the result screen moves.
 */
export function DailyStats({ date, guesses }: DailyStatsProps) {
  // Tagged with what it was fetched for, so a new date or guess count shows the empty panel until it arrives.
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

  let summary: DailyStatsSummary | null = null
  let first = false
  let line: string
  if (result === null) {
    line = 'Counting today’s players…'
  } else if (result.kind === 'off') {
    line = 'Stats sharing is off (see How to play).'
  } else if (result.kind === 'error') {
    line = 'Today’s stats can’t be reached right now.'
  } else {
    // Nobody counted yet means your own result hasn't reached the server: count it here so the chart shows your bar.
    const { stats } = result
    first = stats.finished === 0
    // A give up has no bar, so it only adds to the finished count.
    const counted = first ? { ...stats, histogram: guesses === null ? {} : { [guesses]: 1 }, finished: 1 } : stats
    summary = summarize(counted, guesses)
    if (summary.players === 0) line = 'Nobody has solved today’s Pokémon yet.'
    // Only claim "first" when the server counted nobody (your result was added above); one counted player may be someone else.
    else if (first) line = 'You’re the first to solve today’s Pokémon!'
    else if (guesses === null) line = 'Check back tomorrow for a new Pokémon.'
    else if (summary.fasterThanPercent > 0) line = `You were faster than ${summary.fasterThanPercent}% of players.`
    else line = `${summary.samePercent}% of players needed ${plural(guesses, 'guess', 'guesses')} too.`
  }

  const ready = summary !== null
  const bars = summary?.bars ?? EMPTY_BARS
  const max = Math.max(...bars.map((b) => b.count), 1)
  const dash = '-'
  const hint = summary === null || summary.hintPercent === null || first ? dash : `${summary.hintPercent}%`

  return (
    <section aria-label="Today's stats" className="w-full border-t-2 border-ds-frame-light pt-3 tx-10 leading-5">
      <h3 className="mb-2 tx-11">Today&apos;s stats</h3>
      {/* Two by two on phones, one row from 640px. Same boxes before and after loading, so the height never changes. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Solved" value={summary ? String(summary.players) : dash} fade={ready} />
        <Stat label="Avg guesses" value={summary?.average != null ? summary.average.toFixed(1) : dash} fade={ready} />
        <Stat label="Gave up" value={summary ? String(summary.gaveUp) : dash} fade={ready} />
        <Stat label="Used hint" value={hint} fade={ready} />
      </div>
      {/* One message, two lines' room held for it (three on phones with Larger text), announced when it changes. */}
      <p
        role="status"
        className="mt-2 flex min-h-[calc(40px*var(--ts))] items-center justify-center big:max-sm:min-h-[calc(60px*var(--ts))]"
      >
        {/* The live region stays put so each new message is announced; only the inner text is swapped (and fades in). */}
        <span key={line} className={ready ? 'fade-in' : 'text-ds-frame'}>
          {line}
        </span>
      </p>
      <div className="mt-2 flex h-16 items-end gap-1 border-b-2 border-ds-frame-light" aria-hidden="true">
        {bars.map((bar) => (
          <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <div
              className={`w-full ${ready ? 'fade-in' : ''} ${bar.isYou ? 'bg-fb-match' : 'bg-ds-frame-light'}`}
              style={{ height: `${Math.max(bar.count > 0 ? 6 : 0, (bar.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 tx-8 text-ds-frame" aria-hidden="true">
        {bars.map((bar) => (
          <span key={bar.label} className={`flex-1 text-center ${bar.isYou ? 'text-ds-ink underline underline-offset-2' : ''}`}>
            {bar.label}
          </span>
        ))}
      </div>
      <p className="mt-1 tx-8 text-ds-frame">Guesses to solve. Anonymous totals, one per network a day.</p>
    </section>
  )
}
