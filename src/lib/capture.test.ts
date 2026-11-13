import { describe, expect, it } from 'vitest'
import { captureTimeline, DROP_MS, SHAKE_MS } from './capture'

describe('captureTimeline', () => {
  it('a catch shakes three times, then clicks', () => {
    const t = captureTimeline('catch')
    expect(t.shakes).toBe(3)
    expect(t.settle).toBe(DROP_MS + 3 * SHAKE_MS)
    expect(t.flee).toBeUndefined()
    expect(t.end).toBeGreaterThan(t.settle)
  })

  it('an escape also shakes three times, then bursts, then the Pokémon runs before the end', () => {
    const t = captureTimeline('escape')
    expect(t.shakes).toBe(3)
    expect(t.flee!).toBeGreaterThan(t.settle)
    expect(t.end).toBeGreaterThan(t.flee!)
  })

  it('keeps the games\' pace without dragging: about 5 seconds, skippable', () => {
    expect(captureTimeline('catch').end).toBeLessThanOrEqual(5000)
    expect(captureTimeline('escape').end).toBeLessThanOrEqual(6000)
  })
})
