import type { GameMode } from '../lib/game'
import { HardToggle } from './HardToggle'
import { SpeakerButton, VolumeBars } from './VolumeControl'

interface HeaderProps {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  onHelp: () => void
  /** Whether the game on screen is played in Hard mode (shown while locked). */
  hard: boolean
  /** The game in progress has guesses, so Hard mode can't change until it is solved. */
  hardLocked: boolean
}

export function Header({ mode, onModeChange, onHelp, hard, hardLocked }: HeaderProps) {
  return (
    <header className="ds-titlebar px-2 py-2 sm:px-5 sm:py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-1 sm:gap-2">
        <h1 className="text-[12px] whitespace-nowrap max-[380px]:text-[10px] max-[340px]:text-[8px] sm:text-xl">POKEMONDLE</h1>
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Game controls">
          {/* One segmented control (a radio group: exactly one mode is on). The chosen side is green and pressed in; the other is raised. */}
          <div
            className="px-notch flex h-11 gap-[3px] border-[3px] border-ds-frame bg-ds-frame"
            role="radiogroup"
            aria-label="Game mode"
            onKeyDown={(e) => {
              if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
              e.preventDefault()
              const next = mode === 'daily' ? 'endless' : 'daily'
              onModeChange(next)
              e.currentTarget.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus()
            }}
          >
            {(['daily', 'endless'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                data-mode={m}
                aria-checked={mode === m}
                tabIndex={mode === m ? 0 : -1}
                onClick={() => onModeChange(m)}
                className={`ds-focus-inset h-full px-1.5 text-[9px] uppercase max-[340px]:px-1 max-[340px]:text-[8px] sm:px-3 sm:text-[10px] ${
                  mode === m
                    ? 'bg-[color-mix(in_srgb,var(--color-fb-match),black_22%)] text-white shadow-[inset_0_4px_0_rgb(0_0_0/0.3),inset_4px_0_0_rgb(0_0_0/0.12),inset_-4px_0_0_rgb(0_0_0/0.12)]'
                    : 'bg-ds-paper text-ds-ink shadow-[inset_0_-4px_0_rgb(0_0_0/0.22)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <HardToggle hard={hard} hardLocked={hardLocked} className="hidden sm:inline-flex" />
          {/* Bars live in the header from 760px wide up; on phones they are in Help (the header is full). */}
          <div className="ds-button hidden h-11 items-center gap-1 bg-ds-paper pr-1 text-ds-ink min-[760px]:flex">
            <SpeakerButton className="!h-full !min-h-0 !border-0 !shadow-none" />
            <VolumeBars className="!h-full" />
          </div>
          <SpeakerButton className="min-[760px]:hidden" />
          <button
            type="button"
            onClick={onHelp}
            aria-label="How to play"
            className="ds-button min-w-11 max-[340px]:min-w-9 h-11 bg-ds-paper text-[10px] text-ds-ink"
          >
            ?
          </button>
        </nav>
      </div>
    </header>
  )
}
