export type GameMode = 'daily' | 'endless'

interface HeaderProps {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  onHelp: () => void
}

export function Header({ mode, onModeChange, onHelp }: HeaderProps) {
  return (
    <header className="ds-titlebar flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <h1 className="text-[11px] sm:text-xl whitespace-nowrap">POKEMONDLE</h1>
      <div className="flex items-center gap-2 text-[10px] sm:text-xs">
        {(['daily', 'endless'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            className={`rounded-md border-2 border-ds-frame px-2 py-1 uppercase ${
              mode === m ? 'bg-ds-paper text-ds-ink' : 'bg-ds-red-dark text-ds-paper'
            }`}
          >
            {m}
          </button>
        ))}
        <button
          type="button"
          onClick={onHelp}
          aria-label="How to play"
          className="rounded-md border-2 border-ds-frame bg-ds-paper px-2 py-1 text-ds-ink"
        >
          ?
        </button>
      </div>
    </header>
  )
}
