import type { Pokemon } from '../types/pokemon'

interface FeedbackRowProps {
  guess: Pokemon
}

/** One guess row. Per-cell feedback colours and flip animation come in steps 3 and 4. */
export function FeedbackRow({ guess }: FeedbackRowProps) {
  return (
    <tr>
      <td className="p-2 text-[10px]">{guess.name}</td>
    </tr>
  )
}
