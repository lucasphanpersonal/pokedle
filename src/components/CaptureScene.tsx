import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ballArt from '../../scripts/icons/pokeball.txt?raw'
import { captureTimeline, DROP_MS, SHAKE_MS, type CaptureKind } from '../lib/capture'
import { playCry } from '../lib/cry'
import { ballPaths, parseBallArt, STAR_ART, STAR_PALETTE } from '../lib/pokeballArt'
import { iconUrl, spriteUrl } from '../lib/pokedex'
import { playSound } from '../lib/sound'
import type { Pokemon } from '../types/pokemon'

/**
 * The same hand-drawn ball as the tab icon, split at the band so the lid can open. Its 16x16 drawing
 * at 1x: small next to the Pokémon, as in the games' battle screens.
 */
const { grid16 } = parseBallArt(ballArt)
const LID = ballPaths(grid16, 0, 8)
const BASE = ballPaths(grid16, 8, 16)

type Phase = 'drop' | 'shake' | 'click' | 'burst' | 'flee'

/** Where the stars (catch) and sparks (escape) fly to, from the top of the ball. */
const STARS = [
  { dx: -18, dy: -6 },
  { dx: 0, dy: -18 },
  { dx: 18, dy: -6 },
]
const SPARKS = [
  { dx: -26, dy: -3 },
  { dx: -18, dy: -20 },
  { dx: 0, dy: -28 },
  { dx: 18, dy: -20 },
  { dx: 26, dy: -3 },
]

const STAR = ballPaths(STAR_ART, 0, STAR_ART.length, STAR_PALETTE)

/** The 9x9 pixel star, drawn at 1x like the ball. */
function PixelStar() {
  return (
    <svg viewBox="0 0 9 9" width="9" height="9" shapeRendering="crispEdges" aria-hidden="true" className="block">
      {STAR.map((p) => (
        <path key={p.color} fill={p.color} d={p.d} />
      ))}
    </svg>
  )
}

interface CaptureSceneProps {
  kind: CaptureKind
  pokemon: Pokemon
  /** The scene has finished or was skipped. */
  onDone: () => void
}

/**
 * The moment a game ends, like a catch in the games. Win: the Poké Ball drops, shakes three times,
 * clicks shut and gives off stars. Give up: it shakes three times too, then bursts open and the answer's sprite pops
 * out and runs off. About 5 seconds at the games' pace; a tap, click or any key skips it. App only shows it when the
 * player hasn't asked for reduced motion. The art is original: the site's own pixel ball and stars;
 * the Pokémon's sprite comes from PokéAPI and is simply left out if it hasn't loaded in time.
 */
