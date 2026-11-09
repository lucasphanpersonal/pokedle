import type { CSSProperties, ReactNode } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import { TILE_FLIP_STAGGER_MS } from '../config/uiConfig'
import {
  abilityCellText,
  formCellText,
  type GuessFeedback,
  type MatchFeedback,
  type NumberFeedback,
} from '../lib/compare'
import { formatDex } from '../lib/dexEntry'
import { iconUrl } from '../lib/pokedex'
import type { Pokemon } from '../types/pokemon'

interface FeedbackRowProps {
  guess: Pokemon
  feedback: GuessFeedback
  /** Hard mode: the Gen tile is left out. */
  hard?: boolean
  /** Flip the tiles in one by one (only for a guess made just now). */
  animate: boolean
}

type Result = MatchFeedback | NumberFeedback

/* Beveled DS-menu block: see .tile-bevel in index.css (light top edge, dark bottom edge). */
const TILE_EDGE = 'tile-bevel'

const BG: Record<Result, string> = {
  match: 'bg-fb-match',
  partial: 'bg-fb-partial text-ds-ink',
  mismatch: 'bg-fb-mismatch',
  higher: 'bg-fb-mismatch',
  lower: 'bg-fb-mismatch',
  unknown: 'bg-fb-mismatch',
}

const ARROW: Partial<Record<Result, string>> = { higher: '▲', lower: '▼' }

const LABEL: Record<Result, string> = {
  match: 'correct',
  partial: 'partly right',
  mismatch: 'wrong',
  higher: 'answer is higher',
  lower: 'answer is lower',
  unknown: 'unknown',
}

