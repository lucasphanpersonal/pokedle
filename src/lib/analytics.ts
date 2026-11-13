/**
 * Anonymous gameplay analytics. Events are queued in memory and sent in one
 * batch per game (see supabase/README.md for the accepted payload).
 *
 * Everything here is best effort: it never throws and never blocks the game.
 * Tracking is a no-op without VITE_TRACK_URL, and is skipped for players who
 * send Global Privacy Control / Do Not Track or switch off "Share anonymous
 * stats" in the Help modal (which sets the opt-out flag via setTrackingOptOut).
 */
import { ENABLED_FORM_CATEGORIES } from '../config/gameConfig'
import type { GameMode } from './game'
import { storageKey } from './storage'

const MAX_BATCH = 60
/** Durations are capped so a tab left open overnight doesn't skew averages. */
const MAX_DURATION_S = 4 * 60 * 60

const OPT_OUT_KEY = storageKey('analytics-opt-out')
const GAME_PREFIX = storageKey('analytics-game:')

type Json = Record<string, unknown>

/** Per-game record kept in its own localStorage key (SavedGame is untouched). */
interface GameRecord {
  id: string
  startedAt: number
  startSent: boolean
  finishSent: boolean
}

const queue: Json[] = []

function endpoint(): string | null {
  const url = import.meta.env.VITE_TRACK_URL
  return typeof url === 'string' && url ? url : null
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/** In-memory copy of the opt-out, so it holds even if localStorage throws. */
let optedOutInMemory = false

/** True if the player switched analytics off in the Help modal. */
export function isOptedOutByPlayer(): boolean {
  if (optedOutInMemory) return true
  try {
    return storage()?.getItem(OPT_OUT_KEY) === 'true'
  } catch {
    return false
  }
}

/** True if the browser itself asks not to be tracked (GPC or Do Not Track). */
export function isBrowserDoNotTrack(): boolean {
  try {
    const nav = globalThis.navigator as (Navigator & { globalPrivacyControl?: boolean }) | undefined
    return nav?.globalPrivacyControl === true || nav?.doNotTrack === '1'
  } catch {
    return false
  }
}

/** True if there is an endpoint and the player has not opted out in any way. */
export function isTrackingEnabled(): boolean {
  if (!endpoint()) return false
  return !isBrowserDoNotTrack() && !isOptedOutByPlayer()
}

/**
 * Backs the Help modal's "Share anonymous stats" switch. Opting out takes
 * effect immediately (queue dropped, in-memory flag set) even if the flag
 * cannot be saved. Returns whether the choice was persisted.
 */
export function setTrackingOptOut(optOut: boolean): boolean {
  if (optOut) {
    queue.length = 0
    optedOutInMemory = true
  } else {
    optedOutInMemory = false
  }
  try {
    const s = storage()
    if (!s) return false
    if (optOut) s.setItem(OPT_OUT_KEY, 'true')
    else s.removeItem(OPT_OUT_KEY)
    return true
  } catch {
    return false
  }
}

function newId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  } catch {
    // fall through
  }
  const bytes = new Uint8Array(16)
  try {
    globalThis.crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function deviceType(): 'phone' | 'tablet' | 'desktop' {
  const w = typeof globalThis.innerWidth === 'number' ? globalThis.innerWidth : 1280
  return w < 640 ? 'phone' : w < 1024 ? 'tablet' : 'desktop'
}

function appVersion(): string | undefined {
  const v = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
  return /^[A-Za-z0-9._+-]{1,32}$/.test(v) ? v : undefined
}

function config(hinted: boolean): Record<string, boolean | number> {
  const cfg: Record<string, boolean | number> = {}
  // Whether the game has used the Gen hint so far. The public daily stats read it from game_finished
  // to say what share of players used the hint; games from before the hint existed have no key (= no hint).
  cfg.hint_used = hinted
  for (const [category, enabled] of Object.entries(ENABLED_FORM_CATEGORIES)) cfg[`form_${category}`] = enabled
  return cfg
}

function readRecord(key: string): GameRecord | null {
  try {
    const raw = storage()?.getItem(key)
    if (!raw) return null
    const r = JSON.parse(raw) as Partial<GameRecord>
    if (typeof r.id !== 'string' || typeof r.startedAt !== 'number') return null
    return { id: r.id, startedAt: r.startedAt, startSent: r.startSent === true, finishSent: r.finishSent === true }
  } catch {
    return null
  }
}

function writeRecord(key: string, record: GameRecord): void {
  try {
    storage()?.setItem(key, JSON.stringify(record))
  } catch {
    // ignore
  }
}

/** Only the current game of each mode matters, so drop records of earlier games. */
function pruneOtherGames(mode: GameMode, keepKey: string): void {
  try {
    const s = storage()
    if (!s) return
    const prefix = `${GAME_PREFIX}${mode}:`
    const stale: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k && k.startsWith(prefix) && k !== keepKey) stale.push(k)
    }
    stale.forEach((k) => s.removeItem(k))
  } catch {
    // ignore
  }
}

