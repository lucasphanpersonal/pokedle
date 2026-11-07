import type { GuessFeedback, MatchFeedback, NumberFeedback } from '../lib/compare'
import type { Pokemon } from '../types/pokemon'

interface FeedbackRowProps {
  guess: Pokemon
  feedback: GuessFeedback
}

const BG: Record<MatchFeedback | NumberFeedback, string> = {
  match: 'bg-fb-match',
  partial: 'bg-fb-partial',
  mismatch: 'bg-fb-mismatch',
  higher: 'bg-fb-mismatch',
  lower: 'bg-fb-mismatch',
}

const ARROW: Partial<Record<NumberFeedback, string>> = { higher: '▲', lower: '▼' }

function Cell({ result, children }: { result: MatchFeedback | NumberFeedback; children: React.ReactNode }) {
  return (
    <td className={`${BG[result]} rounded-md p-2 text-[8px] text-white sm:text-[10px]`} data-result={result}>
      {children}
      {ARROW[result as NumberFeedback] && <span className="ml-1">{ARROW[result as NumberFeedback]}</span>}
    </td>
  )
}

/** One guess row. Flip-reveal animation comes in step 4. */
export function FeedbackRow({ guess, feedback }: FeedbackRowProps) {
  return (
    <tr>
      <Cell result={feedback.pokemon}>{guess.name}</Cell>
      <Cell result={feedback.type1}>{guess.type1}</Cell>
      <Cell result={feedback.type2}>{guess.type2 ?? 'None'}</Cell>
      <Cell result={feedback.generation}>{guess.generation}</Cell>
      <Cell result={feedback.height}>{guess.height} m</Cell>
      <Cell result={feedback.weight}>{guess.weight > 0 ? `${guess.weight} kg` : '???'}</Cell>
      <Cell result={feedback.color}>{guess.color}</Cell>
      <Cell result={feedback.evolutionStage}>{guess.evolutionStage}</Cell>
    </tr>
  )
}
