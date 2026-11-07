import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyCrt, isCrtOn, setCrt } from './display'

function fakeStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

let classes: Set<string>

beforeEach(() => {
  classes = new Set()
  const classList = {
    toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c), on),
    contains: (c: string) => classes.has(c),
  }
  vi.stubGlobal('window', { localStorage: fakeStorage() })
  vi.stubGlobal('document', { documentElement: { classList } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CRT display setting', () => {
  it('is on by default', () => {
    expect(isCrtOn()).toBe(true)
  })

  it('stays off once the player turns it off', () => {
    setCrt(false)
    expect(isCrtOn()).toBe(false)
    expect(classes.has('crt')).toBe(false)
  })

  it('toggles the crt class on <html>', () => {
    applyCrt(true)
    expect(classes.has('crt')).toBe(true)
    setCrt(false)
    expect(classes.has('crt')).toBe(false)
    setCrt(true)
    expect(classes.has('crt')).toBe(true)
    expect(isCrtOn()).toBe(true)
  })

  it('stays on when storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
      },
    })
    expect(isCrtOn()).toBe(true)
    expect(() => setCrt(false)).not.toThrow()
    expect(classes.has('crt')).toBe(false)
  })
})
