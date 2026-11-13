import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ResultMark } from './ResultMark'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * DS-style dialog box: closes on Escape, backdrop tap, or the close button
 * (a white bevelled menu button holding the pixel-art cross, like every other button).
 * Rendered outside #root, which is made inert while open, so keyboard and
 * screen-reader focus can't wander to the page behind it.
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  // Latest onClose without re-running the focus effect on every parent render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // Another dialog may have opened in the meantime; only the last one un-inerts.
      if (!document.querySelector('[data-modal]')) root?.removeAttribute('inert')
      previouslyFocused?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      data-modal
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onCloseRef.current()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="ds-box pop-in max-h-[90dvh] w-full max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-xs leading-5 sm:text-sm">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label="Close"
            className="ds-button bevel-paper flex h-11 w-11 shrink-0 items-center justify-center text-ds-ink"
          >
            <ResultMark kind="mismatch" scale={2} className="" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
