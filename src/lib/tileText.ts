import { abilityCellText, type GuessFeedback } from './compare'
import type { Pokemon } from '../types/pokemon'

/**
 * Helpers that keep guess-tile text inside the tile's padding (clear of the bevel).
 *
 * The pixel font is monospaced (every glyph is 1em wide), so the width a word needs
 * is just its length in characters times the font size. Each tile is told its
 * longest word (--chars) and the CSS in index.css (.tile-fit) picks the largest
 * font, down to 7px, at which that word fits on one line.
 */

const SHY = '\u00AD'

/**
 * Long words that may still not fit at 7px in the narrowest tiles get a soft hyphen at
 * a natural break. It only shows (as "-") when the word really has to wrap.
 */
const BREAKS: Record<string, string> = {
  Electric: `Elec${SHY}tric`,
  Fighting: `Fight${SHY}ing`,
  Psychic: `Psy${SHY}chic`,
  Undiscovered: `Undis${SHY}covered`,
  Amorphous: `Amor${SHY}phous`,
  Gigantamax: `Gigan${SHY}tamax`,
  Regional: `Region${SHY}al`,
  Cosmetic: `Cos${SHY}metic`,
}

/** Adds soft hyphens to the long game words in a tile's text. */
export function breakable(text: string): string {
  return text.replace(/[A-Za-z]+/g, (w) => BREAKS[w] ?? w)
}

/** Length of the longest word across the given text parts (split at spaces; a trailing comma counts, as it is drawn on the same line). */
export function longestWord(...parts: (string | number)[]): number {
  let max = 1
  for (const p of parts) for (const w of String(p).split(/\s+/)) max = Math.max(max, w.replace(/\u00AD/g, '').length)
  return max
}

/**
 * Length of the longest piece that can't be split: words cut at soft hyphens and real
 * hyphens, counting the "-" drawn at the end of the line. With this the CSS can choose a
 * wrapped 8px word ("Undis- / covered") over squeezing it onto one line at 7px.
 */
export function longestPiece(...parts: (string | number)[]): number {
  let max = 1
  for (const p of parts)
    for (const w of breakable(String(p)).split(/\s+/))
      for (const piece of w.split(/(?<=[-\u00AD])/)) max = Math.max(max, piece.length)
  return max
}

/**
 * Narrowest line, in characters, at which a name wraps (at spaces) onto at most `maxLines`
 * lines. Never less than the name's longest word. Used to size names in the table's
 * Pokémon tile so even "Paldean Tauros (Combat Breed)" fits without being cut off.
 */
export function lineChars(text: string, maxLines: number): number {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = (cap: number) => {
    let count = 0
    let len = 0
    for (const w of words) {
      if (len > 0 && len + 1 + w.length <= cap) len += 1 + w.length
      else {
        count++
        len = w.length
      }
    }
    return count
  }
  let cap = Math.max(1, ...words.map((w) => w.length))
  while (lines(cap) > Math.max(1, maxLines)) cap++
  return cap
}

/** Font-fit variables for a tile (see .tile-fit in index.css): base size, longest word and longest unbreakable piece. */
export interface Fit {
  chars: number
  piece: number
}
/**
 * Shared Ability can be three long names, so it is sized by line count as well as by its longest
 * word: the largest size (up to 9px) at which it wraps onto 4 lines, or else up to 8px on 5 lines.
 * Both fit inside the 72px table tile (taller, in step with the text, with Larger text on). Wraps at spaces only, like the browser.
 */
export const abilityFit = (text: string): Fit => ({ chars: lineChars(text, 4), piece: lineChars(text, 5) })
/**
 * The table's Shared Ability column uses the size its most demanding row needs, for every row, so
 * "Overgrow, Chlorophyll" and "Poison Point, Rivalry, Hustle" sit at the same size. A smaller size
 * only ever needs fewer lines, so every row still fits.
 */
export function abilityColumnFit(guesses: readonly Pokemon[], feedback: readonly GuessFeedback[]): Fit {
  return guesses.reduce<Fit>(
    (acc, g, i) => {
      const f = abilityFit(abilityCellText(g, feedback[i].ability))
      return { chars: Math.max(acc.chars, f.chars), piece: Math.max(acc.piece, f.piece) }
    },
    { chars: 1, piece: 1 },
  )
}
