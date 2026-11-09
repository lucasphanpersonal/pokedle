import { useSyncExternalStore, type KeyboardEvent } from 'react'
import { MAX_VOLUME, getVolume, setVolume, subscribeSound, toggleMute } from '../lib/sound'

const BARS = Array.from({ length: MAX_VOLUME }, (_, i) => i + 1)

const useVolume = () => useSyncExternalStore(subscribeSound, getVolume, () => MAX_VOLUME)

/** Speaker icon whose waves follow the level (none when muted). */
export function SpeakerIcon({ level }: { level: number }) {
  return (
    <svg viewBox="1.5 1 14 14" width="18" height="18" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
      <path d="M2 6h3l4-3v10l-4-3H2z" />
      {level === 0 ? (
        <path d="M11 6h1v1h1v1h1V7h1V6h-1V5h-1v1h-1V5h-1zM11 10h1V9h1v1h1v1h1v1h-1v-1h-1v1h-1v-1h-1z" />
      ) : (
        <>
          <path d="M10 6h1v4h-1z" />
          {level >= 2 && <path d="M12 4h1v8h-1z" />}
          {level >= 4 && <path d="M14 2h1v12h-1z" />}
        </>
      )}
    </svg>
  )
}

/** Mute / unmute button. Unmuting restores the last level used. */
export function SpeakerButton({ className = '' }: { className?: string }) {
  const level = useVolume()
  return (
    <button
      type="button"
      onClick={toggleMute}
      aria-label="Sound"
      aria-pressed={level > 0}
      // Makes its own level blip (setVolume), so skip the generic press blip.
      data-no-sound
      className={`ds-button bevel-paper flex h-11 min-w-11 max-[360px]:min-w-9 items-center justify-center text-ds-ink ${className}`}
    >
      <SpeakerIcon level={level} />
    </button>
  )
}

/**
 * Console-style volume: five equal dashes (" - - - - - "), empty white when off and
 * green when lit, up to the current level. One focusable slider (arrow keys, Home, End);
 * tapping a dash sets that level, and tapping the top lit dash steps down by one.
 */
export function VolumeBars({ className = '' }: { className?: string }) {
  const level = useVolume()

  const onKeyDown = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }
    if (e.key in step) setVolume(level + step[e.key])
    else if (e.key === 'Home') setVolume(0)
    else if (e.key === 'End') setVolume(MAX_VOLUME)
    else return
    e.preventDefault()
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={MAX_VOLUME}
      aria-valuenow={level}
      aria-valuetext={level === 0 ? 'Muted' : `${level} of ${MAX_VOLUME}`}
      onKeyDown={onKeyDown}
      className={`ds-focus flex h-11 touch-manipulation items-center gap-0.5 ${className}`}
    >
      {BARS.map((n) => (
        // Each column is a full-height tap target; the visible dash inside is small.
        <div
          key={n}
          onClick={() => setVolume(n === level ? n - 1 : n)}
          className="flex h-full w-6 cursor-pointer items-center justify-center"
        >
          <span
            aria-hidden="true"
            className={`block h-3.5 w-5 border-2 border-ds-frame ${n <= level ? 'bg-fb-match' : 'bg-ds-paper'}`}
          />
        </div>
      ))}
    </div>
  )
}
