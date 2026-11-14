/**
 * Player history and streaks. Kept only on this device (localStorage), one
 * entry per finished Daily: solved, or given up (`lost`). A game has no guess
 * limit, so a Daily is either finished or still open; a day that is simply
 * never finished has no entry.
 */
import { dayNumber, localDateKey } from './daily'

export interface HistoryEntry {
  /** The Daily's date key, YYYY-MM-DD (local time). */
  date: string
  /** The answer's Pokédex id. */
  targetId: number
  /** How many guesses it took. */
  guesses: number
  /** True if the Gen hint was taken. Absent = solved without it. */
  hinted?: true
  /** True if the player gave up (a loss: it ends the streak). `guesses` is how many they made. Absent = solved. */
  lost?: true
}

export interface HistoryStats {
  /** Consecutive days solved, ending today (or yesterday if today is still open). */
  currentStreak: number
  bestStreak: number
  solved: number
  /** Dailies given up. */
  gaveUp: number
  averageGuesses: number | null
  fewestGuesses: number | null
  /** Share of solves (0-100, rounded) made without the Gen hint; null until something is solved. */
  noHintPercent: number | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const isEntry = (v: unknown): v is HistoryEntry => {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.date === 'string' &&
    DATE_RE.test(e.date) &&
    Number.isInteger(e.targetId) &&
    Number.isInteger(e.guesses) &&
    (e.guesses as number) >= 1
  )
}

/**
 * Keeps the valid entries (one per date, newest first); anything else is dropped.
 * Entries from when Hard mode existed carry `hard: true`; that flag is dropped, so they count as ordinary solves.
 */
