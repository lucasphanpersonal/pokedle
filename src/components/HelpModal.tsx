import { useId, useState } from 'react'
import { isBrowserDoNotTrack, isOptedOutByPlayer, setTrackingOptOut } from '../lib/analytics'

interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  const labelId = useId()
  const noteId = useId()
  // Browsers sending GPC / Do Not Track are never tracked, whatever the switch says.
  const [browserBlocks] = useState(isBrowserDoNotTrack)
  const [optedOut, setOptedOut] = useState(isOptedOutByPlayer)
  const on = !browserBlocks && !optedOut

  const toggle = () => {
    setTrackingOptOut(on)
    setOptedOut(on)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div className="ds-box my-auto w-full max-w-md p-6 text-[10px] leading-5">
        <h2 className="mb-3 text-xs">How to play</h2>
        <p>Guess the hidden Pokémon. Every guess shows how close each attribute is.</p>
        <ul className="mt-3 list-disc space-y-1 pl-4">
          <li>Green: exact match</li>
          <li>Yellow: right type, wrong slot</li>
          <li>Red: no match</li>
          <li>Arrows: the answer is higher or lower</li>
        </ul>

        <h2 className="mb-2 mt-5 text-xs">Privacy</h2>
        <p>
          The game records anonymous gameplay stats (guesses, wins, device type) with no cookies, accounts or personal
          data. Browsers that send Do Not Track or Global Privacy Control are never tracked.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={labelId}
          aria-describedby={browserBlocks ? noteId : undefined}
          disabled={browserBlocks}
          onClick={toggle}
          className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-60"
        >
          <span id={labelId}>Share anonymous stats</span>
          <span className="flex items-center gap-2" aria-hidden="true">
            <span>{on ? 'ON' : 'OFF'}</span>
            <span
              className={`flex h-6 w-11 items-center border-2 border-ds-frame px-0.5 ${on ? 'justify-end bg-ds-red' : 'justify-start bg-ds-paper'}`}
            >
              <span className="h-4 w-4 bg-ds-frame" />
            </span>
          </span>
        </button>
        {browserBlocks && (
          <p id={noteId} className="mt-1">
            Off: your browser sends Do Not Track or Global Privacy Control.
          </p>
        )}

        <button type="button" onClick={onClose} className="mt-4 min-h-11 underline">
          Got it
        </button>
      </div>
    </div>
  )
}
