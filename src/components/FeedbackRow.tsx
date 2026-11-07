import type { CSSProperties, ReactNode } from 'react'
import { GRID_COLUMNS } from '../config/gameConfig'
import { TILE_FLIP_STAGGER_MS } from '../config/uiConfig'
import { abilityCellText, type GuessFeedback, type MatchFeedback, type NumberFeedback } from '../lib/compare'
import { iconUrl } from '../lib/pokedex'
import type { Pokemon } from '../types/pokemon'

interface FeedbackRowProps {
  guess: Pokemon
  feedback: GuessFeedback
  /** Flip the tiles in one by one (only for a guess made just now). */
  animate: boolean
}

type Result = MatchFeedback | NumberFeedback

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
  partial: 'right type, other slot',
  mismatch: 'wrong',
  higher: 'answer is higher',
  lower: 'answer is lower',
  unknown: 'unknown',
}

function Tile({
  result,
  index,
  animate,
  children,
}: {
  result: Result
  index: number
  animate: boolean
  children: ReactNode
}) {
  const style: CSSProperties | undefined = animate ? { animationDelay: `${index * TILE_FLIP_STAGGER_MS}ms` } : undefined
  return (
    <td className="p-0">
      <div
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} flex h-16 flex-col items-center justify-center px-notch px-1 text-center text-[9px] leading-[1.35] text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] sm:h-[72px] sm:text-[10px]`}
        style={style}
        data-result={result}
      >
        <span className="break-words">{children}</span>
        {ARROW[result] && (
          <span aria-hidden className="mt-1 text-xs">
            {ARROW[result]}
          </span>
        )}
        <span className="sr-only">, {LABEL[result]}</span>
      </div>
    </td>
  )
}

function buildTiles(guess: Pokemon, feedback: GuessFeedback): [Result, ReactNode][] {
  return [
    [feedback.type1, guess.type1],
    [feedback.type2, guess.type2 ?? 'None'],
    [feedback.generation, `Gen ${guess.generation}`],
    [feedback.height, `${guess.height} m`],
    [feedback.weight, guess.weight > 0 ? `${guess.weight} kg` : '???'],
    [feedback.color, guess.color],
    [feedback.evolutionStage, `Stage ${guess.evolutionStage}`],
    [feedback.ability.result, abilityCellText(guess, feedback.ability)],
  ]
}

/**
 * Phone layout: one compact card per guess (sprite + name, a 4 + 3 tile grid,
 * then a full-width Shared Ability strip) so nothing scrolls sideways.
 * Tablets and desktops use the table row below.
 */
export function GuessCard({ guess, feedback, animate }: FeedbackRowProps) {
  const tiles = buildTiles(guess, feedback)
  const ability = tiles[7]
  const delay = (i: number): CSSProperties | undefined =>
    animate ? { animationDelay: `${i * TILE_FLIP_STAGGER_MS}ms` } : undefined
  const tile = (i: number, span: string) => {
    const [result, content] = tiles[i]
    return (
      <div
        key={i}
        className={`${BG[result]} ${animate ? 'tile-flip' : ''} ${span} px-notch flex min-h-11 flex-col items-center justify-center px-0.5 text-center text-[8px] leading-[1.3] text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]`}
        style={delay(i + 1)}
        data-result={result}
      >
        <span className="sr-only">{GRID_COLUMNS[i + 1]}: </span>
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
        className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-11 items-center gap-2 px-2 text-[9px] text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]`}
        data-result={feedback.pokemon}
      >
        <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-my-1 h-10 w-10 shrink-0 [image-rendering:pixelated]" />
        <span className="min-w-0 [overflow-wrap:anywhere]">{guess.name}</span>
        <span className="sr-only">, {LABEL[feedback.pokemon]}</span>
      </div>
      {[0, 1, 2, 3].map((i) => tile(i, 'col-span-3'))}
      {[4, 5, 6].map((i) => tile(i, 'col-span-4'))}
      <div
        className={`${BG[ability[0]]} ${animate ? 'tile-flip' : ''} px-notch col-span-12 flex min-h-8 items-center justify-center px-2 py-1 text-center text-[8px] leading-[1.3] text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)]`}
        style={delay(8)}
        data-result={ability[0]}
      >
        <span className="[overflow-wrap:anywhere]">Ability: {ability[1]}</span>
        <span className="sr-only">, {LABEL[ability[0]]}</span>
      </div>
    </li>
  )
}

export function FeedbackRow({ guess, feedback, animate }: FeedbackRowProps) {
  const tiles = buildTiles(guess, feedback)
  return (
    <tr>
            <th scope="row" className="p-0 pr-1 font-normal">
        <div
          className={`${BG[feedback.pokemon]} ${animate ? 'tile-flip' : ''} flex h-16 w-[96px] flex-col items-center justify-center px-notch text-[7px] leading-[10px] text-white shadow-[inset_0_-3px_0_rgb(0_0_0/0.2)] sm:h-[72px] sm:w-28 sm:text-[8px]`}
          data-result={feedback.pokemon}
        >
          <img src={iconUrl(guess.id)} alt="" width={40} height={40} className="-my-1 h-10 w-10 [image-rendering:pixelated]" />
          <span className="line-clamp-2 px-1 text-center [overflow-wrap:anywhere]">{guess.name}</span>
        </div>
      </th>
      {tiles.map(([result, content], i) => (
        <Tile key={i} result={result} index={i + 1} animate={animate}>
          {content}
        </Tile>
      ))}
    </tr>
  )
}
