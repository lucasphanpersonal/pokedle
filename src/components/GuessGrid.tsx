import { useState } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import type { GuessFeedback } from '../lib/compare'
import type { Pokemon } from '../types/pokemon'
import { FeedbackRow, GuessCard } from './FeedbackRow'

/**
 * Share of the table width for each column (sums to 100). Fixed widths stop the
 * Shared Ability text from taking over the table and squeezing the others.
 * Each leaves room, after the tile padding, for its longest single word ("Gigantamax", "Fighting", "Yellow"); Gen, Height, Weight and Evolution may wrap at spaces. Form and Shared Ability use smaller text so three long abilities fit on up to three lines.
 */
const COLUMN_WIDTHS = [11, 9, 9, 6, 7, 7, 8, 8, 9, 12, 14]

interface GuessGridProps {
  guesses: Pokemon[]
  feedback: GuessFeedback[]
  /** Hard mode: the Gen column is hidden. */
  hard?: boolean
}

/** Column widths with Gen removed (index 3), scaled back up to 100. */
const HARD_COLUMNS = GRID_COLUMNS.filter((c) => c !== 'Gen')
const HARD_WIDTHS = (() => {
  const rest = COLUMN_WIDTHS.filter((_, i) => GRID_COLUMNS[i] !== 'Gen')
  const total = rest.reduce((a, b) => a + b, 0)
  return rest.map((w) => (w * 100) / total)
})()

/**
 * The guess table. Newest guess on top. Only guesses made after the grid
 * mounted flip in, so a game restored on reload (or a mode switch, which
 * remounts the grid) appears instantly.
 *
 * Phones and tablets under 1024 px show one compact card per guess (no sideways
 * scrolling); larger tablets and desktops show the full eleven-column table.
 */
export function GuessGrid({ guesses, feedback, hard = false }: GuessGridProps) {
  const columns = hard ? HARD_COLUMNS : GRID_COLUMNS
  const widths = hard ? HARD_WIDTHS : COLUMN_WIDTHS
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
      <div className="lg:hidden">
        <p aria-hidden className="mb-2 text-center text-[8px] leading-3 text-ds-frame">
          {hard ? 'Top: Type 1 · Type 2 · Height' : 'Top: Type 1 · Type 2 · Gen · Height'}
          <br />
          Then: Weight · Color · Evolution · Form
          <br />
          Bottom: Egg Group · Shared Ability
        </p>
        <ul className="flex flex-col">
          {guesses
            .map((g, i) => ({ g, f: feedback[i], i }))
            .reverse()
            .map(({ g, f, i }) => (
              <GuessCard key={g.id} guess={g} feedback={f} hard={hard} animate={i >= restoredCount} />
            ))}
        </ul>
      </div>
      <div className="hidden lg:block">
        <table className="w-full table-fixed border-separate border-spacing-1">
          <colgroup>
            {widths.map((w, i) => (
              <col key={columns[i]} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((col) => (
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
                <FeedbackRow key={g.id} guess={g} feedback={f} hard={hard} animate={i >= restoredCount} />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
