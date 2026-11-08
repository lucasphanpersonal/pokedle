import { useEffect, useState } from 'react'
import { type DexEntry, fetchDexEntry, formatDex } from '../lib/dexEntry'
import type { Pokemon } from '../types/pokemon'

type State = { status: 'loading' } | { status: 'ready'; entry: DexEntry } | { status: 'error' }

/**
 * Pokédex entry shown after a win: number, category, height, weight and flavor
 * text. Number, height and weight come from the local dataset, so the card is
 * still useful offline; category and text load from PokéAPI.
 */
export function DexEntryCard({ target }: { target: Pokemon }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    const ctl = new AbortController()
    fetchDexEntry(target.dexNumber, ctl.signal).then(
      (entry) => setState({ status: 'ready', entry }),
      () => {
        if (!ctl.signal.aborted) setState({ status: 'error' })
      },
    )
    return () => ctl.abort()
  }, [target.dexNumber])

  return (
    <section
      aria-label={`Pokédex entry for ${target.name}`}
      className="w-full border-2 border-ds-frame bg-ds-paper p-3 text-left text-[9px] leading-5"
    >
      <div className="flex items-baseline justify-between gap-2 border-b-2 border-dashed border-ds-frame/30 pb-1">
        <span className="text-[10px]">
          <span className="text-ds-frame">No.</span> {formatDex(target.dexNumber)}
        </span>
        <span className="min-w-0 text-right [overflow-wrap:anywhere]">
          {state.status === 'ready' && state.entry.category ? state.entry.category : ''}
        </span>
      </div>
      <p className="mt-1">
        HT {target.height} m · WT {target.weight > 0 ? `${target.weight} kg` : '???'}
      </p>
      <p className="mt-2 min-h-10 [overflow-wrap:anywhere]" aria-live="polite">
        {state.status === 'loading' && <span className="text-ds-frame">Loading entry…</span>}
        {state.status === 'ready' && (state.entry.text || 'No entry text available.')}
        {state.status === 'error' && (
          <span className="text-ds-frame">The full entry couldn't be loaded. Check your connection and reopen this screen.</span>
        )}
      </p>
    </section>
  )
}