export function CaptureScene({ kind, pokemon, onDone }: CaptureSceneProps) {
  const [phase, setPhase] = useState<Phase>('drop')
  const [sprite, setSprite] = useState<string | null>(null)
  const loadedSprite = useRef<string | null>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const timeline = captureTimeline(kind)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  })

  // The escaping Pokémon's sprite: the small in-game one, else the artwork. Loaded at once, so it is
  // usually ready by the burst a second and a half later; if not, the scene plays without it.
  useEffect(() => {
    if (kind !== 'escape') return
    let alive = true
    const urls = [iconUrl(pokemon.id), spriteUrl(pokemon.id)]
    const load = (i: number) => {
      const img = new Image()
      img.onload = () => {
        if (alive) loadedSprite.current = urls[i]
      }
      img.onerror = () => {
        if (alive && i + 1 < urls.length) load(i + 1)
      }
      img.src = urls[i]
    }
    load(0)
    return () => {
      alive = false
    }
  }, [kind, pokemon.id])

  useEffect(() => {
    const timers: number[] = []
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    // Thrown in, two taps as it bounces (the touchdowns of .capture-drop, at 55% and 86% of DROP_MS),
    // then a low wobble per shake, its pitch following the tilts.
    playSound('throw')
    at(DROP_MS * 0.55, () => playSound('bounce'))
    at(DROP_MS * 0.86, () => playSound('bounce', -5))
    at(DROP_MS, () => setPhase('shake'))
    for (let i = 0; i < timeline.shakes; i++) at(DROP_MS + i * SHAKE_MS, () => playSound('wobble'))
    if (kind === 'catch') {
      at(timeline.settle, () => {
        setPhase('click')
        playSound('click')
      })
    } else {
      at(timeline.settle, () => {
        setSprite(loadedSprite.current)
        setPhase('burst')
        playSound('burst')
        playCry(pokemon)
      })
      at(timeline.flee!, () => {
        setPhase('flee')
        playSound('flee')
      })
    }
    at(timeline.end, () => onDoneRef.current())
    return () => timers.forEach((id) => window.clearTimeout(id))
    // Runs once per scene; App remounts the scene for a new game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Like a dialog: the page behind can't be tabbed to, and any key skips (shortcuts aside).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')
    sceneRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      e.preventDefault()
      // The result screen focuses its close button straight after; some browsers would click it on this key's
      // release (Space), so swallow that one keyup.
      const swallowUp = (up: KeyboardEvent) => {
        if (up.key !== e.key) return
        up.preventDefault()
        up.stopPropagation()
        document.removeEventListener('keyup', swallowUp, true)
      }
      document.addEventListener('keyup', swallowUp, true)
      window.setTimeout(() => document.removeEventListener('keyup', swallowUp, true), 1000)
      onDoneRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      // Let go of #root so focus can go back; the result screen, mounting next, makes it inert again and then
      // remembers the right element to return focus to.
      root?.removeAttribute('inert')
      previouslyFocused?.focus?.()
    }
  }, [])

  const opened = phase === 'burst' || phase === 'flee'
  const caption =
    phase === 'click'
      ? `Gotcha! ${pokemon.name} was caught!`
      : phase === 'burst'
        ? 'Oh no! The Pokémon broke free!'
        : phase === 'flee'
          ? `The wild ${pokemon.name} fled!`
          : 'Go! Poké Ball!'

  // Outside #root, which is made inert while the scene plays, like a dialog.
  return createPortal(
    <div
      ref={sceneRef}
      data-modal
      data-capture={kind}
      tabIndex={-1}
      // Skip on click (not pointerdown), so the tap that skips can't also land on the result screen underneath.
      onClick={() => onDoneRef.current()}
      className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center bg-black/50 p-3 outline-none sm:items-center sm:p-4"
    >
      {/* One handheld screen: the battle field on top, the text box below, the same width as the result screen that follows. */}
      <div className="ds-box pop-in w-full max-w-md overflow-hidden">
        <div aria-hidden="true" className="capture-field relative h-64 overflow-hidden">
          {/* The grass platform the ball lands on. */}
          <div className="capture-platform absolute bottom-6 left-1/2 h-8 w-36 -translate-x-1/2" />

          {/* Ball: drop, then shake (the lid opens on a burst); faded out while the Pokémon runs. */}
          <div className={`absolute bottom-9 left-1/2 -ml-2 ${phase === 'flee' ? 'capture-fade' : ''}`}>
            <div className="capture-drop">
              <div
                className={phase === 'shake' ? 'capture-shake' : phase === 'click' ? 'capture-click' : ''}
                style={{ '--shakes': timeline.shakes } as CSSProperties}
              >
                <svg viewBox="0 0 16 16" shapeRendering="crispEdges" className="block h-4 w-4 overflow-visible">
                  <g>
                    {BASE.map((p) => (
                      <path key={p.color} fill={p.color} d={p.d} />
                    ))}
                  </g>
                  <g className={opened ? 'capture-lid' : ''}>
                    {LID.map((p) => (
                      <path key={p.color} fill={p.color} d={p.d} />
                    ))}
                  </g>
                </svg>
              </div>
            </div>
          </div>

          {/* Catch: three stars from the top of the ball. */}
          {phase === 'click' &&
            STARS.map((s, i) => (
              <div
                key={i}
                className="capture-star absolute bottom-[50px] left-1/2 -ml-1"
                style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as CSSProperties}
              >
                <PixelStar />
              </div>
            ))}

          {/* Escape: a flash and sparks as the ball bursts. */}
          {opened && (
            <>
              <div className="capture-flash absolute bottom-6 left-1/2 -ml-5 h-10 w-10 rounded-full bg-ds-paper" />
              {SPARKS.map((s, i) => (
                <div
                  key={i}
                  className="capture-star absolute bottom-[48px] left-1/2 -ml-1 h-2 w-2 border border-ds-ink bg-ds-paper"
                  style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as CSSProperties}
                />
              ))}
            </>
          )}

          {/* Escape: the Pokémon pops out as a white shape, takes its colours, then runs off to the right.
              PokéAPI sprites have empty rows below the feet, so bottom-5 stands them on the platform, not under it. */}
          {opened && sprite && (
            <div className="absolute bottom-5 left-1/2 -ml-24">
              <div className={phase === 'flee' ? 'capture-flee' : ''}>
                <img
                  src={sprite}
                  alt=""
                  width={192}
                  height={192}
                  className="capture-pop block h-48 w-48 object-contain [image-rendering:pixelated]"
                />
              </div>
            </div>
          )}
        </div>

        {/* In-game text box. */}
        <div className="border-t-4 border-ds-frame bg-ds-paper px-4 py-3 text-left sm:px-5 sm:py-4">
          <p aria-live="polite" className="min-h-10 text-xs leading-5">
            {caption}
          </p>
          {/* Skipping still works by tap or any key; the hint is only read out, not shown. */}
          <p className="sr-only">Tap or press any key to skip</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
