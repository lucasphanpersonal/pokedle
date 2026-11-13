import { loadJson, saveJson } from './storage'

/**
 * Original 8-bit style sound effects, synthesised live with the Web Audio API
 * (square/triangle oscillators). No audio files are shipped or copied.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is
 * created lazily on the first sound request, which always follows a tap or
 * keypress, and resumed if the browser (notably iOS Safari) suspended it.
 */
export type SoundName =
  | 'type'
  | 'move'
  | 'select'
  | 'press'
  | 'tick'
  | 'error'
  | 'win'
  | 'toggle'
  | 'throw'
  | 'bounce'
  | 'wobble'
  | 'click'
  | 'burst'
  | 'flee'

interface Note {
  /** Frequency in Hz. */
  f: number
  /** Start offset in seconds. */
  at: number
  /** Length in seconds. */
  dur: number
  wave?: OscillatorType
  vol?: number
}

const hz = (semitonesFromA4: number) => 440 * 2 ** (semitonesFromA4 / 12)

/** Notes for each effect. `pitch` shifts it up or down in semitones. */
export function notesFor(name: SoundName, pitch = 0): Note[] {
  const n = (semi: number, at: number, dur: number, wave: OscillatorType = 'square', vol = 0.12): Note => ({
    f: hz(semi + pitch),
    at,
    dur,
    wave,
    vol,
  })
  switch (name) {
    case 'type':
      return [n(12, 0, 0.035, 'square', 0.06)]
    case 'move':
      return [n(7, 0, 0.04, 'square', 0.07)]
    case 'select':
      return [n(7, 0, 0.06), n(14, 0.06, 0.1)]
    case 'press':
      // The one blip every button makes: short, high, and a little quieter than the menu moves.
      return [n(9, 0, 0.045, 'square', 0.09)]
    case 'tick':
      return [n(16, 0, 0.05, 'triangle', 0.2)]
    case 'error':
      return [n(-12, 0, 0.09, 'square', 0.1), n(-17, 0.09, 0.14, 'square', 0.1)]
    case 'toggle':
      return [n(12, 0, 0.05), n(19, 0.05, 0.08)]
    case 'throw':
      // The ball flying in: a quick falling whoosh, stepped like an 8-bit pitch sweep.
      return [24, 21, 18, 15, 12, 9].map((semi, i) => n(semi, i * 0.03, 0.035, 'triangle', 0.1))
    case 'bounce':
      // The ball tapping the ground as it lands.
      return [n(-5, 0, 0.03, 'triangle', 0.22), n(-12, 0.025, 0.03, 'triangle', 0.16)]
    case 'wobble': {
      // One shake, played as it starts: a quick low "bwop" as the ball tips left (pitch falls fast to its
      // lowest at 0.1 s), then a springy rise as it tips right (highest at 0.24 s) and settles (0.3 s).
      // Matches .capture-shake in index.css (10%, 24%, 30% of 1 s). Notes overlap so it glides, not clicks.
      const curve: [semi: number, len: number][] = [
        [-8, 0.022], [-12, 0.022], [-16, 0.022], [-20, 0.022], [-22, 0.022],
        [-20, 0.034], [-16, 0.034], [-12, 0.034], [-10, 0.034], [-12, 0.034],
      ]
      let t = 0
      return curve.flatMap(([semi, len]) => {
        const at = t
        t += len
        return [n(semi, at, len + 0.015, 'square', 0.06), n(semi - 12, at, len + 0.015, 'triangle', 0.18)]
      })
    }
    case 'click':
      // The ball locking shut, then the stars twinkling.
      return [
        n(-10, 0, 0.025, 'square', 0.1),
        n(15, 0.04, 0.03, 'square', 0.1),
        n(27, 0.16, 0.05, 'triangle', 0.14),
        n(31, 0.22, 0.05, 'triangle', 0.14),
        n(34, 0.28, 0.1, 'triangle', 0.14),
      ]
    case 'burst':
      // The ball popping open.
      return [n(24, 0, 0.03), n(12, 0.03, 0.04), n(19, 0.07, 0.05), n(31, 0.12, 0.12, 'triangle', 0.14)]
    case 'flee':
      // A quick run down the scale as the Pokémon dashes off.
      return [n(14, 0, 0.05), n(9, 0.06, 0.05), n(5, 0.12, 0.05), n(0, 0.18, 0.09)]
    case 'win':
      // C major fanfare: C E G, then a held high C with a harmony note.
      return [
        n(3, 0, 0.12),
        n(7, 0.12, 0.12),
        n(10, 0.24, 0.12),
        n(15, 0.36, 0.5),
        n(10, 0.36, 0.5, 'triangle', 0.14),
        n(19, 0.55, 0.12),
        n(22, 0.67, 0.12),
        n(27, 0.79, 0.7),
        n(22, 0.79, 0.7, 'triangle', 0.14),
      ]
  }
}

const KEY = 'volume'
const LEGACY_MUTE_KEY = 'sound'

