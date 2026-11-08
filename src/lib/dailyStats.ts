/**
 * Public daily stats for the result screen: how many players solved today's
 * puzzle and how many guesses they needed. The numbers come from the `stats`
 * Supabase function (anonymous totals only). Everything here is best effort:
 * a failure or an offline player just means no stats panel.
 */
import { isTrackingEnabled } from './analytics'

/** Guess counts at or above this are grouped into one bar. */
export const HISTOGRAM_CAP = 10

export interface DailyStats {
  /** Guess count -> number of players who solved it in that many guesses. */
  histogram: Record<number, number>
}

export interface DailyStatsSummary {
  players: number
  average: number
  /** Share of players (0-100) who needed more guesses than you. */
  fasterThanPercent: number
  /** Share of players (0-100) who needed exactly as many guesses as you. */
  samePercent: number
  /** Bars for 1..HISTOGRAM_CAP (the last one is "10+"), with the count per bar. */
  bars: { label: string; count: number; isYou: boolean }[]
}

/** The stats URL sits next to the track URL, or null when stats are unavailable or switched off. */
export function statsUrl(trackUrl: unknown = import.meta.env.VITE_TRACK_URL): string | null {
  if (typeof trackUrl !== 'string' || !/\/track$/.test(trackUrl)) return null
  return trackUrl.replace(/\/track$/, '/stats')
}

/** Reads the response body, ignoring anything unexpected. Returns null if there is nothing to show. */
export function parseDailyStats(body: unknown): DailyStats | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = (body as { histogram?: unknown }).histogram
  if (typeof raw !== 'object' || raw === null) return null
  const histogram: Record<number, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    const guesses = Number(key)
    if (!Number.isInteger(guesses) || guesses < 1) continue // skips "lost"
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue
    histogram[guesses] = value
  }
  return Object.keys(histogram).length > 0 ? { histogram } : null
}

/** Turns the histogram into the numbers shown on screen. Null when nobody has solved it. */
export function summarize(stats: DailyStats, yourGuesses: number): DailyStatsSummary | null {
  const entries = Object.entries(stats.histogram).map(([g, c]) => [Number(g), c] as const)
  const players = entries.reduce((sum, [, c]) => sum + c, 0)
  if (players <= 0) return null
  const totalGuesses = entries.reduce((sum, [g, c]) => sum + g * c, 0)
  const slower = entries.filter(([g]) => g > yourGuesses).reduce((sum, [, c]) => sum + c, 0)
  const same = stats.histogram[yourGuesses] ?? 0
  const bars = Array.from({ length: HISTOGRAM_CAP }, (_, i) => {
    const guesses = i + 1
    const last = guesses === HISTOGRAM_CAP
    const count = entries.filter(([g]) => (last ? g >= guesses : g === guesses)).reduce((sum, [, c]) => sum + c, 0)
    const isYou = last ? yourGuesses >= guesses : yourGuesses === guesses
    return { label: last ? `${guesses}+` : String(guesses), count, isYou }
  })
  return {
    players,
    average: totalGuesses / players,
    fasterThanPercent: Math.round((slower / players) * 100),
    samePercent: Math.round((same / players) * 100),
    bars,
  }
}

/** Fetches stats for one daily puzzle date (YYYY-MM-DD). Resolves to null on any failure. */
export async function fetchDailyStats(date: string, signal?: AbortSignal): Promise<DailyStats | null> {
  try {
    const base = statsUrl()
    if (!base || !isTrackingEnabled()) return null
    const res = await fetch(`${base}?date=${encodeURIComponent(date)}`, { signal })
    if (!res.ok) return null
    return parseDailyStats(await res.json())
  } catch {
    return null
  }
}
