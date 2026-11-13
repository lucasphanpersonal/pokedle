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
      <p className="mt-1 tx-9 text-ds-frame">Retro 8-bit blips as you press buttons and type, as tiles flip, a whoosh, bounces and a low wobble as the Poké Ball lands and shakes, a jingle when you win, then the answer's cry (it also cries as it escapes when you give up). Tap a dash or use the arrow keys to set the volume; none lit is muted. The speaker button in the header mutes and unmutes.</p>
      <p className="mt-1 tx-9 text-ds-frame">When a game ends, a Poké Ball shakes and clicks shut if you won, or bursts open and lets the Pokémon run off if you gave up. Tap or press any key to skip it. Then a short burst of confetti if you won. Players who set reduce motion don't see these.</p>
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
        The game records anonymous game events (guesses, results, device type, and whether you took the Gen hint) with no cookies, accounts or personal
        data. Browsers that send Do Not Track or Global Privacy Control are never tracked.
      </p>
      <p className="mt-2">
        Separately, Cloudflare, which delivers the site, counts page views without cookies. The switch below does not affect that count.
      </p>
      <p className="mt-2">
        After you finish the Daily (solved or given up), the result screen always shows anonymous totals for that puzzle
        (players who solved it, average guesses, how many gave up or took the Gen hint, and, if you solved it, how you
        compare), even if you are the first. Each network counts once a day, so a household on one Wi-Fi counts as one
        player. It is only shown while sharing is on.
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
        <p>
          Guess the hidden Pokémon. There is no guess limit: keep going until you find it. Every Pokémon from Gen 1 to 9
          is in, including regional forms, Megas and Gigantamax.
        </p>
        <p>Start typing a name and pick from the list. Each guess shows how close it is:</p>
        <p className="lg:hidden big:max-xl:block">
          On a phone each guess is a card: Type 1, Type 2 and Height on top, then Weight, Color, Evolution and Form,
          with Egg Group and Shared Ability along the bottom. Tablets show two cards side by side, and from 1024 px wide (and on computers) a table instead. With Larger text on, phones show three tiles to a row and the table starts at 1280 px.
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
            <dt className="inline">Height, Weight, Evolution: </dt>
            <dd className="inline">arrows point toward the answer. Evolution is the stage in its line (Pichu 1, Pikachu 2, Raichu 3).</dd>
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
          fresh Pokémon whenever you like. Stuck? After your first guess, <strong>Give up</strong> (beside History)
          reveals the answer (it asks first). Giving up the Daily ends it for the day and resets your streak. Your progress is saved on this device.
        </p>
        <p>
          In Endless, the <strong>Gens</strong> button beside History (under it on phones) chooses which generations the Pokémon can come from: switch
          each of Gen 1 to 9 on or off, or use All and None (at least one must stay on). Forms count by their debut, so
          Megas are Gen 6. You can still guess any Pokémon. Gens are locked while a game is in progress (tap the
          button to see why): change them before your first guess, or after you catch the Pokémon or give up, and they apply
          to your next one. The Daily always uses every Gen.
        </p>
        <p>
          <span className="inline-flex items-center gap-1.5 align-middle"><PixelBulb /><strong>Gen hint:</strong></span> the
          guesses never show a Pokémon's generation. After {HINT_AFTER_GUESSES} guesses you are offered a hint that tells you
          which Gen the answer is from. It's up to you: say Not now and a Gen hint button stays beside History (under it on phones) for
          the rest of the game. A hinted win still counts as a win and keeps your streak; History marks it with a bulb and
          shows how many of your wins needed no hint.
        </p>
        <p>
          Solve the Daily each day to build a <strong>streak</strong>; missing a day or giving up resets it. The History button lists every
          Daily you've finished, with your streaks and totals, plus your Endless stats: games played, caught and given up, and your average and fewest guesses. It is saved on this device only and doesn't carry over to other devices.
        </p>
        <p className="hidden lg:block">Keyboard: type to search, ↑/↓ to pick, Enter to guess, Esc to close.</p>
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