/** Volume steps, like the bars on a Nintendo console: 0 is muted, 5 is full. */
export const MAX_VOLUME = 5
export const DEFAULT_VOLUME = MAX_VOLUME

/** Gain multiplier per step; uneven so each bar is an audible change. */
const STEP_GAIN = [0, 0.1, 0.25, 0.45, 0.7, 1] as const

export const volumeGain = (level: number) => STEP_GAIN[Math.min(Math.max(Math.round(level), 0), MAX_VOLUME)]

let volume: number | null = null
/** The level the speaker button restores after muting. */
let lastAudible = DEFAULT_VOLUME
let ctx: AudioContext | null = null

/** The saved level, migrating the old on/off switch (off becomes 0, on becomes full). */
function loadVolume(): number {
  const saved = loadJson(KEY)
  if (typeof saved === 'number' && Number.isInteger(saved) && saved >= 0 && saved <= MAX_VOLUME) return saved
  return loadJson(LEGACY_MUTE_KEY) === false ? 0 : DEFAULT_VOLUME
}

/** Current volume step, 0 (muted) to MAX_VOLUME. Remembered per device. */
export function getVolume(): number {
  if (volume === null) {
    volume = loadVolume()
    if (volume > 0) lastAudible = volume
  }
  return volume
}

export function isSoundOn(): boolean {
  return getVolume() > 0
}

const listeners = new Set<() => void>()

/** For useSyncExternalStore: lets every volume control follow the same state. */
export function subscribeSound(listener: () => void): () => void {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

export function setVolume(level: number): void {
  const next = Math.min(Math.max(Math.round(level), 0), MAX_VOLUME)
  if (next === getVolume()) return
  volume = next
  if (next > 0) lastAudible = next
  saveJson(KEY, next)
  if (next === 0 && ctx) {
    // Closing the context also cuts off any notes already queued.
    void ctx.close().catch(() => {})
    ctx = null
  }
  listeners.forEach((l) => l())
  // Audible feedback at the new level, like the blip on a console's volume bars.
  if (next > 0) playSound('toggle')
}

/** Speaker button: mute, or restore the last level used. */
export function toggleMute(): void {
  setVolume(isSoundOn() ? 0 : lastAudible)
}

export function setSoundOn(on: boolean): void {
  setVolume(on ? lastAudible : 0)
}

function getContext(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  return ctx
}

/**
 * Browsers (iOS Safari especially) only start audio from a real gesture, so
 * the first tap or keypress anywhere creates and resumes the context.
 */
function unlockOnGesture(): void {
  if (typeof document === 'undefined') return
  const events = ['pointerdown', 'touchend', 'keydown'] as const
  const unlock = () => {
    if (isSoundOn()) {
      const audio = getContext()
      if (audio && audio.state !== 'running') void audio.resume().catch(() => {})
    }
    events.forEach((e) => document.removeEventListener(e, unlock, true))
  }
  events.forEach((e) => document.addEventListener(e, unlock, true))
}
unlockOnGesture()

/** Elements that make the press blip: real buttons, radio options and switches. */
const PRESSABLE = 'button, [role="radio"], [role="switch"]'

/**
 * One blip for every button press. A single capture-phase click listener on the
 * document, so new buttons get the sound without any code of their own.
 * Opt out with `data-no-sound` on a button that already makes its own sound
 * (the speaker, which plays the level blip, and Guess, which plays its select sound).
 * Disabled buttons stay silent.
 */
function onPressableClick(e: Event): void {
  const target = e.target
  if (!(target instanceof Element)) return
  const button = target.closest(PRESSABLE)
  if (!button || button.matches('[data-no-sound], [aria-disabled="true"], :disabled')) return
  playSound('press')
}
if (typeof document !== 'undefined') document.addEventListener('click', onPressableClick, true)

/** Play an effect at the current volume. Silent when muted, unsupported, or never throws. */
export function playSound(name: SoundName, pitch = 0): void {
  if (!isSoundOn()) return
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state !== 'running') {
      // Suspended or 'interrupted' (iOS after a call or tab switch): wake it and
      // drop this sound rather than queueing notes that would all play at once.
      void audio.resume().catch(() => {})
      return
    }
    const t0 = audio.currentTime + 0.01
    const gainScale = volumeGain(getVolume())
    for (const note of notesFor(name, pitch)) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const start = t0 + note.at
      const end = start + note.dur
      osc.type = note.wave ?? 'square'
      osc.frequency.value = note.f
      // Tiny attack and release avoid clicks between notes.
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime((note.vol ?? 0.12) * gainScale, start + 0.005)
      gain.gain.setValueAtTime((note.vol ?? 0.12) * gainScale, Math.max(start + 0.005, end - 0.02))
      gain.gain.linearRampToValueAtTime(0.0001, end)
      osc.connect(gain).connect(audio.destination)
      osc.start(start)
      osc.stop(end + 0.02)
    }
  } catch {
    // Audio is a nicety; never break the game over it.
  }
}
