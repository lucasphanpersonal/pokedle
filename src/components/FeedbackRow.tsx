import type { CSSProperties, ReactNode } from 'react'
import { TILE_FLIP_STAGGER_MS } from '../config/uiConfig'
import type { GuessFeedback, MatchFeedback, NumberFeedback } from '../lib/compare'
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

export function FeedbackRow({ guess, feedback, animate }: FeedbackRowProps) {
  const tiles: [Result, ReactNode][] = [
    [feedback.type1, guess.type1],
    [feedback.type2, guess.type2 ?? 'None'],
    [feedback.generation, `Gen ${guess.generation}`],
    [feedback.height, `${guess.height} m`],
    [feedback.weight, guess.weight > 0 ? `${guess.weight} kg` : '???'],
    [feedback.color, guess.color],
    [feedback.evolutionStage, `Stage ${guess.evolutionStage}`],
    [feedback.ability.result, feedback.ability.shared.length > 0 ? feedback.ability.shared.join(', ') : 'None'],
  ]
  return (
    <tr>
      {/* Pokémon: sticky so it stays visible while the row scrolls on phones. */}
      <th scope="row" className="sticky left-0 z-10 bg-ds-paper p-0 pr-1 font-normal">
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
