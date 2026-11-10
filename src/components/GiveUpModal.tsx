import { Modal } from './Modal'

interface GiveUpModalProps {
  guesses: number
  onConfirm: () => void
  onCancel: () => void
}

/** Asks before giving up an Endless game, since it can't be undone. */
export function GiveUpModal({ guesses, onConfirm, onCancel }: GiveUpModalProps) {
  return (
    <Modal title="Give up?" onClose={onCancel}>
      <div className="flex flex-col gap-4 tx-10 leading-5">
        <p>
          The answer will be revealed and this game ends after {guesses} {guesses === 1 ? 'guess' : 'guesses'}. It counts as
          given up in your History.
        </p>
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
