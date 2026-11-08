import { beforeEach, describe, expect, it, vi } from 'vitest'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('sound', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('window', { localStorage: fakeStorage() })
  })

  it('is on by default and remembers being muted', async () => {
    const a = await import('./sound')
    expect(a.isSoundOn()).toBe(true)
    a.setSoundOn(false)
    vi.resetModules()
    const b = await import('./sound')
    expect(b.isSoundOn()).toBe(false)
  })

  it('does not throw when Web Audio is unavailable', async () => {
    const s = await import('./sound')
    expect(() => s.playSound('win')).not.toThrow()
  })

  it('every effect has audible, ordered notes', async () => {
    const { notesFor } = await import('./sound')
    for (const name of ['type', 'move', 'select', 'tick', 'error', 'win', 'toggle'] as const) {
      const notes = notesFor(name)
      expect(notes.length).toBeGreaterThan(0)
      for (const note of notes) {
        expect(note.f).toBeGreaterThan(20)
        expect(note.dur).toBeGreaterThan(0)
      }
    }
  })

  it('shifts pitch by semitones', async () => {
    const { notesFor } = await import('./sound')
    expect(notesFor('tick', 12)[0].f).toBeCloseTo(notesFor('tick')[0].f * 2)
  })
})
