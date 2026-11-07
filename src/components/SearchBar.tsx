import type { Pokemon } from '../types/pokemon'

interface SearchBarProps {
  pokedex: Pokemon[]
  onGuess: (pokemon: Pokemon) => void
  disabled?: boolean
}

/** Autocomplete search. Full filtering and keyboard navigation come in step 4. */
export function SearchBar({ disabled }: SearchBarProps) {
  return (
    <div className="ds-box p-3">
      <input
        type="text"
        disabled={disabled}
        placeholder="Who's that Pokémon?"
        className="w-full bg-transparent text-xs outline-none placeholder:text-ds-frame-light"
      />
    </div>
  )
}
