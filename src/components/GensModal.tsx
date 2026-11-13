import { useState } from 'react'
import { ALL_GENS, gensLabel, sameGens } from '../lib/gens'
import { Modal } from './Modal'

interface GensModalProps {
  /** The Gens currently chosen. */
  gens: readonly number[]
  /** How many Pokémon each Gen has (index 0 = Gen 1). */
  counts: readonly number[]
  /** The Endless game on screen already has guesses, so a change waits for the next game. */
  gameStarted: boolean
  /** Called with the new choice (never empty) when the player confirms. */
  onSave: (gens: number[]) => void
  onClose: () => void
}

/**
 * Endless mode's Gen picker: nine on/off tiles plus All and None. Like every toggle in the game, an
 * "on" tile is green and pressed in (inverse bevel) and an "off" tile is white and raised, so on/off
 * never depends on colour alone. The choice is saved with OK; closing the box any other way keeps the
 * old one. At least one Gen must be on.
 */
export function GensModal({ gens, counts, gameStarted, onSave, onClose }: GensModalProps) {
  const [draft, setDraft] = useState<readonly number[]>(gens)
  const toggle = (gen: number) =>
    setDraft((d) => (d.includes(gen) ? d.filter((g) => g !== gen) : [...d, gen].sort((a, b) => a - b)))
  const total = draft.reduce((sum, g) => sum + (counts[g - 1] ?? 0), 0)
  const empty = draft.length === 0
  const changed = !sameGens(draft, gens)

  return (
    <Modal title="Endless Gens" onClose={onClose}>
      <div className="flex flex-col gap-4 tx-10 leading-5">
        <p>Choose which generations Endless picks its Pokémon from. You can still guess any Pokémon.</p>
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <div role="group" aria-label="Generations" className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {ALL_GENS.map((gen) => {
              const on = draft.includes(gen)
              return (
                <button
                  key={gen}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(gen)}
                  className={`ds-button h-11 px-2.5 text-[10px] ${
                    on ? 'bevel-green bevel-pressed text-white [text-shadow:1px_1px_0_rgb(0_0_0/0.4)]' : 'bevel-paper text-ds-ink'
                  }`}
                >
                  Gen {gen}
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <button type="button" onClick={() => setDraft(ALL_GENS)} className="ds-button bevel-paper h-11 px-3 text-[10px]">
              All
            </button>
            <button type="button" onClick={() => setDraft([])} className="ds-button bevel-paper h-11 px-3 text-[10px]">
              None
            </button>
          </div>
        </div>
        {/* Always mounted so screen readers announce each change. */}
        <p role="status" className="text-center tx-9 text-ds-frame">
          {empty ? 'Pick at least one Gen.' : `${gensLabel(draft)} · ${total} Pokémon`}
        </p>
        <p className="tx-9 text-ds-frame">
          Forms count by their debut: Megas are Gen 6, Alolan forms Gen 7.{' '}
          {gameStarted
            ? 'The game on screen keeps its Pokémon. A change applies from your next one.'
            : 'A change picks a new Pokémon.'}
        </p>
        <button
          type="button"
          disabled={empty}
          onClick={() => {
            if (changed) onSave([...draft])
            onClose()
          }}
          className="ds-button bevel-red h-11 px-3 text-[10px] text-ds-paper disabled:opacity-40"
        >
          OK
        </button>
      </div>
    </Modal>
  )
}
