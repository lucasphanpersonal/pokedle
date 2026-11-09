import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissHardNotice, effectiveHard, hardLocked, isHardNoticePending, setHardPref } from './hardMode'

describe('hard mode rules', () => {
  it('a fresh game follows the preference', () => {
    expect(effectiveHard({ guessIds: [] }, true)).toBe(true)
    expect(effectiveHard({ guessIds: [] }, false)).toBe(false)
  })
  it('a game with guesses keeps the mode it started in', () => {
    expect(effectiveHard({ guessIds: [3], hard: true }, false)).toBe(true)
    expect(effectiveHard({ guessIds: [3] }, true)).toBe(false)
  })
  it('locks only while a game is in progress', () => {
    expect(hardLocked({ guessIds: [], targetId: 1 })).toBe(false)
    expect(hardLocked({ guessIds: [2], targetId: 1 })).toBe(true)
    expect(hardLocked({ guessIds: [2, 1], targetId: 1 })).toBe(false)
  })
})

describe('hard mode first-time notice', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('shows once, the first time Hard is turned on', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    })
    const m = { dismissHardNotice, isHardNoticePending, setHardPref }
    m.setHardPref(false)
    expect(m.isHardNoticePending()).toBe(false)
    m.setHardPref(true)
    expect(m.isHardNoticePending()).toBe(true)
    m.dismissHardNotice()
    expect(m.isHardNoticePending()).toBe(false)
    m.setHardPref(false)
    m.setHardPref(true)
    expect(m.isHardNoticePending()).toBe(false)
  })
})
