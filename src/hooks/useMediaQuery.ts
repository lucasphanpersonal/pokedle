import { useCallback, useSyncExternalStore } from 'react'

/**
 * Live result of a CSS media query, e.g. useMediaQuery('(min-width: 64rem)').
 * Re-renders only when the match flips (rotating an iPad, resizing a window),
 * not on every resize event. Without matchMedia (tests, very old browsers) it
 * reports false.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = typeof window !== 'undefined' ? window.matchMedia?.(query) : undefined
      if (!list) return () => {}
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => (typeof window !== 'undefined' && window.matchMedia?.(query).matches) || false,
    () => false,
  )
}
