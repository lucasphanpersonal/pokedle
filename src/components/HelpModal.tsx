import { useId, useState } from 'react'
import { isBrowserDoNotTrack, isOptedOutByPlayer, setTrackingOptOut } from '../lib/analytics'
import { isCrtOn, setCrt } from '../lib/display'
import { Modal } from './Modal'

interface HelpModalProps {
  onClose: () => void
}

function Swatch({ className, children }: { className: string; children: string }) {
  return (
    <span className={`${className} inline-flex h-6 min-w-6 items-center justify-center px-notch [--px:2px] px-1 text-[9px] text-white shadow-[inset_0_0_0_2px_var(--color-ds-frame)]`}>
      {children}
    </span>
  )
}

/** A labelled pixel on/off switch. */
function PixelSwitch({ label, on, disabled, describedBy, onToggle }: {
  label: string
  on: boolean
  disabled?: boolean
  describedBy?: string
  onToggle: () => void
}) {
  const labelId = useId()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onToggle}
      className="ds-focus mt-2 flex min-h-11 w-full items-center justify-between gap-3 text-left disabled:opacity-60"
    >
      <span id={labelId}>{label}</span>
      <span className="flex items-center gap-2" aria-hidden="true">
        <span>{on ? 'ON' : 'OFF'}</span>
        <span
          className={`flex h-6 w-11 items-center border-2 border-ds-frame px-0.5 ${on ? 'justify-end bg-fb-match' : 'justify-start bg-ds-paper'}`}
        >
          <span className="h-4 w-4 bg-ds-frame" />
        </span>
      </span>
    </button>
  )
}

function DisplaySettings() {
  const [crt, setCrtState] = useState(isCrtOn)
  return (
    <section className="mt-5 border-t-2 border-ds-frame-light pt-4 text-[10px] leading-5">
      <h3 className="mb-2 text-[11px]">Display</h3>
      <PixelSwitch
        label="CRT screen effect"
        on={crt}
        onToggle={() => {
          setCrt(!crt)
          setCrtState(!crt)
        }}
      />
      <p className="mt-1 text-[9px] text-ds-frame">Scanlines and a soft glow, like an old handheld or TV.</p>
    </section>
  )
}

/** Privacy note and the analytics on/off switch. */
function StatsToggle() {
  const noteId = useId()
  // Browsers sending GPC / Do Not Track are never tracked, whatever the switch says.
  const [browserBlocks] = useState(isBrowserDoNotTrack)
  const [optedOut, setOptedOut] = useState(isOptedOutByPlayer)
  const on = !browserBlocks && !optedOut

  const toggle = () => {
    setTrackingOptOut(on)
    // Show the real state, which holds in memory even if it couldn't be saved.
    setOptedOut(isOptedOutByPlayer())
  }

  return (
    <section className="mt-5 border-t-2 border-ds-frame-light pt-4 text-[10px] leading-5">
      <h3 className="mb-2 text-[11px]">Privacy</h3>
      <p>
        The game records anonymous game events (guesses, results, device type) with no cookies, accounts or personal
        data. Browsers that send Do Not Track or Global Privacy Control are never tracked.
      </p>
      <PixelSwitch
        label="Share anonymous stats"
        on={on}
        disabled={browserBlocks}
        describedBy={browserBlocks ? noteId : undefined}
        onToggle={toggle}
      />
      {browserBlocks && (
        <p id={noteId} className="mt-1 text-[9px] text-ds-frame">
          Off: your browser sends Do Not Track or Global Privacy Control.
        </p>
      )}
    </section>
  )
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <div className="space-y-4 text-[10px] leading-5">
        <p>
          Guess the hidden Pokémon. There is no guess limit: keep going until you find it. Every Pokémon from Gen 1 to 9
          is in, including regional forms, Megas and Gigantamax.
        </p>
        <p>Start typing a name and pick from the list. Each guess shows how close it is:</p>
        <p className="sm:hidden">
          On a phone each guess is a card: Type 1, Type 2, Gen and Height on top, then Weight, Color, Evolution and Form,
          with Shared Ability along the bottom. Tablets and computers show a table instead.
        </p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <Swatch className="bg-fb-match">✓</Swatch> Exact match
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="bg-fb-partial text-ds-ink">~</Swatch> Right type, other slot
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="bg-fb-mismatch">✕</Swatch> No match
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="bg-fb-mismatch">▲</Swatch> The answer is higher
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="bg-fb-mismatch">▼</Swatch> The answer is lower
          </li>
        </ul>
        <dl className="space-y-2">
          <div>
            <dt className="inline">Gen, Height, Weight, Evolution: </dt>
            <dd className="inline">arrows point toward the answer. Evolution is the stage in its line (Pichu 1, Pikachu 2, Raichu 3).</dd>
          </div>
          <div>
            <dt className="inline">Form: </dt>
            <dd className="inline">green if the guess and the answer are the same kind of form (Base, Mega, Regional, Gigantamax and so on), otherwise red. The tile names the guess's own form.</dd>
          </div>
          <div>
            <dt className="inline">Shared Ability: </dt>
            <dd className="inline">green with the shared ability names if your guess and the answer share any ability (hidden ones count). Otherwise it is red and lists all of the guess's own abilities, since none of them is the answer's ("Unknown" if the Pokémon has no ability data yet).</dd>
          </div>
        </dl>
        <p>
          <strong>Daily</strong> is the same Pokémon for everyone, new each day at midnight. <strong>Endless</strong> gives you a
          fresh Pokémon whenever you like. Your progress is saved on this device.
        </p>
        <p className="hidden sm:block">Keyboard: type to search, ↑/↓ to pick, Enter to guess, Esc to close.</p>
      </div>
      <DisplaySettings />
      <StatsToggle />
    </Modal>
  )
}
