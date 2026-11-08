import { useSyncExternalStore } from 'react'
import type { GameMode } from '../lib/game'
import { isSoundOn, setSoundOn, subscribeSound } from '../lib/sound'

interface HeaderProps {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  onHelp: () => void
}

export function Header({ mode, onModeChange, onHelp }: HeaderProps) {
  const sound = useSyncExternalStore(subscribeSound, isSoundOn, () => true)
  return (
    <header className="ds-titlebar px-2 py-2 sm:px-5 sm:py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-1 sm:gap-2">
        <h1 className="text-[12px] whitespace-nowrap max-[380px]:text-[10px] max-[340px]:text-[8px] sm:text-xl">POKEMONDLE</h1>
        <nav className="flex items-center gap-1.5 sm:gap-2" aria-label="Game mode">
          <div className="px-notch flex border-[3px] border-ds-frame bg-ds-red-dark p-0.5" role="group">
            {(['daily', 'endless'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                aria-pressed={mode === m}
                className={`ds-focus-inset min-h-10 px-1.5 text-[9px] max-[340px]:px-1 max-[340px]:text-[8px] uppercase sm:px-3 sm:text-[10px] ${
                  mode === m ? 'bg-ds-paper text-ds-ink shadow-[0_2px_0_var(--color-ds-frame)]' : 'text-ds-paper'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setSoundOn(!sound)
            }}
            aria-label="Sound effects"
            aria-pressed={sound}
            className="ds-button flex min-h-11 min-w-11 max-[340px]:min-w-9 items-center justify-center bg-ds-paper text-ds-ink"
          >
            <svg viewBox="1.5 1 14 14" width="18" height="18" shapeRendering="crispEdges" fill="currentColor" aria-hidden="true">
              <path d="M2 6h3l4-3v10l-4-3H2z" />
              {sound ? (
                <path d="M10 6h1v4h-1zM12 4h1v8h-1zM14 2h1v12h-1z" />
              ) : (
                <path d="M11 6h1v1h1v1h1V7h1V6h-1V5h-1v1h-1V5h-1zM11 10h1V9h1v1h1v1h1v1h-1v-1h-1v1h-1v-1h-1z" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={onHelp}
            aria-label="How to play"
            className="ds-button min-w-11 max-[340px]:min-w-9 bg-ds-paper text-xs text-ds-ink"
          >
            ?
          </button>
        </nav>
      </div>
    </header>
  )
}
