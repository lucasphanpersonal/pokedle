import type { GameMode } from '../lib/game'
import { Modal } from './Modal'

interface GiveUpModalProps {
  mode: GameMode
  guesses: number
  /** Current Daily streak: giving up the Daily ends it. */
  streak: number
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before giving up a game, since it can't be undone (and the Daily can't be replayed). */
export function GiveUpModal({ mode, guesses, streak, onConfirm, onCancel }: GiveUpModalProps) {
  const count = `${guesses} ${guesses === 1 ? 'guess' : 'guesses'}`
  return (
    <Modal title="Give up?" onClose={onCancel}>
      <div className="flex flex-col gap-4 tx-10 leading-5">
        {mode === 'daily' ? (
          <p>
            The answer will be revealed and today's Daily ends after {count}. You can't play it again: it counts as a loss
            in your History and ends your streak{streak > 0 ? ` of ${streak} ${streak === 1 ? 'day' : 'days'}` : ''}.
          </p>
        ) : (
          <p>
            The answer will be revealed and this game ends after {count}. It counts as given up in your History.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="ds-button bevel-paper h-11 px-3 text-[10px]">
            Keep going
          </button>
          <button type="button" onClick={onConfirm} className="ds-button bevel-red h-11 px-3 text-[10px] text-ds-paper">
            Give up
          </button>
        </div>
      </div>
    </Modal>
  )
}
