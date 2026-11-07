import type { GameMode } from '../lib/game'

interface HeaderProps {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  onHelp: () => void
}

export function Header({ mode, onModeChange, onHelp }: HeaderProps) {
  return (
    <header className="ds-titlebar px-3 py-2 sm:px-5 sm:py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <h1 className="text-[13px] whitespace-nowrap sm:text-xl">POKEMONDLE</h1>
        <nav className="flex items-center gap-2" aria-label="Game mode">
          <div className="px-notch flex border-[3px] border-ds-frame bg-ds-red-dark p-0.5" role="group">
            {(['daily', 'endless'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                aria-pressed={mode === m}
                className={`ds-focus-inset min-h-10 px-2 text-[9px] uppercase sm:px-3 sm:text-[10px] ${
                  mode === m ? 'bg-ds-paper text-ds-ink shadow-[0_2px_0_var(--color-ds-frame)]' : 'text-ds-paper'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onHelp}
            aria-label="How to play"
            className="ds-button min-w-11 bg-ds-paper text-xs text-ds-ink"
          >
            ?
          </button>
        </nav>
      </div>
    </header>
  )
}
