import { useId, useState, useSyncExternalStore, type ReactNode } from 'react'
import { isBrowserDoNotTrack, isOptedOutByPlayer, setTrackingOptOut } from '../lib/analytics'
import { isBigText, isCrtOn, setBigText, setCrt } from '../lib/display'
import { isHardPref, setHardPref, subscribeHardPref } from '../lib/hardMode'
import { ResultMark } from './ResultMark'
import { VolumeBars } from './VolumeControl'
import { Modal } from './Modal'

interface HelpModalProps {
  onClose: () => void
  /** The current game is in progress, so Hard mode can't be switched until it is solved (or given up). */
  hardLocked: boolean
  /** The current game's own mode, shown while the switch is locked. */
  gameHard: boolean
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

/** Hard mode switch: hides the Gen column. Fixed per game once its first guess is made. */
function HardModeSetting({ locked, gameHard }: { locked: boolean; gameHard: boolean }) {
  const noteId = useId()
  const pref = useSyncExternalStore(subscribeHardPref, isHardPref, () => false)
  // While locked, show the mode this game is actually in, not the preference for the next one.
  const hard = locked ? gameHard : pref
  return (
    <section className="mt-5 border-t-2 border-ds-frame-light pt-4 tx-10 leading-5">
      <h3 className="mb-2 tx-11">Difficulty</h3>
      <PixelSwitch
        label="Hard mode (hide Gen)"
        on={hard}
        disabled={locked}
        describedBy={noteId}
        onToggle={() => setHardPref(!hard)}
      />
      <p id={noteId} className="mt-1 tx-9 text-ds-frame">
        Hides the Gen column, so you can't narrow it down by generation. The same switch is the Hard button in the header
        (under History on phones). It is fixed once you make a game's first
        guess{locked ? `: this game is in ${gameHard ? 'Hard' : 'normal'} mode, and the switch unlocks when you solve it (or give up, in Endless).` : ', and applies to the next game you start.'} Hard games
        are marked in History and get their own Daily stats, compared only with other Hard players.
      </p>
    </section>
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
      <p className="mt-1 tx-9 text-ds-frame">Scanlines and a soft glow, like an old handheld or TV.</p>
      <PixelSwitch
        label="Larger text"
        on={bigText}
        onToggle={() => {
          setBigText(!bigText)
          setBigTextState(!bigText)
        }}
      />
      <p className="mt-1 tx-9 text-ds-frame">Makes all the small text, including the guess tiles, a quarter bigger. Tiles grow taller to fit.</p>
      <div className="mt-2 flex min-h-11 items-center justify-between gap-3">
        <span>Volume</span>
        <VolumeBars />
      </div>
      <p className="mt-1 tx-9 text-ds-frame">Retro 8-bit blips as you press buttons and type, as tiles flip, a jingle when you win, then the answer's cry. Tap a dash or use the arrow keys to set the volume; none lit is muted. The speaker button in the header mutes and unmutes.</p>
      <p className="mt-1 tx-9 text-ds-frame">A short burst of confetti when you win. Players who set reduce motion don't see it.</p>
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
        The game records anonymous game events (guesses, results, device type, and whether Hard mode was on) with no cookies, accounts or personal
        data. Browsers that send Do Not Track or Global Privacy Control are never tracked.
      </p>
      <p className="mt-2">
        After you solve the Daily, the result screen shows anonymous totals for that puzzle (players who solved it, average
        guesses and how you compare). It is only shown while sharing is on.
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

export function HelpModal({ onClose, hardLocked, gameHard }: HelpModalProps) {
  return (
    <Modal title="How to play" onClose={onClose}>
      <div className="space-y-4 tx-10 leading-5">
        <p>
          Guess the hidden Pokémon. There is no guess limit: keep going until you find it. Every Pokémon from Gen 1 to 9
          is in, including regional forms, Megas and Gigantamax.
        </p>
        <p>Start typing a name and pick from the list. Each guess shows how close it is:</p>
        <p className="lg:hidden big:max-xl:block">
          On a phone each guess is a card: Type 1, Type 2, Gen and Height on top, then Weight, Color, Evolution and Form,
          with Egg Group and Shared Ability along the bottom (Gen is left out in Hard mode). Tablets show two cards side by side, and from 1024 px wide (and on computers) a table instead. With Larger text on, phones show three tiles to a row and the table starts at 1280 px.
        </p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2">
            <Swatch result="match"><ResultMark kind="match" className="" /></Swatch> Exact match
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="partial"><ResultMark kind="partial" className="" /></Swatch> Partly right (a type in the other slot, or one shared egg group)
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="mismatch"><ResultMark kind="mismatch" className="" /></Swatch> No match
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="mismatch">▲</Swatch> The answer is higher
          </li>
          <li className="flex items-center gap-2">
            <Swatch result="mismatch">▼</Swatch> The answer is lower
          </li>
        </ul>
        <p>
          The small mark in each tile's corner says the same as its colour (✓ match, ~ partly right, ✕ no match), so you
          never have to tell red from green.
        </p>
        <dl className="space-y-2">
          <div>
            <dt className="inline">Gen, Height, Weight, Evolution: </dt>
            <dd className="inline">arrows point toward the answer. In Hard mode Gen is hidden. Evolution is the stage in its line (Pichu 1, Pikachu 2, Raichu 3).</dd>
          </div>
          <div>
            <dt className="inline">Form: </dt>
            <dd className="inline">green if the guess and the answer are the same kind of form (Base, Mega, Regional, Gigantamax and so on), otherwise red. The tile names the guess's own form.</dd>
          </div>
          <div>
            <dt className="inline">Egg Group: </dt>
            <dd className="inline">green if your guess and the answer have exactly the same egg groups, yellow if they share at least one (say, Monster and Dragon against Dragon alone), red if none. Legendaries and other Pokémon that can't breed are "Undiscovered", and forms share their species' groups.</dd>
          </div>
          <div>
            <dt className="inline">Shared Ability: </dt>
            <dd className="inline">green with the shared ability names if your guess and the answer share any ability (hidden ones count). Otherwise it is red and lists all of the guess's own abilities, since none of them is the answer's. Guessing the answer itself always makes every tile green.</dd>
          </div>
        </dl>
        <p>
          The small <strong>#025</strong> next to each name is its Pokédex number. It is only a label and not a clue
          (forms use their species' number, so Alolan Raichu is #026). When you catch the answer you also get its full
          Pokédex entry.
        </p>
        <p>
          <strong>Daily</strong> is the same Pokémon for everyone, new each day at midnight. <strong>Endless</strong> gives you a
          fresh Pokémon whenever you like. Stuck in Endless? After your first guess, <strong>Give up</strong> under the search box
          reveals the answer (it asks first). Your progress is saved on this device.
        </p>
        <p>
          Solve the Daily each day to build a <strong>streak</strong>; missing a day resets it. The History button lists every
          Daily you've solved, with your streaks and totals, plus your Endless stats: games played, caught and given up, and your average and fewest guesses. It is saved on this device only and doesn't carry over to other devices.
        </p>
        <p className="hidden lg:block">Keyboard: type to search, ↑/↓ to pick, Enter to guess, Esc to close.</p>
      </div>
      <HardModeSetting locked={hardLocked} gameHard={gameHard} />
      <DisplaySettings />
      <StatsToggle />
      <p className="mt-5 border-t-2 border-ds-frame-light pt-4 tx-9 leading-4 text-ds-frame">
        Pokémondle is an unofficial fan project. It is not affiliated with, endorsed or sponsored by Nintendo, Game Freak or The
        Pokémon Company. Pokémon and all related names are trademarks of their respective owners.
      </p>
    </Modal>
  )
}
