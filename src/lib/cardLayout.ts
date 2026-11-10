/**
 * Grid span (of 12) for the i-th small tile on a phone card, shared with the key above the cards.
 * Normally two rows of four (Hard mode: three wider tiles on top, as Gen is gone). With Larger text
 * on screens under 640 px, four tiles are too narrow for the bigger text, so they go in rows of three
 * and the last row's one or two tiles stretch to fill it.
 */
export function cardTileSpan(i: number, hard: boolean): string {
  const normal = hard && i < 3 ? 'col-span-4' : 'col-span-3'
  const big = i < 6 ? 'big:max-sm:col-span-4' : hard ? 'big:max-sm:col-span-12' : 'big:max-sm:col-span-6'
  return `${normal} ${big}`
}

/**
 * Cards sit two to a row from 720 px (iPad portrait). With Larger text that would make the tiles too
 * narrow, so it waits until 900 px (720 × 1.25). Full class names, so Tailwind can find them.
 */
export const TWO_UP = {
  normal: {
    /** The card list and the key row. */
    grid: 'min-[720px]:grid-cols-2',
    /** The second copy of the key, over the right-hand column. */
    keyCopy: 'hidden min-[720px]:grid',
    /** Each card: no top rule or padding on the first row, no bottom padding on the last. */
    card: 'min-[720px]:[&:nth-child(2)]:border-t-0 min-[720px]:[&:nth-child(2)]:pt-0 min-[720px]:[&:nth-last-child(2):nth-child(odd)]:pb-0',
  },
  big: {
    grid: 'min-[900px]:grid-cols-2',
    keyCopy: 'hidden min-[900px]:grid',
    card: 'min-[900px]:[&:nth-child(2)]:border-t-0 min-[900px]:[&:nth-child(2)]:pt-0 min-[900px]:[&:nth-last-child(2):nth-child(odd)]:pb-0',
  },
} as const
