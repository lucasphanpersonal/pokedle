import { useState } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import type { GuessFeedback } from '../lib/compare'
import type { Pokemon } from '../types/pokemon'
import { FeedbackRow, GuessCard } from './FeedbackRow'

interface GuessGridProps {
  guesses: Pokemon[]
  feedback: GuessFeedback[]
}

/**
 * The guess table. Newest guess on top. Only guesses made after the grid
 * mounted flip in, so a game restored on reload (or a mode switch, which
 * remounts the grid) appears instantly.
 *
 * Phones show one compact card per guess (no sideways scrolling); tablets
 * and desktops show the full nine-column table.
 */
export function GuessGrid({ guesses, feedback }: GuessGridProps) {
  // Captured once at mount: how many guesses were restored rather than made now.
  const [restoredCount] = useState(guesses.length)

  if (guesses.length === 0) {
    return (
      <div className="ds-box p-6 text-center text-[10px] leading-5 text-ds-frame">
        Make your first guess to start!
      </div>
    )
  }

  return (
    <div className="ds-box p-2 sm:p-3">
      <div className="sm:hidden">
        <p aria-hidden className="mb-2 text-center text-[8px] leading-3 text-ds-frame">
          Top: Type 1 · Type 2 · Gen · Height
          <br />
          Then: Weight · Color · Evolution
          <br />
          Bottom: Shared Ability
        </p>
        <ul className="flex flex-col gap-2">
          {guesses
            .map((g, i) => ({ g, f: feedback[i], i }))
            .reverse()
            .map(({ g, f, i }) => (
              <GuessCard key={g.id} guess={g} feedback={f} animate={i >= restoredCount} />
            ))}
        </ul>
      </div>
      <div className="hidden sm:block">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              {GRID_COLUMNS.map((col) => (
                <th key={col} scope="col" className="p-1 text-center text-[9px] leading-3 font-normal">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guesses
              .map((g, i) => ({ g, f: feedback[i], i }))
              .reverse()
              .map(({ g, f, i }) => (
                <FeedbackRow key={g.id} guess={g} feedback={f} animate={i >= restoredCount} />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
