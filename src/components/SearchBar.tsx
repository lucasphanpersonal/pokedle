import { useId, useState, type FormEvent } from 'react'
import type { GuessResult } from '../lib/game'
import type { Pokemon } from '../types/pokemon'

interface SearchBarProps {
  pokedex: Pokemon[]
  onGuess: (pokemon: Pokemon) => GuessResult
  disabled?: boolean
}

const normalize = (s: string) => s.trim().toLowerCase().replaceAll('’', "'")

/**
 * Minimal guess input: native suggestions, and only exact Pokémon names are
 * accepted. The styled autocomplete dropdown replaces this in step 4.
 */
export function SearchBar({ pokedex, onGuess, disabled }: SearchBarProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listId = useId()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const match = pokedex.find((p) => normalize(p.name) === normalize(value))
    if (!match) return setError('Pick a Pokémon from the list.')
    const result = onGuess(match)
    if (result === 'duplicate') return setError(`You already guessed ${match.name}.`)
    setError(null)
    setValue('')
  }

  return (
    <form onSubmit={submit} className="ds-box flex flex-col gap-2 p-3">
      <div className="flex gap-2">
        <input
          type="text"
          list={listId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder="Who's that Pokémon?"
          aria-label="Guess a Pokémon"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ds-frame-light"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md border-2 border-ds-frame bg-ds-red px-3 py-2 text-[10px] text-ds-paper disabled:opacity-50"
        >
          Guess
        </button>
      </div>
      <datalist id={listId}>
        {pokedex.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      {error && <p className="text-[8px] text-ds-red-dark" role="alert">{error}</p>}
    </form>
  )
}
