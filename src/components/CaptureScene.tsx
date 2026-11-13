import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import ballArt from '../../scripts/icons/pokeball.txt?raw'
import { captureTimeline, DROP_MS, SHAKE_MS, type CaptureKind } from '../lib/capture'
import { playCry } from '../lib/cry'
import { ballPaths, parseBallArt, STAR_ART, STAR_PALETTE } from '../lib/pokeballArt'
import { iconUrl, spriteUrl } from '../lib/pokedex'
import { playSound } from '../lib/sound'
import type { Pokemon } from '../types/pokemon'

/** The same hand-drawn ball as the tab icon, split at the band so the lid can open. */
const { grid32 } = parseBallArt(ballArt)
const LID = ballPaths(grid32, 0, 16)
const BASE = ballPaths(grid32, 16, 32)

type Phase = 'drop' | 'shake' | 'click' | 'burst' | 'flee'

/** Where the stars (catch) and sparks (escape) fly to, from the top of the ball. */
const STARS = [
  { dx: -72, dy: -24 },
  { dx: 0, dy: -50 },
  { dx: 72, dy: -24 },
]
const SPARKS = [
  { dx: -80, dy: -10 },
  { dx: -56, dy: -64 },
  { dx: 0, dy: -88 },
  { dx: 56, dy: -64 },
  { dx: 80, dy: -10 },
]

const STAR = ballPaths(STAR_ART, 0, STAR_ART.length, STAR_PALETTE)

/** The 9x9 pixel star, drawn at 3x. */
function PixelStar() {
  return (
    <svg viewBox="0 0 9 9" width="27" height="27" shapeRendering="crispEdges" aria-hidden="true" className="block">
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
 * clicks shut and gives off stars. Give up: it shakes twice, bursts open and the answer's sprite pops
 * out and runs off. About three seconds; a tap, click or any key skips it. App only shows it when the
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
    at(DROP_MS, () => setPhase('shake'))
    for (let i = 0; i < timeline.shakes; i++) at(DROP_MS + i * SHAKE_MS + 40, () => playSound('wobble'))
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
      onDoneRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (!document.querySelector('[data-modal]')) root?.removeAttribute('inert')
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
        <div aria-hidden="true" className="capture-field relative h-60 overflow-hidden sm:h-72">
          {/* The grass platform the ball lands on. */}
          <div className="capture-platform absolute bottom-6 left-1/2 h-10 w-56 -translate-x-1/2 sm:w-64" />

          {/* Ball: drop, then shake (the lid opens on a burst); faded out while the Pokémon runs. */}
          <div className={`absolute bottom-10 left-1/2 -ml-16 sm:-ml-20 ${phase === 'flee' ? 'capture-fade' : ''}`}>
            <div className="capture-drop">
              <div
                className={phase === 'shake' ? 'capture-shake' : phase === 'click' ? 'capture-click' : ''}
                style={{ '--shakes': timeline.shakes } as CSSProperties}
              >
                <svg viewBox="0 0 32 32" shapeRendering="crispEdges" className="block h-32 w-32 overflow-visible sm:h-40 sm:w-40">
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
                className="capture-star absolute bottom-[150px] left-1/2 -ml-[13px] sm:bottom-[182px]"
                style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as CSSProperties}
              >
                <PixelStar />
              </div>
            ))}

          {/* Escape: a flash and sparks as the ball bursts. */}
          {opened && (
            <>
              <div className="capture-flash absolute bottom-14 left-1/2 -ml-16 h-32 w-32 rounded-full bg-ds-paper sm:bottom-16 sm:-ml-20 sm:h-40 sm:w-40" />
              {SPARKS.map((s, i) => (
                <div
                  key={i}
                  className="capture-star absolute bottom-32 left-1/2 -ml-2 h-4 w-4 border-2 border-ds-ink bg-ds-paper sm:bottom-40"
                  style={{ '--dx': `${s.dx}px`, '--dy': `${s.dy}px` } as CSSProperties}
                />
              ))}
            </>
          )}

          {/* Escape: the Pokémon pops out as a white shape, takes its colours, then runs off to the right. */}
          {opened && sprite && (
            <div className="absolute bottom-20 left-1/2 -ml-24 sm:bottom-24">
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
          <p className="mt-1 tx-8 text-ds-frame">Tap or press any key to skip</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