function Tile({
  result,
  index,
  animate,
  compact,
  tiny,
  children,
}: {
  result: Result
  index: number
  animate: boolean
  /** Smaller text and padding for the long-text columns (Form, Egg Group, Shared Ability). */
  compact?: boolean
  /** Smallest text, for "Undiscovered" and other long single words in narrow columns (Egg Group). */
  tiny?: boolean
  children: ReactNode
}) {
  const style: CSSProperties | undefined = animate ? { animationDelay: `${index * TILE_FLIP_STAGGER_MS}ms` } : undefined
  return (
    <td className="p-0">
      <div
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} relative flex h-16 flex-col items-center justify-center px-notch ${compact ? 'px-1' : 'px-2'} pb-1 text-center text-[9px] leading-[1.35] text-white ${TILE_EDGE} sm:h-[72px] ${tiny ? 'sm:text-[8px]' : compact ? 'sm:text-[9px]' : 'sm:text-[10px]'}`}
        style={style}
        data-result={result}
      >
        <span className="break-words">{children}</span>
        {ARROW[result] && (
          <span aria-hidden className="absolute bottom-[7px] left-0 right-0 text-[9px] leading-none">
            {ARROW[result]}
          </span>
        )}
        <span className="sr-only">, {LABEL[result]}</span>
      </div>
    </td>
  )
}

interface TileData {
  /** Column header, also used for screen readers. */
  label: (typeof GRID_COLUMNS)[number]
  result: Result
  content: ReactNode
}

/** The attribute tiles in column order (after the name), without Gen in Hard mode. */
function buildTiles(guess: Pokemon, feedback: GuessFeedback, hard: boolean): TileData[] {
  const tiles: TileData[] = [
    { label: 'Type 1', result: feedback.type1, content: guess.type1 },
    { label: 'Type 2', result: feedback.type2, content: guess.type2 ?? 'None' },
    { label: 'Gen', result: feedback.generation, content: <>Gen{" "}<br />{guess.generation}</> },
    { label: 'Height', result: feedback.height, content: <>{guess.height}{" "}<br />m</> },
    { label: 'Weight', result: feedback.weight, content: guess.weight > 0 ? <>{guess.weight}{" "}<br />kg</> : '???' },
    { label: 'Color', result: feedback.color, content: guess.color },
    { label: 'Evolution', result: feedback.evolutionStage, content: <>Stage{" "}<br />{guess.evolutionStage}</> },
    { label: 'Form', result: feedback.form, content: formCellText(guess) },
    { label: 'Egg Group', result: feedback.eggGroup, content: guess.eggGroups.join(', ') },
    { label: 'Shared Ability', result: feedback.ability.result, content: abilityCellText(guess, feedback.ability) },
  ]
  return hard ? tiles.filter((t) => t.label !== 'Gen') : tiles
}

/**
 * Phone layout: one compact card per guess (sprite + name, two rows of four
 * tiles, then full-width Egg Group and Shared Ability strips) so nothing scrolls sideways.
 * Tablets and desktops use the table row below.
 */
export function GuessCard({ guess, feedback, animate, hard = false }: FeedbackRowProps) {
  const tiles = buildTiles(guess, feedback, hard)
  const egg = tiles[tiles.length - 2]
  const ability = tiles[tiles.length - 1]
  // Two rows of four tiles; Hard mode has seven, so the top row is three wider ones.
  const topCount = hard ? 3 : 4
  const delay = (i: number): CSSProperties | undefined =>
    animate ? { animationDelay: `${i * TILE_FLIP_STAGGER_MS}ms` } : undefined
  const tile = (i: number, span: string) => {
    const { label, result, content } = tiles[i]
    return (
      <div
        key={i}
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} ${span} px-notch flex min-h-11 flex-col items-center justify-center px-0.5 text-center text-[8px] leading-[1.3] text-white ${TILE_EDGE}`}
        style={delay(i + 1)}
        data-result={result}
      >
        <span className="sr-only">{label}: </span>
        <span className="[overflow-wrap:anywhere]">
          {content}
          {ARROW[result] && (
            <span aria-hidden className="ml-0.5 text-[9px]">
              {ARROW[result]}
            </span>
          )}
        </span>
        <span className="sr-only">, {LABEL[result]}</span>
      </div>
    )
  }
  return (
    <li className="grid grid-cols-12 gap-1 border-t-2 border-dashed border-ds-frame/30 py-2 first:border-t-0 first:pt-0 last:pb-0">
      <div
        className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-11 items-center gap-2 px-2 text-[9px] text-white ${TILE_EDGE}`}
        data-result={feedback.pokemon}
      >
        <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-my-1 h-10 w-10 shrink-0 [image-rendering:pixelated]" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{guess.name}</span>
        <span className="ml-auto shrink-0 text-[8px] opacity-80">{formatDex(guess.dexNumber)}</span>
        <span className="sr-only">, {LABEL[feedback.pokemon]}</span>
      </div>
      {tiles.slice(0, topCount).map((_, i) => tile(i, hard ? 'col-span-4' : 'col-span-3'))}
      {tiles.slice(topCount, -2).map((_, i) => tile(topCount + i, 'col-span-3'))}
      <div
        className={`${BG[egg.result]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-9 items-center justify-center px-2 py-1.5 text-center text-[8px] leading-[1.6] text-white ${TILE_EDGE}`}
        style={delay(tiles.length - 1)}
        data-result={egg.result}
      >
        <span className="[overflow-wrap:anywhere]">Egg Group: {egg.content}</span>
        <span className="sr-only">, {LABEL[egg.result]}</span>
      </div>
      <div
        className={`${BG[ability.result]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-9 items-center justify-center px-2 py-1.5 text-center text-[8px] leading-[1.6] text-white ${TILE_EDGE}`}
        style={delay(tiles.length)}
        data-result={ability.result}
      >
        <span className="[overflow-wrap:anywhere]">Ability: {ability.content}</span>
        <span className="sr-only">, {LABEL[ability.result]}</span>
      </div>
    </li>
  )
}

export function FeedbackRow({ guess, feedback, animate, hard = false }: FeedbackRowProps) {
  const tiles = buildTiles(guess, feedback, hard)
  return (
    <tr>
      <th scope="row" className="p-0 font-normal">
        <div
          className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} relative flex h-16 w-full flex-col items-center justify-center px-notch text-[7px] leading-[10px] text-white ${TILE_EDGE} sm:h-[72px] sm:text-[8px]`}
          data-result={feedback.pokemon}
        >
          <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-my-1 h-10 w-10 [image-rendering:pixelated]" />
          <span className="line-clamp-2 px-1 text-center [overflow-wrap:anywhere]">{guess.name}</span>
          <span className="absolute right-3 top-2 text-[7px] leading-none opacity-80">{formatDex(guess.dexNumber)}</span>
        </div>
      </th>
      {tiles.map(({ label, result, content }, i) => (
        <Tile key={label} result={result} index={i + 1} animate={animate} compact={label === 'Type 1' || label === 'Type 2' || label === 'Form' || label === 'Egg Group' || label === 'Shared Ability'} tiny={label === 'Egg Group'}>
          {content}
        </Tile>
      ))}
    </tr>
  )
}
