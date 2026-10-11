import { describe, expect, it } from 'vitest'
import { countries } from '../countries'
import { countryOfPlace, territoriesOf } from './sovereigns'

const place = (name: string) => countries.find((c) => c.properties.name === name)!
const countryOf = (name: string) => countryOfPlace(place(name))?.properties.name ?? null

describe('countryOfPlace', () => {
  it('is the country itself for a country', () => {
    expect(countryOf('Denmark')).toBe('Denmark')
    expect(countryOf('Kosovo')).toBe('Kosovo')
  })

  it('is the country a territory belongs to', () => {
    expect(countryOf('Greenland')).toBe('Denmark')
    expect(countryOf('Faroe Islands')).toBe('Denmark')
    expect(countryOf('Åland Islands')).toBe('Finland')
    expect(countryOf('Puerto Rico')).toBe('United States')
    expect(countryOf('Gibraltar')).toBe('United Kingdom')
    expect(countryOf('Jersey')).toBe('United Kingdom')
    expect(countryOf('Aruba')).toBe('Netherlands')
    expect(countryOf('New Caledonia')).toBe('France')
    expect(countryOf('Hong Kong')).toBe('China')
    expect(countryOf('Norfolk Island')).toBe('Australia')
    expect(countryOf('Cook Islands')).toBe('New Zealand')
  })

  it("gives every territory its country, but those that are no one's or claimed by more than one", () => {
    const none = countries.filter((c) => c.properties.kind !== 'country' && !countryOfPlace(c)).map((c) => c.properties.name)
    expect(none.sort()).toEqual(['Antarctica', 'Siachen Glacier', 'Western Sahara'])
    for (const territory of countries.filter((c) => c.properties.kind !== 'country')) {
      const country = countryOfPlace(territory)
      if (country) expect(country.properties.kind, territory.properties.name).toBe('country')
    }
  })
})

describe('territoriesOf', () => {
  const territoriesOfPlace = (name: string) => territoriesOf(place(name)).map((t) => t.properties.name)

  it("is a country's territories, by name", () => {
    expect(territoriesOfPlace('Denmark')).toEqual(['Faroe Islands', 'Greenland'])
    expect(territoriesOfPlace('United States')).toEqual([
      'American Samoa',
      'Guam',
      'Northern Mariana Islands',
      'Puerto Rico',
      'U.S. Virgin Islands',
    ])
  })

  it('is none for a country without territories, and for a territory', () => {
    expect(territoriesOfPlace('Sweden')).toEqual([])
    expect(territoriesOfPlace('Greenland')).toEqual([])
  })

  it('has every territory that belongs to a country under it, once', () => {
    const listed = countries.flatMap((c) => territoriesOf(c))
    const belonging = countries.filter((c) => c.properties.kind !== 'country' && countryOfPlace(c))
    expect(listed).toHaveLength(belonging.length)
    expect(new Set(listed)).toEqual(new Set(belonging))
  })
})
