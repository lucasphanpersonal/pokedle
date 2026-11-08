import { describe, expect, it } from 'vitest'
import { cleanFlavorText, formatDex, parseEntry } from './dexEntry'

describe('formatDex', () => {
  it('pads to three digits and keeps longer numbers', () => {
    expect(formatDex(25)).toBe('#025')
    expect(formatDex(1)).toBe('#001')
    expect(formatDex(1025)).toBe('#1025')
  })
})

describe('cleanFlavorText', () => {
  it('flattens line breaks, form feeds and soft hyphens', () => {
    expect(cleanFlavorText('When several\nof these\fgather, its elec\u00ad\ntric')).toBe(
      'When several of these gather, its electric',
    )
  })
})

describe('parseEntry', () => {
  it('takes the English genus and the newest English text', () => {
    const entry = parseEntry({
      genera: [
        { genus: 'ねずみポケモン', language: { name: 'ja' } },
        { genus: 'Mouse Pokémon', language: { name: 'en' } },
      ],
      flavor_text_entries: [
        { flavor_text: 'old', language: { name: 'en' } },
        { flavor_text: 'ignored', language: { name: 'de' } },
        { flavor_text: 'new\nline', language: { name: 'en' } },
      ],
    })
    expect(entry).toEqual({ category: 'Mouse Pokémon', text: 'new line' })
  })
  it('returns null when nothing is in English', () => {
    expect(parseEntry({ genera: [], flavor_text_entries: [] })).toBeNull()
  })
})
