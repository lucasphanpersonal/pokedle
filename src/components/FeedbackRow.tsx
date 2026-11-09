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
import { breakable, lineChars, longestPiece, longestWord } from '../lib/tileText'
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

/* Beveled DS-menu block: see .bevel in index.css (light top edge, dark bottom edge), shared with every button. */
const TILE_EDGE = 'bevel'

/** Font-fit variables for a tile (see .tile-fit in index.css): base size, longest word and longest unbreakable piece. */
interface Fit {
  chars: number
  piece: number
}
const fitOf = (...parts: (string | number)[]): Fit => ({ chars: longestWord(...parts), piece: longestPiece(...parts) })
/**
 * Shared Ability can be three long names, so it is sized by line count as well as by its longest
 * word: the largest size (up to 9px) at which it wraps onto 4 lines, or else up to 8px on 5 lines.
 * Both fit inside the 72px table tile. Wraps at spaces only, like the browser.
 */
const abilityFit = (text: string): Fit => ({ chars: lineChars(text, 4), piece: lineChars(text, 5) })
/** Pass fs as null when a class sets --fs (so it can change with screen width). */
const fit = (fs: number | null, { chars, piece }: Fit, extra?: CSSProperties): CSSProperties =>
  ({ ...extra, ...(fs === null ? {} : { '--fs': `${fs}px` }), '--chars': chars, '--piece': piece }) as CSSProperties

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
  fit: textFit,
  hyphenate,
  children,
}: {
  result: Result
  index: number
  animate: boolean
  /** Smaller text and padding for the long-text columns (Form, Egg Group, Shared Ability). */
  compact?: boolean
  /** Smallest text, for "Undiscovered" and other long single words in narrow columns (Egg Group). */
  tiny?: boolean
  /** Longest word and piece in the tile, so the text can shrink to fit inside the padding. */
  fit: Fit
  /** Let the browser hyphenate words too long for the tile (ability names), instead of cutting them anywhere. */
  hyphenate?: boolean
  children: ReactNode
}) {
  const style = fit(tiny ? 8 : compact ? 9 : 10, textFit, animate ? { animationDelay: `${index * TILE_FLIP_STAGGER_MS}ms` } : undefined)
  return (
    <td className="p-0">
      <div
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} tile-fit relative flex h-16 flex-col items-center justify-center px-notch px-2.5 pb-1 text-center leading-[1.35] text-white ${TILE_EDGE} sm:h-[72px]`}
        style={style}
        data-result={result}
      >
        <span className={`fit ${hyphenate ? '[hyphens:auto]' : ''}`}>{children}</span>
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
  /** Longest word and unbreakable piece in the content (see tileText.ts). */
  chars: Fit
}

/** The attribute tiles in column order (after the name), without Gen in Hard mode. */
function buildTiles(guess: Pokemon, feedback: GuessFeedback, hard: boolean): TileData[] {
  const tiles: TileData[] = [
    { label: 'Type 1', result: feedback.type1, content: breakable(guess.type1), chars: fitOf(guess.type1) },
    { label: 'Type 2', result: feedback.type2, content: breakable(guess.type2 ?? 'None'), chars: fitOf(guess.type2 ?? 'None') },
    { label: 'Gen', result: feedback.generation, content: <>Gen{" "}<br />{guess.generation}</>, chars: fitOf('Gen', guess.generation) },
    // Units sit on their own line; count one extra character for the ▲/▼ that follows them on phones.
    { label: 'Height', result: feedback.height, content: <>{guess.height}{" "}<br />m</>, chars: fitOf(guess.height, 'm▲') },
    {
      label: 'Weight',
      result: feedback.weight,
      content: guess.weight > 0 ? <>{guess.weight}{" "}<br />kg</> : '???',
      chars: guess.weight > 0 ? fitOf(guess.weight, 'kg▲') : fitOf('???'),
    },
    { label: 'Color', result: feedback.color, content: breakable(guess.color), chars: fitOf(guess.color) },
    { label: 'Evolution', result: feedback.evolutionStage, content: <>Stage{" "}<br />{guess.evolutionStage}</>, chars: fitOf('Stage') },
    { label: 'Form', result: feedback.form, content: breakable(formCellText(guess)), chars: fitOf(formCellText(guess)) },
    { label: 'Egg Group', result: feedback.eggGroup, content: breakable(guess.eggGroups.join(', ')), chars: fitOf(guess.eggGroups.join(', ')) },
    {
      label: 'Shared Ability',
      result: feedback.ability.result,
      content: abilityCellText(guess, feedback.ability),
      chars: abilityFit(abilityCellText(guess, feedback.ability)),
    },
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
    const { label, result, content, chars } = tiles[i]
    return (
      <div
        key={i}
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} ${span} tile-fit px-notch flex min-h-11 flex-col items-center justify-center px-2.5 py-1.5 text-center leading-[1.3] text-white [--fs:8px] sm:[--fs:10px] ${TILE_EDGE}`}
        style={fit(null, chars, delay(i + 1))}
        data-result={result}
      >
        <span className="sr-only">{label}: </span>
        <span className="fit">
          {content}
          {ARROW[result] && (
            <span aria-hidden className="ml-0.5">
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
        className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-11 items-center gap-2 px-2.5 text-[9px] text-white sm:text-[10px] ${TILE_EDGE}`}
        data-result={feedback.pokemon}
      >
        <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-my-1 h-10 w-10 shrink-0 [image-rendering:pixelated]" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{guess.name}</span>
        <span className="ml-auto shrink-0 text-[8px] opacity-80 sm:text-[9px]">{formatDex(guess.dexNumber)}</span>
        <span className="sr-only">, {LABEL[feedback.pokemon]}</span>
      </div>
      {tiles.slice(0, topCount).map((_, i) => tile(i, hard ? 'col-span-4' : 'col-span-3'))}
      {tiles.slice(topCount, -2).map((_, i) => tile(topCount + i, 'col-span-3'))}
      <div
        className={`${BG[egg.result]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-9 items-center justify-center px-2.5 py-1.5 text-center text-[8px] leading-[1.6] text-white sm:text-[10px] ${TILE_EDGE}`}
        style={delay(tiles.length - 1)}
        data-result={egg.result}
      >
        <span className="[overflow-wrap:anywhere] [hyphens:manual]">Egg Group: {egg.content}</span>
        <span className="sr-only">, {LABEL[egg.result]}</span>
      </div>
      <div
        className={`${BG[ability.result]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-9 items-center justify-center px-2.5 py-1.5 text-center text-[8px] leading-[1.6] text-white sm:text-[10px] ${TILE_EDGE}`}
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
        {/*
          Sprite and Pokédex number share the top row (like the phone card), so the number never
          covers the sprite; the name gets up to three full-width lines below, sized so it all fits.
        */}
        <div
          className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} tile-fit flex h-16 w-full flex-col justify-center px-notch px-2.5 leading-[10px] text-white ${TILE_EDGE} sm:h-[72px]`}
          style={fit(8, { chars: lineChars(guess.name, 3), piece: lineChars(guess.name, 3) })}
          data-result={feedback.pokemon}
        >
          <div className="-mt-2 -mb-1 flex items-start justify-between">
            <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-ml-1 h-10 w-10 shrink-0 [image-rendering:pixelated]" />
            <span className="mt-3 text-[7px] leading-none opacity-80">{formatDex(guess.dexNumber)}</span>
          </div>
          <span className="fit relative line-clamp-3 text-center">{guess.name}</span>
        </div>
      </th>
      {tiles.map(({ label, result, content }, i) => (
        <Tile key={label} result={result} index={i + 1} animate={animate} compact={label === 'Type 1' || label === 'Type 2' || label === 'Form' || label === 'Egg Group' || label === 'Shared Ability'} tiny={label === 'Egg Group'} hyphenate={label === 'Shared Ability'} fit={tiles[i].chars}>
          {content}
        </Tile>
      ))}
    </tr>
  )
}
