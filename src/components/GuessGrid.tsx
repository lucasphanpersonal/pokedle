import { useState } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import type { GuessFeedback } from '../lib/compare'
import type { Pokemon } from '../types/pokemon'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { abilityColumnFit } from '../lib/tileText'
import { FeedbackRow, GuessCard } from './FeedbackRow'

/** Tailwind's lg breakpoint (1024 px): the table from here up, cards below. */
const TABLE_QUERY = '(min-width: 64rem)'

/**
 * Share of the table width for each column (sums to 100). Fixed widths stop the
 * Shared Ability text from taking over the table and squeezing the others.
 * Each leaves room for the common words at full size; anything longer shrinks to fit inside the tile padding (.tile-fit in index.css) or wraps at a soft hyphen (lib/tileText.ts).
 * Pokémon is widest so almost every name (all but "Paldean Tauros (Combat Breed)") fits on three lines at 7px or more;
 * Shared Ability is sized by line count (abilityFit in FeedbackRow.tsx), so three long abilities still stay inside the tile.
 */
const COLUMN_WIDTHS = [12.5, 10.375, 10.375, 6, 7, 7, 9, 8, 8.5, 9.5, 11.75]

/** Phone key: the labels of the card's two tile rows, in column order. */
const KEY_TOP = ['Type 1', 'Type 2', 'Gen', 'Height']
const HARD_KEY_TOP = ['Type 1', 'Type 2', 'Height']
const KEY_BOTTOM = ['Weight', 'Color', 'Evolution', 'Form']

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
 * Only the layout that fits is rendered, so each guess's tiles exist once in the DOM.
 */
export function GuessGrid({ guesses, feedback, hard = false }: GuessGridProps) {
  const columns = hard ? HARD_COLUMNS : GRID_COLUMNS
  const widths = hard ? HARD_WIDTHS : COLUMN_WIDTHS
  const abilityColumn = abilityColumnFit(guesses, feedback)
  const showTable = useMediaQuery(TABLE_QUERY)
  // Captured once at mount: how many guesses were restored rather than made now.
  const [restoredCount, setRestoredCount] = useState(guesses.length)
  // Crossing the breakpoint (rotating an iPad) mounts the other layout's rows;
  // treat every guess so far as restored so they don't flip in a second time.
  const [layoutShown, setLayoutShown] = useState(showTable)
  if (layoutShown !== showTable) {
    setLayoutShown(showTable)
    setRestoredCount(guesses.length)
  }

  if (guesses.length === 0) {
    return (
      <div className="ds-box p-6 text-center text-[10px] leading-5 text-ds-frame">
        Make your first guess to start!
      </div>
    )
  }

  return (
    <div className="ds-box p-2 sm:p-3">
      {showTable ? (
        <div>
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
                  <FeedbackRow key={g.id} guess={g} feedback={f} hard={hard} animate={i >= restoredCount} abilityColumn={abilityColumn} />
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          {/*
            Key laid out like the card's two rows of tiles (Egg Group and Ability strips label themselves).
            Phrased as a sentence it wrapped unevenly on narrow phones.
          */}
          <div className="grid gap-x-3 min-[720px]:grid-cols-2">
            {/* From 720px wide (iPad portrait) the cards sit two to a row, each with its own copy of the key. */}
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden
                className={`mb-2 grid-cols-12 gap-x-1 text-center text-[8px] leading-3 text-ds-frame max-[360px]:text-[7px] sm:text-[9px] sm:leading-4 ${
                  copy ? 'hidden min-[720px]:grid' : 'grid'
                }`}
              >
                {(hard ? HARD_KEY_TOP : KEY_TOP).map((label) => (
                  <span key={label} className={hard ? 'col-span-4' : 'col-span-3'}>
                    {label}
                  </span>
                ))}
                {KEY_BOTTOM.map((label) => (
                  <span key={label} className="col-span-3">
                    {label}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <ul className="grid grid-cols-1 gap-x-3 min-[720px]:grid-cols-2">
            {guesses
              .map((g, i) => ({ g, f: feedback[i], i }))
              .reverse()
              .map(({ g, f, i }) => (
                <GuessCard key={g.id} guess={g} feedback={f} hard={hard} animate={i >= restoredCount} />
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
