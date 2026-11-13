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
import { cardTileSpan, TWO_UP } from '../lib/cardLayout'
import { abilityFit, breakable, lineChars, longestPiece, longestWord, type Fit } from '../lib/tileText'
import type { Pokemon } from '../types/pokemon'
import { ResultMark } from './ResultMark'

interface FeedbackRowProps {
  guess: Pokemon
  feedback: GuessFeedback
  /** Flip the tiles in one by one (only for a guess made just now). */
  animate: boolean
  /** Table only: one Shared Ability size for the whole column (see abilityColumnFit), so rows don't jump in size. */
  abilityColumn?: Fit
  /** Cards only: Larger text is on, so cards go two to a row from 900 px instead of 720 px. */
  bigText?: boolean
}

type Result = MatchFeedback | NumberFeedback

/* Beveled DS-menu block: see .bevel in index.css (light top edge, dark bottom edge), shared with every button. */
const TILE_EDGE = 'bevel'

const fitOf = (...parts: (string | number)[]): Fit => ({ chars: longestWord(...parts), piece: longestPiece(...parts) })
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

/** The tile's corner mark (check, tilde or cross), so no result is told apart by colour alone. */
function Mark({ result }: { result: Result }) {
  // Higher/lower tiles already carry an arrow, and 'unknown' has nothing to mark.
  return result === 'match' || result === 'partial' || result === 'mismatch' ? <ResultMark kind={result} /> : null
}

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
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} tile-fit relative flex h-16 flex-col items-center justify-center px-notch px-2.5 pb-1 text-center leading-[1.35] text-white ${TILE_EDGE} sm:h-[calc(72px*var(--ts))]`}
        style={style}
        data-result={result}
      >
        <Mark result={result} />
        <span className={`fit ${hyphenate ? '[hyphens:auto]' : ''}`}>{children}</span>
        {ARROW[result] && (
          <span aria-hidden className="absolute bottom-[7px] left-0 right-0 tx-9 leading-none">
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

/** The attribute tiles in column order (after the name). */
function buildTiles(guess: Pokemon, feedback: GuessFeedback, abilityColumn?: Fit): TileData[] {
  return [
    { label: 'Type 1', result: feedback.type1, content: breakable(guess.type1), chars: fitOf(guess.type1) },
    { label: 'Type 2', result: feedback.type2, content: breakable(guess.type2 ?? 'None'), chars: fitOf(guess.type2 ?? 'None') },
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
      chars: abilityColumn ?? abilityFit(abilityCellText(guess, feedback.ability)),
    },
  ]
}

/**
 * Phone layout: one compact card per guess (sprite + name, two rows of four
 * tiles, then full-width Egg Group and Shared Ability strips) so nothing scrolls sideways.
 * Tablets and desktops use the table row below.
 */
export function GuessCard({ guess, feedback, animate, bigText = false }: FeedbackRowProps) {
  const tiles = buildTiles(guess, feedback)
  const egg = tiles[tiles.length - 2]
  const ability = tiles[tiles.length - 1]
  const delay = (i: number): CSSProperties | undefined =>
    animate ? { animationDelay: `${i * TILE_FLIP_STAGGER_MS}ms` } : undefined
  const tile = (i: number, span: string) => {
    const { label, result, content, chars } = tiles[i]
    return (
      <div
        key={i}
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} ${span} tile-fit px-notch relative flex min-h-11 flex-col items-center justify-center px-2.5 py-1.5 text-center leading-[1.3] text-white [--fs:8px] sm:[--fs:10px] ${TILE_EDGE}`}
        style={fit(null, chars, delay(i + 1))}
        data-result={result}
      >
        <Mark result={result} />
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
    <li className={`grid grid-cols-12 content-start gap-1 border-t-2 border-dashed border-ds-frame/30 py-2 first:border-t-0 first:pt-0 last:pb-0 ${TWO_UP[bigText ? 'big' : 'normal'].card}`}>
      <div
        className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-11 items-center gap-2 px-2.5 py-1.5 tx-9 text-white sm:tx-10 ${TILE_EDGE}`}
        data-result={feedback.pokemon}
      >
        <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-my-1 h-10 w-10 shrink-0 [image-rendering:pixelated]" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{guess.name}</span>
        <span className="ml-auto shrink-0 tx-8 opacity-80 sm:tx-9">{formatDex(guess.dexNumber)}</span>
        <span className="sr-only">, {LABEL[feedback.pokemon]}</span>
      </div>
      {tiles.slice(0, -2).map((_, i) => tile(i, cardTileSpan(i)))}
      <div
        className={`${BG[egg.result]} ${animate ? 'tile-flip' : ''} px-notch relative col-span-12 flex min-h-9 items-center justify-center px-2.5 py-1.5 text-center tx-8 leading-[1.6] text-white sm:tx-10 ${TILE_EDGE}`}
        style={delay(tiles.length - 1)}
        data-result={egg.result}
      >
        <Mark result={egg.result} />
        <span className="[overflow-wrap:anywhere] [hyphens:manual]">Egg Group: {egg.content}</span>
        <span className="sr-only">, {LABEL[egg.result]}</span>
      </div>
      <div
        className={`${BG[ability.result]} ${animate ? 'tile-flip' : ''} px-notch relative col-span-12 flex min-h-9 items-center justify-center px-2.5 py-1.5 text-center tx-8 leading-[1.6] text-white sm:tx-10 ${TILE_EDGE}`}
        style={delay(tiles.length)}
        data-result={ability.result}
      >
        <Mark result={ability.result} />
        <span className="[overflow-wrap:anywhere]">Ability: {ability.content}</span>
        <span className="sr-only">, {LABEL[ability.result]}</span>
      </div>
    </li>
  )
}

export function FeedbackRow({ guess, feedback, animate, abilityColumn }: FeedbackRowProps) {
  const tiles = buildTiles(guess, feedback, abilityColumn)
  return (
    <tr>
      <th scope="row" className="p-0 font-normal">
        {/*
          Sprite and Pokédex number share the top row (like the phone card), so the number never
          covers the sprite; the name gets up to three full-width lines below (four with Larger text), sized so it all fits.
        */}
        <div
          className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} tile-fit flex h-16 w-full flex-col px-notch px-2.5 py-1.5 leading-[calc(10px*var(--ts))] text-white ${TILE_EDGE} sm:h-[calc(72px*var(--ts))]`}
          style={fit(8, { chars: lineChars(guess.name, 3), piece: lineChars(guess.name, 3) })}
          data-result={feedback.pokemon}
        >
          {/* The sprite row takes whatever height the name leaves (up to 40px), so big sprites never cross the bevel. */}
          <div className="flex min-h-0 flex-1 items-end justify-between">
            <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-ml-1 h-full max-h-10 min-h-0 w-auto shrink-0 object-contain object-bottom [image-rendering:pixelated]" />
            <span className="mt-1.5 self-start tx-7 leading-none opacity-80">{formatDex(guess.dexNumber)}</span>
          </div>
          <span className="fit relative line-clamp-3 shrink-0 text-center big:line-clamp-4 big:leading-[11px]">{guess.name}</span>
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