export function parseHistory(raw: unknown): HistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const byDate = new Map<string, HistoryEntry>()
  for (const item of raw) {
    if (isEntry(item) && !byDate.has(item.date)) {
      const entry: HistoryEntry = { date: item.date, targetId: item.targetId, guesses: item.guesses }
      if (item.hinted === true) entry.hinted = true
      if (item.lost === true) entry.lost = true
      byDate.set(item.date, entry)
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** Adds (or keeps the existing) entry for a date: a solve, or a give up (`lost`). Returns the same array if nothing changed. */
export function recordSolve(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  if (history.some((e) => e.date === entry.date)) return history
  return parseHistory([entry, ...history])
}

export function computeStats(history: HistoryEntry[], today: string = localDateKey()): HistoryStats {
  // Only solved days build a streak; a given-up day is a miss like any other.
  const solvedEntries = history.filter((e) => e.lost !== true)
  const days = [...new Set(solvedEntries.map((e) => dayNumber(e.date)))].sort((a, b) => a - b)

  let best = 0
  let run = 0
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1
    best = Math.max(best, run)
  }

  // The streak is still alive if the latest solve was today or yesterday.
  const last = days[days.length - 1]
  const todayNum = dayNumber(today)
  // Giving up today ends the streak straight away, instead of waiting for the day to pass.
  const gaveUpToday = history.some((e) => e.lost === true && e.date === today)
  const current = !gaveUpToday && last !== undefined && last >= todayNum - 1 ? trailingRun(days) : 0

  const total = solvedEntries.reduce((sum, e) => sum + e.guesses, 0)
  return {
    currentStreak: current,
    bestStreak: best,
    solved: solvedEntries.length,
    gaveUp: history.length - solvedEntries.length,
    averageGuesses: solvedEntries.length ? total / solvedEntries.length : null,
    fewestGuesses: solvedEntries.length ? Math.min(...solvedEntries.map((e) => e.guesses)) : null,
    noHintPercent: noHintPercent(solvedEntries.length, solvedEntries.filter((e) => e.hinted).length),
  }
}

/** Share (0-100, rounded) of `wins` that didn't use the hint; null with no wins. */
export function noHintPercent(wins: number, hinted: number): number | null {
  return wins > 0 ? Math.round(((wins - Math.min(hinted, wins)) / wins) * 100) : null
}

function trailingRun(sortedDays: number[]): number {
  let run = 0
  for (let i = sortedDays.length - 1; i >= 0; i--) {
    if (i === sortedDays.length - 1 || sortedDays[i] === sortedDays[i + 1] - 1) run++
    else break
  }
  return run
}

/**
 * Endless tally on this device: games caught and given up, plus guess totals
 * for the caught ones. `last` is the key (start time) of the last game
 * counted, so each game is counted once even if it is seen again on reload or
 * from another tab. Endless games are played one at a time, so remembering
 * only the last one is enough.
 *
 * `scored` counts the caught games whose guess count is known: tallies saved
 * before guess counts were kept have caught games without one, so the average
 * divides by `scored`, not `caught`.
 */
export interface EndlessRecord {
  caught: number
  gaveUp: number
  /** Total guesses across the scored caught games. */
  guesses: number
  /** Caught games included in `guesses` and `fewest`. */
  scored: number
  /** Fewest guesses in a caught game; null until one is scored. */
  fewest: number | null
  /** Caught games that used the Gen hint (games caught before the hint existed count as without). */
  hinted: number
  last: string | null
}

export const EMPTY_ENDLESS_RECORD: EndlessRecord = { caught: 0, gaveUp: 0, guesses: 0, scored: 0, fewest: null, hinted: 0, last: null }

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

export function parseEndlessRecord(raw: unknown): EndlessRecord {
  if (typeof raw !== 'object' || raw === null) return EMPTY_ENDLESS_RECORD
  const r = raw as Record<string, unknown>
  const caught = isCount(r.caught) ? r.caught : 0
  // Guess totals only stand if they are consistent with each other and with `caught`.
  const scored = isCount(r.scored) ? r.scored : 0
  const guesses = isCount(r.guesses) ? r.guesses : 0
  const fewest = isCount(r.fewest) && r.fewest >= 1 ? r.fewest : null
  const scoresOk = scored >= 1 && scored <= caught && fewest !== null && guesses >= scored * fewest
  return {
    caught,
    gaveUp: isCount(r.gaveUp) ? r.gaveUp : 0,
    guesses: scoresOk ? guesses : 0,
    scored: scoresOk ? scored : 0,
    fewest: scoresOk ? fewest : null,
    hinted: isCount(r.hinted) && r.hinted <= caught ? r.hinted : 0,
    last: typeof r.last === 'string' ? r.last : null,
  }
}

/**
 * Counts a finished Endless game once; `guesses` is how many it took and `hinted` whether it used
 * the Gen hint. Returns the same record if it was already counted.
 */
export function recordEndless(
  record: EndlessRecord,
  gameKey: string,
  result: 'won' | 'lost',
  guesses: number,
  hinted = false,
): EndlessRecord {
  if (record.last === gameKey) return record
  if (result === 'lost') return { ...record, gaveUp: record.gaveUp + 1, last: gameKey }
  return {
    ...record,
    caught: record.caught + 1,
    guesses: record.guesses + guesses,
    scored: record.scored + 1,
    fewest: record.fewest === null ? guesses : Math.min(record.fewest, guesses),
    hinted: record.hinted + (hinted ? 1 : 0),
    last: gameKey,
  }
}

export interface EndlessStats {
  /** Caught plus given up. */
  played: number
  caught: number
  gaveUp: number
  /** Average guesses per caught game; null until one is scored. */
  averageGuesses: number | null
  fewestGuesses: number | null
  /** Share of caught games (0-100) caught without the Gen hint; null until one is caught. */
  noHintPercent: number | null
}

export function computeEndlessStats(record: EndlessRecord): EndlessStats {
  return {
    played: record.caught + record.gaveUp,
    caught: record.caught,
    gaveUp: record.gaveUp,
    averageGuesses: record.scored ? record.guesses / record.scored : null,
    fewestGuesses: record.fewest,
    noHintPercent: noHintPercent(record.caught, record.hinted),
  }
}

/**
 * Recent Endless games, newest first, for the list in History (`localStorage['pokemondle:endless-games']`).
 * Only the last ENDLESS_GAMES_KEPT are kept; the totals above count every game. Games finished before
 * this list existed aren't in it.
 */
export interface EndlessGameEntry {
  /** The game's key (when it started, ISO), so each game is listed once. */
  key: string
  targetId: number
  guesses: number
  /** Given up rather than caught. */
  lost?: true
  hinted?: true
}

export const ENDLESS_GAMES_KEPT = 30

export function parseEndlessGames(raw: unknown): EndlessGameEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: EndlessGameEntry[] = []
  for (const g of raw) {
    if (typeof g !== 'object' || g === null) continue
    const e = g as Record<string, unknown>
    if (typeof e.key !== 'string' || seen.has(e.key)) continue
    if (!Number.isInteger(e.targetId) || (e.targetId as number) < 1) continue
    if (!isCount(e.guesses) || (e.guesses as number) < 1) continue
    seen.add(e.key)
    out.push({
      key: e.key,
      targetId: e.targetId as number,
      guesses: e.guesses as number,
      ...(e.lost === true ? { lost: true as const } : {}),
      ...(e.hinted === true ? { hinted: true as const } : {}),
    })
    if (out.length === ENDLESS_GAMES_KEPT) break
  }
  return out
}

/** Adds a finished Endless game to the front of the list (once per game). Returns the same list if it is already there. */
export function recordEndlessGame(list: EndlessGameEntry[], game: EndlessGameEntry): EndlessGameEntry[] {
  if (list.some((g) => g.key === game.key)) return list
  return [game, ...list].slice(0, ENDLESS_GAMES_KEPT)
}
