// Pure validation for the `track` Edge Function. No Deno- or Node-specific imports
// so it can be unit tested with vitest.

export const MAX_BATCH = 60
// There is no guess limit in the game, so this is only a sanity bound against junk data.
export const MAX_GUESS_NUMBER = 500

export type EventName = 'game_started' | 'guess_made' | 'game_finished'

export interface EventRow {
  event: EventName
  game_id: string
  mode: 'daily' | 'endless'
  puzzle_date: string | null
  target_id: number
  guess_id: number | null
  guess_number: number | null
  is_correct: boolean | null
  result: 'won' | 'lost' | null
  guess_count: number | null
  streak: number | null
  duration_s: number | null
  device: 'phone' | 'tablet' | 'desktop'
  app_version: string | null
  config: Record<string, string | number | boolean>
}

export type ValidationResult =
  | { ok: true; game_id: string; rows: EventRow[] }
  | { ok: false; error: string }

const COMMON_KEYS = ['event', 'game_id', 'mode', 'puzzle_date', 'target_id', 'device', 'app_version', 'config']
const EVENT_KEYS: Record<EventName, string[]> = {
  game_started: [],
  guess_made: ['guess_id', 'guess_number', 'is_correct'],
  game_finished: ['result', 'guess_count', 'streak', 'duration_s'],
}
const EVENT_REQUIRED: Record<EventName, string[]> = {
  game_started: [],
  guess_made: ['guess_id', 'guess_number', 'is_correct'],
  game_finished: ['result', 'guess_count'],
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VERSION_RE = /^[A-Za-z0-9._+-]{1,32}$/
const CONFIG_KEY_RE = /^[a-z][a-z0-9_]{0,31}$/
const CONFIG_STR_RE = /^[A-Za-z0-9._:-]{0,32}$/
const MAX_CONFIG_KEYS = 16
const DAY_MS = 86_400_000

const fail = (error: string): ValidationResult => ({ ok: false, error })

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** Validate a parsed request body. `now` is injectable for tests. */
export function validateBatch(body: unknown, now: Date = new Date()): ValidationResult {
  if (!isPlainObject(body)) return fail('invalid_body')
  const keys = Object.keys(body)
  if (keys.length !== 1 || keys[0] !== 'events') return fail('invalid_body')
  const events = body.events
  if (!Array.isArray(events)) return fail('invalid_body')
  if (events.length === 0) return fail('empty_batch')
  if (events.length > MAX_BATCH) return fail('batch_too_large')

  const rows: EventRow[] = []
  let gameId: string | null = null

  for (const e of events) {
    const r = validateEvent(e, now)
    if (!r.ok) return r
    const id = r.row.game_id.toLowerCase()
    if (gameId === null) gameId = id
    else if (gameId !== id) return fail('mixed_game_ids')
    rows.push({ ...r.row, game_id: id })
  }
  return { ok: true, game_id: gameId as string, rows }
}

function validateEvent(
  e: unknown,
  now: Date,
): { ok: true; row: EventRow } | { ok: false; error: string } {
  const bad = (error: string) => ({ ok: false as const, error })
  if (!isPlainObject(e)) return bad('invalid_event')

  const name = e.event
  if (name !== 'game_started' && name !== 'guess_made' && name !== 'game_finished') {
    return bad('unknown_event')
  }

  const allowed = new Set([...COMMON_KEYS, ...EVENT_KEYS[name]])
  for (const k of Object.keys(e)) if (!allowed.has(k)) return bad('unknown_field')
  for (const k of EVENT_REQUIRED[name]) if (e[k] === undefined || e[k] === null) return bad('missing_field')

  if (typeof e.game_id !== 'string' || !UUID_RE.test(e.game_id)) return bad('invalid_game_id')
  if (e.mode !== 'daily' && e.mode !== 'endless') return bad('invalid_mode')

  let puzzleDate: string | null = null
  if (e.mode === 'daily') {
    if (typeof e.puzzle_date !== 'string' || !isRealDate(e.puzzle_date)) return bad('invalid_puzzle_date')
    // Clients may be a day ahead/behind UTC; anything further is garbage.
    const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
    const diff = Math.abs(Date.parse(`${e.puzzle_date}T00:00:00Z`) - today)
    if (diff > 3 * DAY_MS) return bad('invalid_puzzle_date')
    puzzleDate = e.puzzle_date
  } else if (e.puzzle_date !== undefined && e.puzzle_date !== null) {
    return bad('invalid_puzzle_date')
  }

  if (!isInt(e.target_id, 1, 100_000)) return bad('invalid_target_id')
  if (e.device !== 'phone' && e.device !== 'tablet' && e.device !== 'desktop') return bad('invalid_device')

  let appVersion: string | null = null
  if (e.app_version !== undefined && e.app_version !== null) {
    if (typeof e.app_version !== 'string' || !VERSION_RE.test(e.app_version)) return bad('invalid_app_version')
    appVersion = e.app_version
  }

  const config: EventRow['config'] = {}
  if (e.config !== undefined && e.config !== null) {
    if (!isPlainObject(e.config)) return bad('invalid_config')
    const entries = Object.entries(e.config)
    if (entries.length > MAX_CONFIG_KEYS) return bad('invalid_config')
    for (const [k, v] of entries) {
      if (!CONFIG_KEY_RE.test(k)) return bad('invalid_config')
      const okVal =
        typeof v === 'boolean' ||
        (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9) ||
        (typeof v === 'string' && CONFIG_STR_RE.test(v))
      if (!okVal) return bad('invalid_config')
      config[k] = v as string | number | boolean
    }
  }

  const row: EventRow = {
    event: name,
    game_id: e.game_id,
    mode: e.mode,
    puzzle_date: puzzleDate,
    target_id: e.target_id,
    guess_id: null,
    guess_number: null,
    is_correct: null,
    result: null,
    guess_count: null,
    streak: null,
    duration_s: null,
    device: e.device,
    app_version: appVersion,
    config,
  }

  if (name === 'guess_made') {
    if (!isInt(e.guess_id, 1, 100_000)) return bad('invalid_guess_id')
    if (!isInt(e.guess_number, 1, MAX_GUESS_NUMBER)) return bad('invalid_guess_number')
    if (typeof e.is_correct !== 'boolean') return bad('invalid_is_correct')
    row.guess_id = e.guess_id
    row.guess_number = e.guess_number
    row.is_correct = e.is_correct
  } else if (name === 'game_finished') {
    if (e.result !== 'won' && e.result !== 'lost') return bad('invalid_result')
    if (!isInt(e.guess_count, 1, MAX_GUESS_NUMBER)) return bad('invalid_guess_count')
    row.result = e.result
    row.guess_count = e.guess_count
    if (e.streak !== undefined && e.streak !== null) {
      if (!isInt(e.streak, 0, 100_000)) return bad('invalid_streak')
      row.streak = e.streak
    }
    if (e.duration_s !== undefined && e.duration_s !== null) {
      if (!isInt(e.duration_s, 0, 86_400)) return bad('invalid_duration')
      row.duration_s = e.duration_s
    }
  }
  return { ok: true, row }
}
