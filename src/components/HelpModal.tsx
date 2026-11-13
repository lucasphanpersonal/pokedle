import { useId, useState, type ReactNode } from 'react'
import { isBrowserDoNotTrack, isOptedOutByPlayer, setTrackingOptOut } from '../lib/analytics'
import { isBigText, isCrtOn, setBigText, setCrt } from '../lib/display'
import { HINT_AFTER_GUESSES } from '../lib/game'
import { PixelBulb } from './PixelBulb'
import { ResultMark } from './ResultMark'
import { VolumeBars } from './VolumeControl'
import { Modal } from './Modal'

interface HelpModalProps {
  onClose: () => void
}

/** A tiny guess tile; data-result gives it the same coloured bevel as the grid. */
function Swatch({ result, children }: { result: 'match' | 'partial' | 'mismatch'; children: ReactNode }) {
  const color = { match: 'bg-fb-match', partial: 'bg-fb-partial text-ds-ink', mismatch: 'bg-fb-mismatch' }[result]
  return (
    <span data-result={result} className={`${color} inline-flex h-7 w-7 shrink-0 items-center justify-center px-notch [--px:2px] tx-9 text-white bevel`}>
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
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onToggle}
      className={`ds-focus mt-2 flex min-h-11 w-full items-center justify-between gap-3 text-left ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
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
  const [bigText, setBigTextState] = useState(isBigText)
  return (
    <section className="mt-5 border-t-2 border-ds-frame-light pt-4 tx-10 leading-5">
      <h3 className="mb-2 tx-11">Display &amp; sound</h3>
      <PixelSwitch
        label="CRT screen effect"
        on={crt}
        onToggle={() => {
          setCrt(!crt)
          setCrtState(!crt)
        }}
      />
      <p className="mt-1 tx-9 text-ds-frame">Scanlines and a soft glow, like an old handheld.</p>
      <PixelSwitch
        label="Larger text"
        on={bigText}
        onToggle={() => {
          setBigText(!bigText)
          setBigTextState(!bigText)
        }}
      />
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        <span>Volume</span>
        <VolumeBars />
      </div>
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
    <section className="mt-5 border-t-2 border-ds-frame-light pt-4 tx-10 leading-5">
      <h3 className="mb-2 tx-11">Privacy</h3>
      <p>
        The game records anonymous game events (guesses, results, device type, Gen hint use) with no cookies, accounts or
        personal data. They power the Daily stats on the result screen. Do Not Track and Global Privacy Control are always respected. Cloudflare also counts page views, which this
        switch doesn't affect.
      </p>
      <PixelSwitch
        label="Share anonymous stats"
        on={on}
        disabled={browserBlocks}
        describedBy={browserBlocks ? noteId : undefined}
        onToggle={toggle}
      />
      {browserBlocks && (
        <p id={noteId} className="mt-1 tx-9 text-ds-frame">
          Off: your browser sends Do Not Track or Global Privacy Control.
        </p>
      )}
    </section>
  )
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <div className="space-y-4 tx-10 leading-5">
        <p>Guess the hidden Pokémon. Every Pokémon from Gen 1 to 9 is in, forms included, and there's no guess limit.</p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <Swatch result="match"><ResultMark kind="match" className="" /></Swatch> Match
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="partial"><ResultMark kind="partial" className="" /></Swatch> Partly right
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="mismatch"><ResultMark kind="mismatch" className="" /></Swatch> No match
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="mismatch">▲</Swatch> Answer is higher
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="mismatch">▼</Swatch> Answer is lower
          </li>
        </ul>
        <p>The ✓ ~ ✕ in a tile's corner means the same as its colour.</p>
        <dl className="space-y-2">
          <div>
            <dt className="inline">Types: </dt>
            <dd className="inline">yellow if the type is in the other slot.</dd>
          </div>
          <div>
            <dt className="inline">Evolution: </dt>
            <dd className="inline">stage in its line (Pichu 1, Pikachu 2, Raichu 3).</dd>
          </div>
          <div>
            <dt className="inline">Form: </dt>
            <dd className="inline">green if the same kind (Base, Mega, Regional…).</dd>
          </div>
          <div>
            <dt className="inline">Egg Group: </dt>
            <dd className="inline">yellow if at least one is shared.</dd>
          </div>
          <div>
            <dt className="inline">Shared Ability: </dt>
            <dd className="inline">names any ability you share with the answer, hidden ones included.</dd>
          </div>
        </dl>
        <p>
          <span className="inline-flex items-center gap-1.5 align-middle"><PixelBulb /><strong>Gen hint:</strong></span> after{' '}
          {HINT_AFTER_GUESSES} guesses you can reveal the answer's Gen. A hinted win still counts.
        </p>
        <p>
          <strong>Daily:</strong> one Pokémon for everyone, new at midnight. Solve it each day to keep your streak; giving
          up resets it.
        </p>
        <p>
          <strong>Endless:</strong> play as many as you like. <strong>Gens</strong> picks which generations the answer comes from.
        </p>
      </div>
      <DisplaySettings />
      <StatsToggle />
      <p className="mt-5 border-t-2 border-ds-frame-light pt-4 tx-9 leading-4 text-ds-frame">
        Pokémondle is an unofficial fan project. It is not affiliated with, endorsed or sponsored by Nintendo, Game Freak or The
        Pokémon Company. Pokémon and all related names are trademarks of their respective owners.
      </p>
    </Modal>
  )
}
