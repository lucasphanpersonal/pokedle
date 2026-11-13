import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { GuessResult } from '../lib/game'
import { formatDex } from '../lib/dexEntry'
import { findGuessedByName, iconUrl, searchPokemon } from '../lib/pokedex'
import { playSound } from '../lib/sound'
import type { Pokemon } from '../types/pokemon'

interface SearchBarProps {
  pokedex: Pokemon[]
  /** Ids already guessed this game: hidden from suggestions. */
  guessedIds: number[]
  onGuess: (pokemon: Pokemon) => GuessResult
  disabled?: boolean
  /** Placeholder shown while disabled (the game is over). */
  doneText?: string
  /** Once the game is over: a button that takes the Guess button's place (See results). */
  doneAction?: ReactNode
  /** The done buttons need the whole box on phones (Endless has two), so the done text hides there. */
  doneWide?: boolean
}

const MAX_SUGGESTIONS = 8

/**
 * Autocomplete guess box (ARIA combobox). Only a Pokémon picked from the list
 * can be submitted. Keyboard: type, ↑/↓ to move, Enter to guess, Esc to close.
 * Touch: tap a suggestion.
 */
export function SearchBar({ pokedex, guessedIds, onGuess, disabled, doneText = 'You got it!', doneAction, doneWide }: SearchBarProps) {
  const done = disabled && !!doneAction
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // True once the player moves through the list with the arrow keys, so Enter is a deliberate pick.
  const [navigated, setNavigated] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const pool = useMemo(() => {
    const guessed = new Set(guessedIds)
    return pokedex.filter((p) => !guessed.has(p.id))
  }, [pokedex, guessedIds])
  const suggestions = useMemo(() => searchPokemon(pool, query, MAX_SUGGESTIONS), [pool, query])
  const showList = open && suggestions.length > 0 && !disabled

  const choose = (pokemon: Pokemon) => {
    const result = onGuess(pokemon)
    if (result === 'duplicate') {
      playSound('error')
      setMessage(`You already guessed ${pokemon.name}.`)
      return
    }
    if (result === 'ok') playSound('select')
    setMessage(null)
    setQuery('')
    setOpen(false)
    setActive(0)
    setNavigated(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault()
      setOpen(true)
      setNavigated(true)
      playSound('move')
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault()
      setOpen(true)
      setNavigated(true)
      playSound('move')
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!query.trim()) {
        playSound('error')
        return setMessage('Type a Pokémon name to guess.')
      }
      // Typing the exact name of a Pokémon already guessed must not fall through to the next suggestion
      // (e.g. "pikachu" twice would otherwise guess Pikachu Rock Star).
      const repeat = navigated ? undefined : findGuessedByName(pokedex, guessedIds, query)
      if (repeat) {
        playSound('error')
        return setMessage(`You already guessed ${repeat.name}.`)
      }
      if (!suggestions.length) {
        playSound('error')
        return setMessage('No Pokémon by that name.')
      }
      // If the list was closed (Esc), Enter reopens it rather than guessing blind.
      if (!showList) return setOpen(true)
      choose(suggestions[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <div className={`ds-box flex items-center gap-2 p-2 pl-4 ${done && doneWide ? 'max-sm:pl-2' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-label="Guess a Pokémon"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          disabled={disabled}
          placeholder={disabled ? doneText : "Who's that Pokémon?"}
          onChange={(e) => {
            playSound('type', Math.floor(Math.random() * 3))
            setQuery(e.target.value)
            setOpen(true)
            setActive(0)
            setNavigated(false)
            setMessage(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          // 16px on phones stops iOS Safari zooming into the field.
          className={`${done && doneWide ? 'max-sm:hidden ' : ''}min-h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[11px] placeholder:text-ds-frame max-[360px]:placeholder:text-[9px] sm:text-xs`}
        />
        {done ? (
          <div className={`flex shrink-0 gap-2 ${doneWide ? 'max-sm:flex-1 max-sm:justify-center' : ''}`}>{doneAction}</div>
        ) : (
          <button
            type="button"
            disabled={disabled || !showList || !suggestions[active]}
            // Keep focus (and the open list) in the input when the button is pressed.
            onMouseDown={(e) => e.preventDefault()}
            data-no-sound
            onClick={() => showList && suggestions[active] && choose(suggestions[active])}
            className="ds-button bevel-red px-3 text-[10px] text-ds-paper disabled:opacity-40"
          >
            Guess
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching Pokémon"
          className="ds-box absolute inset-x-0 top-full z-40 mt-1 max-h-[50dvh] overflow-y-auto p-2"
          // Keep focus in the input while tapping or clicking an option.
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(p)}
              className={`flex min-h-11 cursor-pointer items-center gap-3 px-notch px-2 tx-10 sm:text-xs ${
                i === active ? 'bg-ds-sky-bottom' : ''
              }`}
            >
              <img src={iconUrl(p.id)} alt="" width={40} height={40} loading="lazy" className="h-10 w-10 [image-rendering:pixelated]" />
              <span className="flex-1 leading-4">{p.name}</span>
              <span className="tx-8 text-ds-frame">{formatDex(p.dexNumber)}</span>
            </li>
          ))}
        </ul>
      )}

      {message && (
        <p role="alert" className="mt-2 text-center tx-9 text-ds-red-dark">
          {message}
        </p>
      )}
    </div>
  )
}
