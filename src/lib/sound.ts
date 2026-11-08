import { loadJson, saveJson } from './storage'

/**
 * Original 8-bit style sound effects, synthesised live with the Web Audio API
 * (square/triangle oscillators). No audio files are shipped or copied.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is
 * created lazily on the first sound request, which always follows a tap or
 * keypress, and resumed if the browser (notably iOS Safari) suspended it.
 */
export type SoundName = 'type' | 'move' | 'select' | 'tick' | 'error' | 'win' | 'toggle'

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
    case 'tick':
      return [n(16, 0, 0.05, 'triangle', 0.2)]
    case 'error':
      return [n(-12, 0, 0.09, 'square', 0.1), n(-17, 0.09, 0.14, 'square', 0.1)]
    case 'toggle':
      return [n(12, 0, 0.05), n(19, 0.05, 0.08)]
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

const KEY = 'sound'
let enabled: boolean | null = null
let ctx: AudioContext | null = null

/** Sound is on by default and the player's choice is remembered per device. */
export function isSoundOn(): boolean {
  if (enabled === null) enabled = loadJson(KEY) !== false
  return enabled
}

export function setSoundOn(on: boolean): void {
  enabled = on
  saveJson(KEY, on)
  if (on) playSound('toggle')
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

/** Play an effect. Silent when muted, unsupported, or never throws. */
export function playSound(name: SoundName, pitch = 0): void {
  if (!isSoundOn()) return
  const audio = getContext()
  if (!audio) return
  try {
    if (audio.state === 'suspended') void audio.resume().catch(() => {})
    const t0 = audio.currentTime + 0.01
    for (const note of notesFor(name, pitch)) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      const start = t0 + note.at
      const end = start + note.dur
      osc.type = note.wave ?? 'square'
      osc.frequency.value = note.f
      // Tiny attack and release avoid clicks between notes.
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.linearRampToValueAtTime(note.vol ?? 0.12, start + 0.005)
      gain.gain.setValueAtTime(note.vol ?? 0.12, Math.max(start + 0.005, end - 0.02))
      gain.gain.linearRampToValueAtTime(0.0001, end)
      osc.connect(gain).connect(audio.destination)
      osc.start(start)
      osc.stop(end + 0.02)
    }
  } catch {
    // Audio is a nicety; never break the game over it.
  }
}
