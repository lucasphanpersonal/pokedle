import { setHardPref } from '../lib/hardMode'

interface HardToggleProps {
  /** The Hard mode state the screen is showing: this game's while locked, otherwise the next game's. */
  hard: boolean
  /** The game in progress has guesses, so Hard mode can't change until it is solved. */
  hardLocked: boolean
  className?: string
}

/**
 * Pixel toggle for Hard mode (hides the Gen column). Shown in the header on wide screens and under History on phones.
 * On/off is shown by the pressed style, like the Daily/Endless toggle. The caller sets the display class.
 */
export function HardToggle({ hard, hardLocked, className = '' }: HardToggleProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!hardLocked) setHardPref(!hard)
      }}
      aria-pressed={hard}
      aria-disabled={hardLocked || undefined}
      aria-describedby={hardLocked ? 'hard-lock-note' : undefined}
      title={
        hardLocked
          ? 'Hard mode is locked for this game. It applies to your next Daily or a new Endless game.'
          : 'Hard mode: hides the Gen column'
      }
      className={`ds-button h-11 items-center justify-center whitespace-nowrap px-2 text-center text-[9px] max-[340px]:px-1.5 sm:px-3 sm:text-[10px] ${
        hard ? 'bg-fb-match text-white' : 'bg-ds-paper text-ds-ink'
      } ${hardLocked ? 'cursor-not-allowed opacity-75' : ''} ${className}`}
    >
      Hard
    </button>
  )
}
