/**
 * Public daily stats for the result screen: how many players solved today's
 * puzzle, how many guesses they needed and how many used the Gen hint. The
 * numbers come from the `stats` Supabase function (anonymous totals only).
 * The panel is shown after every Daily, even when you are the first to finish;
 * a failed or switched-off fetch just shows a short note instead.
 */
import { isTrackingEnabled } from './analytics'

/** Guess counts at or above this are grouped into one bar. */
export const HISTOGRAM_CAP = 10

export interface DailyStats {
  /** Guess count -> number of players who solved it in that many guesses. */
  histogram: Record<number, number>
  /** Players who finished (solved or gave up); at least the number who solved. */
  finished: number
  /** Finished players who took the Gen hint; null if the server doesn't say. */
  hinted: number | null
}

export interface DailyStatsSummary {
  /** Players who solved it. */
  players: number
  /** Players who gave up. */
  gaveUp: number
  /** Average guesses among those who solved it; null if nobody has yet. */
  average: number | null
  /** Share of solvers (0-100) who needed more guesses than you. */
  fasterThanPercent: number
  /** Share of solvers (0-100) who needed exactly as many guesses as you. */
  samePercent: number
  /** Share of finished players (0-100) who took the Gen hint; null if unknown. */
  hintPercent: number | null
  /** Bars for 1..HISTOGRAM_CAP (the last one is "10+"), with the count per bar. */
  bars: { label: string; count: number; isYou: boolean }[]
}

/** The stats URL sits next to the track URL, or null when stats are unavailable. */
export function statsUrl(trackUrl: unknown = import.meta.env.VITE_TRACK_URL): string | null {
  if (typeof trackUrl !== 'string' || !/\/track$/.test(trackUrl)) return null
  return trackUrl.replace(/\/track$/, '/stats')
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

/**
 * Reads the response body, ignoring anything unexpected. An empty day (nobody has
 * finished yet) is still a valid answer; only a body that isn't stats at all gives null.
 */
export function parseDailyStats(body: unknown): DailyStats | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as { histogram?: unknown; games_finished?: unknown; hinted?: unknown }
  if (typeof b.histogram !== 'object' || b.histogram === null) return null
  const histogram: Record<number, number> = {}
  for (const [key, value] of Object.entries(b.histogram)) {
    const guesses = Number(key)
    if (!Number.isInteger(guesses) || guesses < 1) continue // skips "lost"
    if (!isCount(value) || value === 0) continue
    histogram[guesses] = value
  }
  const solved = Object.values(histogram).reduce((sum, c) => sum + c, 0)
  const finished = Math.max(solved, isCount(b.games_finished) ? b.games_finished : 0)
  const hinted = isCount(b.hinted) ? Math.min(b.hinted, finished) : null
  return { histogram, finished, hinted }
}

/** Turns the totals into the numbers shown on screen. */
export function summarize(stats: DailyStats, yourGuesses: number): DailyStatsSummary {
  const entries = Object.entries(stats.histogram).map(([g, c]) => [Number(g), c] as const)
  const players = entries.reduce((sum, [, c]) => sum + c, 0)
  const totalGuesses = entries.reduce((sum, [g, c]) => sum + g * c, 0)
  const slower = entries.filter(([g]) => g > yourGuesses).reduce((sum, [, c]) => sum + c, 0)
  const same = stats.histogram[yourGuesses] ?? 0
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)
  const bars = Array.from({ length: HISTOGRAM_CAP }, (_, i) => {
    const guesses = i + 1
    const last = guesses === HISTOGRAM_CAP
    const count = entries.filter(([g]) => (last ? g >= guesses : g === guesses)).reduce((sum, [, c]) => sum + c, 0)
    const isYou = last ? yourGuesses >= guesses : yourGuesses === guesses
    return { label: last ? `${guesses}+` : String(guesses), count, isYou }
  })
  return {
    players,
    gaveUp: Math.max(0, stats.finished - players),
    average: players > 0 ? totalGuesses / players : null,
    fasterThanPercent: pct(slower, players),
    samePercent: pct(same, players),
    hintPercent: stats.hinted === null || stats.finished === 0 ? null : pct(stats.hinted, stats.finished),
    bars,
  }
}

export type DailyStatsResult = { kind: 'ok'; stats: DailyStats } | { kind: 'off' } | { kind: 'error' }

/**
 * Fetches stats for one daily puzzle date (YYYY-MM-DD). 'off' means stats sharing is
 * switched off (or there is no server); 'error' covers any failure.
 */
export async function fetchDailyStats(date: string, signal?: AbortSignal): Promise<DailyStatsResult> {
  try {
    const base = statsUrl()
    if (!base || !isTrackingEnabled()) return { kind: 'off' }
    const res = await fetch(`${base}?date=${encodeURIComponent(date)}`, { signal })
    if (!res.ok) return { kind: 'error' }
    const stats = parseDailyStats(await res.json())
    return stats ? { kind: 'ok', stats } : { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}
