interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="ds-box w-full max-w-md p-6 text-[10px] leading-5">
        <h2 className="mb-3 text-xs">How to play</h2>
        <p>Guess the hidden Pokémon. Every guess shows how close each attribute is.</p>
        <ul className="mt-3 list-disc space-y-1 pl-4">
          <li>Green: exact match</li>
          <li>Yellow: right type, wrong slot</li>
          <li>Red: no match</li>
          <li>Arrows: the answer is higher or lower</li>
        </ul>
        <button type="button" onClick={onClose} className="mt-4 underline">
          Got it
        </button>
      </div>
    </div>
  )
}
