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
          {/* Two ds-buttons side by side (same border, shading and font as Hard / speaker / ?); the lit one is green like Hard when on. */}
          <div className="flex" role="group" aria-label="Game mode">
            {(['daily', 'endless'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                aria-pressed={mode === m}
                className={`ds-button h-11 px-1.5 text-[9px] uppercase max-[340px]:px-1 max-[340px]:text-[8px] sm:px-3 sm:text-[10px] ${
                  m === 'endless' ? '-ml-[3px]' : ''
                } ${mode === m ? 'bg-fb-match text-white' : 'bg-ds-paper text-ds-ink'}`}
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
