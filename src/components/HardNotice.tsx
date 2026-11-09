import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { playSound } from '../lib/sound'

interface HardNoticeProps {
  /** Hard mode starts with the game on screen (no guesses yet), not the next one. */
  appliesNow: boolean
  onDismiss: () => void
}

/** Milliseconds per letter as the text types out, like the games' text speed. */
const LETTER_MS = 22

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * The one-time "Hard mode: the Generation column is hidden!" message, drawn as an
 * in-game text box along the bottom of the screen. The text types out letter by
 * letter; a tap, click, Enter, Space, Z/A or Escape first finishes the text, then
 * closes the box (straight away once the text is complete), like advancing dialogue.
 */
export function HardNotice({ appliesNow, onDismiss }: HardNoticeProps) {
  const text = `Hard mode is on! ${
    appliesNow ? 'The Gen column is hidden' : 'From your next game the Gen column is hidden'
  }, so you'll have to work out the generation yourself.`
  const textId = useId()
  const boxRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text.length : 0))
  const done = shown >= text.length

  // Latest state for the key/tap handler without re-binding it every letter.
  const advanceRef = useRef(() => {})
  useEffect(() => {
    advanceRef.current = () => {
      if (!done) {
        setShown(text.length)
      } else {
        playSound('select')
        onDismiss()
      }
    }
  })

  useEffect(() => {
    if (done) return
    const id = window.setTimeout(() => setShown((n) => n + 1), LETTER_MS)
    return () => window.clearTimeout(id)
  }, [shown, done])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    boxRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      // Leave shortcuts alone (Ctrl+A, Cmd+Z…).
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (['Enter', ' ', 'Escape', 'z', 'Z', 'a', 'A'].includes(e.key)) {
        e.preventDefault()
        // A held key (e.g. Enter still down from pressing Hard) must not skip the message unread.
        if (!e.repeat) advanceRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (!document.querySelector('[data-modal]')) root?.removeAttribute('inert')
      previouslyFocused?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      data-modal
      className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center bg-black/30 p-3 sm:p-4"
      onClick={() => advanceRef.current()}
    >
      <div
        ref={boxRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Hard mode"
        aria-describedby={textId}
        tabIndex={-1}
        className="ds-box pop-in relative w-full max-w-xl px-5 pt-5 pb-8 outline-none sm:px-6 sm:pt-6"
      >
        <p id={textId} className="sr-only">
          {text} Press Enter or tap to continue.
        </p>
        {/* Typed-out copy for sighted players. The hidden tail keeps the box its final size from the first letter. */}
        <p aria-hidden="true" className="text-[10px] leading-6 sm:text-xs sm:leading-7">
          {text.slice(0, shown)}
          <span className="invisible">{text.slice(shown)}</span>
        </p>
        {done && (
          <span aria-hidden="true" className="text-advance absolute right-4 bottom-2 text-xs text-ds-red sm:right-5">
            ▼
          </span>
        )}
      </div>
    </div>,
    document.body,
  )
}
