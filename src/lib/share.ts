import type { GuessFeedback, MatchFeedback, NumberFeedback } from './compare'
import type { GameMode } from './game'

/**
 * Emoji per tile. The Pokémon column is left out: it is only ever green on
 * the last row, which the score already says.
 */
const EMOJI: Record<MatchFeedback | NumberFeedback, string> = {
  match: '🟩',
  partial: '🟨',
  mismatch: '🟥',
  higher: '⬆️',
  lower: '⬇️',
  unknown: '🟥',
}

export function shareRow(f: GuessFeedback): string {
  return [
    f.type1,
    f.type2,
    f.generation,
    f.height,
    f.weight,
    f.color,
    f.evolutionStage,
    f.ability.result,
  ]
    .map((r) => EMOJI[r])
    .join('')
}

export interface ShareInput {
  mode: GameMode
  puzzleNumber: number | null
  feedback: GuessFeedback[]
  url: string
}

/**
 * Spoiler-free result, e.g.
 *
 *   Pokemondle #12 4 guesses
 *   🟥🟩⬆️⬇️⬆️🟥⬇️🟥
 *   ...
 *   https://...
 */
export function buildShareText({ mode, puzzleNumber, feedback, url }: ShareInput): string {
  const title = mode === 'daily' && puzzleNumber !== null ? `Pokemondle #${puzzleNumber}` : 'Pokemondle Endless'
  const n = feedback.length
  const score = `${n} ${n === 1 ? 'guess' : 'guesses'}`
  return [`${title} ${score}`, ...feedback.map(shareRow), url].join('\n')
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Opens the system share sheet on phones and tablets, otherwise copies to the
 * clipboard. Desktop browsers that support navigator.share open a dialog that
 * is clumsier than a copy, so they get the clipboard.
 */
export async function shareResult(text: string): Promise<ShareOutcome> {
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  if (touch && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      // The player closed the share sheet: don't fall through to a copy.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return copyWithTextarea(text) ? 'copied' : 'failed'
  }
}

/** Fallback for browsers without the async clipboard API (or without permission). */
function copyWithTextarea(text: string): boolean {
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  } catch {
    return false
  }
}
