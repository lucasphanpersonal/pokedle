import type { Pokemon } from '../types/pokemon'
import { GRID_COLUMNS } from '../config/gameConfig'
import { FeedbackRow } from './FeedbackRow'

interface GuessGridProps {
  guesses: Pokemon[]
}

export function GuessGrid({ guesses }: GuessGridProps) {
  return (
    <div className="ds-box overflow-x-auto p-3">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center">
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
          {guesses.map((g) => (
            <FeedbackRow key={g.id} guess={g} />
          ))}
        </tbody>
      </table>
      {guesses.length === 0 && (
        <p className="py-4 text-center text-[10px] text-ds-frame">No guesses yet.</p>
      )}
    </div>
  )
}
