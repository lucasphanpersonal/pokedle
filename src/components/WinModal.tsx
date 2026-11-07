import type { Pokemon } from '../types/pokemon'
import { spriteUrl } from '../lib/pokedex'

interface WinModalProps {
  target: Pokemon
  guessCount: number
  onClose: () => void
}

/** Win screen. The share grid comes in step 4. */
export function WinModal({ target, guessCount, onClose }: WinModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="ds-box w-full max-w-sm p-6 text-center">
        <img src={spriteUrl(target.id)} alt={target.name} className="mx-auto h-40 w-40" />
        <p className="mt-4 text-xs leading-6">
          You caught {target.name} in {guessCount} {guessCount === 1 ? 'guess' : 'guesses'}!
        </p>
        <button type="button" onClick={onClose} className="mt-4 text-[10px] underline">
          Close
        </button>
      </div>
    </div>
  )
}
