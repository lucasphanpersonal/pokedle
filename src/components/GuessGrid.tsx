import { GRID_COLUMNS } from '../config/gameConfig'
import type { GuessFeedback } from '../lib/compare'
import type { Pokemon } from '../types/pokemon'
import { FeedbackRow } from './FeedbackRow'

interface GuessGridProps {
  guesses: Pokemon[]
  feedback: GuessFeedback[]
}

export function GuessGrid({ guesses, feedback }: GuessGridProps) {
  return (
    <div className="ds-box overflow-x-auto p-3">
      <table className="w-full min-w-[760px] border-separate border-spacing-1 text-center">
        <thead>
          <tr>
            {GRID_COLUMNS.map((col) => (
              <th key={col} className="p-1 text-[8px] sm:text-[10px]">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Newest guess on top, like most Pokédle-style games. */}
          {guesses
            .map((g, i) => ({ g, f: feedback[i] }))
            .reverse()
            .map(({ g, f }) => (
              <FeedbackRow key={g.id} guess={g} feedback={f} />
            ))}
        </tbody>
      </table>
      {guesses.length === 0 && (
        <p className="py-4 text-center text-[10px] text-ds-frame">No guesses yet.</p>
      )}
    </div>
  )
}
