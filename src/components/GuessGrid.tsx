import { useState } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import type { GuessFeedback } from '../lib/compare'
import type { Pokemon } from '../types/pokemon'
import { FeedbackRow } from './FeedbackRow'

interface GuessGridProps {
  guesses: Pokemon[]
  feedback: GuessFeedback[]
}

/**
 * The guess table. Newest guess on top. Only guesses made after the grid
 * mounted flip in, so a game restored on reload (or a mode switch, which
 * remounts the grid) appears instantly.
 *
 * Phones scroll the table sideways with the Pokémon column pinned; tablets
 * and desktops fit all nine columns.
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
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[700px] border-separate border-spacing-1 sm:min-w-0">
          <thead>
            <tr>
              {GRID_COLUMNS.map((col, i) => (
                <th
                  key={col}
                  scope="col"
                  className={`p-1 text-center text-[8px] leading-3 font-normal sm:text-[9px] ${
                    i === 0 ? 'sticky left-0 z-10 bg-ds-paper' : ''
                  }`}
                >
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
      <p className="mt-2 text-center text-[8px] text-ds-frame sm:hidden">Swipe the table sideways to see every column →</p>
    </div>
  )
}