/**
 * Identity of one game: Daily = date key; Endless = the start timestamp stored
 * in the saved game (unique per game). Reloads find the same record again.
 */
function getRecord(mode: GameMode, gameKey: string): { key: string; record: GameRecord } {
  const key = `${GAME_PREFIX}${mode}:${gameKey}`
  const existing = readRecord(key)
  if (existing) return { key, record: existing }
  const record: GameRecord = { id: newId(), startedAt: Date.now(), startSent: false, finishSent: false }
  writeRecord(key, record)
  pruneOtherGames(mode, key)
  return { key, record }
}

export interface GameRef {
  mode: GameMode
  /** SavedGame.key: Daily date key, or the Endless start time. */
  gameKey: string
  targetId: number
  /** The game has used the Gen hint. Defaults to false. */
  hinted?: boolean
}

function baseEvent(event: string, id: string, g: GameRef): Json {
  const e: Json = {
    event,
    game_id: id,
    mode: g.mode,
    target_id: g.targetId,
    device: deviceType(),
    config: config(g.hinted === true),
  }
  if (g.mode === 'daily') e.puzzle_date = g.gameKey
  const version = appVersion()
  if (version) e.app_version = version
  return e
}

/** Call once per accepted guess (submitGuess returned 'ok'). */
export function trackGuess(g: GameRef, guess: { guessId: number; guessNumber: number; isCorrect: boolean }): void {
  try {
    if (!isTrackingEnabled()) return
    const { key, record } = getRecord(g.mode, g.gameKey)
    if (!record.startSent) {
      queue.push(baseEvent('game_started', record.id, g))
      writeRecord(key, { ...record, startSent: true })
    }
    queue.push({
      ...baseEvent('guess_made', record.id, g),
      guess_id: guess.guessId,
      guess_number: guess.guessNumber,
      is_correct: guess.isCorrect,
    })
  } catch {
    // never break the game
  }
}

/** Call when a game is won, or given up ('lost'). Sent at most once per game, then flushes. */
export function trackFinish(g: GameRef, result: 'won' | 'lost', guessCount: number, now: number = Date.now()): void {
  try {
    if (!isTrackingEnabled()) return
    const { key, record } = getRecord(g.mode, g.gameKey)
    if (record.finishSent) return
    writeRecord(key, { ...record, finishSent: true })
    const seconds = Math.round((now - record.startedAt) / 1000)
    queue.push({
      ...baseEvent('game_finished', record.id, g),
      result,
      guess_count: guessCount,
      duration_s: Math.min(MAX_DURATION_S, Math.max(0, seconds)),
    })
    flush()
  } catch {
    // never break the game
  }
}

function send(url: string, body: string): void {
  try {
    if (typeof globalThis.navigator?.sendBeacon === 'function') {
      if (globalThis.navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return
    }
  } catch {
    // fall back to fetch
  }
  try {
    void globalThis
      .fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } })
      .catch(() => {})
  } catch {
    // ignore
  }
}

/** Sends everything queued, one batch (<= 60 events) per game. */
export function flush(): void {
  try {
    const url = endpoint()
    if (!url || queue.length === 0) return
    const events = queue.splice(0)
    if (!isTrackingEnabled()) return
    const byGame = new Map<string, Json[]>()
    for (const e of events) {
      const id = e.game_id as string
      byGame.set(id, [...(byGame.get(id) ?? []), e])
    }
    for (const list of byGame.values()) {
      for (let i = 0; i < list.length; i += MAX_BATCH) {
        send(url, JSON.stringify({ events: list.slice(i, i + MAX_BATCH) }))
      }
    }
  } catch {
    // ignore
  }
}

let listening = false
/** Flush when the page is hidden or closed. Safe to call repeatedly. */
export function startAnalytics(): void {
  if (listening || typeof document === 'undefined') return
  listening = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}

/** Test helper: clears the in-memory queue and opt-out flag. */
export function resetQueueForTests(): void {
  queue.length = 0
  optedOutInMemory = false
}
