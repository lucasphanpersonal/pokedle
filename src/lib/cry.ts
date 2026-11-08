import type { Pokemon } from '../types/pokemon'
import { isSoundOn, subscribeSound } from './sound'

/**
 * Pokémon cries from the PokéAPI cries repository (the same host family as the
 * sprites). Played once on a win, never fetched during play. Forms without
 * their own cry fall back to their species' cry.
 */
const CRY_BASE = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest'

export const cryUrl = (id: number) => `${CRY_BASE}/${id}.ogg`

/** Candidate cry URLs for a Pokémon: its own form first, then its species. */
export function cryUrls(pokemon: Pokemon): string[] {
  return pokemon.dexNumber !== pokemon.id ? [cryUrl(pokemon.id), cryUrl(pokemon.dexNumber)] : [cryUrl(pokemon.id)]
}

let current: HTMLAudioElement | null = null

/** Stop any cry that is still playing (new game, mode switch, or muted). */
export function stopCry(): void {
  if (!current) return
  current.onerror = null
  current.pause()
  current = null
}

// Muting mid-cry must cut it off straight away.
subscribeSound(() => {
  if (!isSoundOn()) stopCry()
})

function tryPlay(urls: string[]): void {
  const [url, ...rest] = urls
  if (!url) return
  try {
    stopCry()
    const audio = new Audio(url)
    // A missing cry (404, offline) moves on to the species cry, then gives up silently.
    audio.onerror = () => tryPlay(rest)
    current = audio
    void audio.play().catch(() => {})
  } catch {
    // Audio is a nicety; never break the game over it.
  }
}

/** Play the Pokémon's cry. Silent when muted, offline, or unsupported; never throws. */
export function playCry(pokemon: Pokemon): void {
  if (!isSoundOn() || typeof Audio === 'undefined') return
  tryPlay(cryUrls(pokemon))
}
