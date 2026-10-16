import { describe, expect, it } from 'vitest'
import type { Airport } from '../data/airports'
import type { Route } from '../data/flights'
import { atlasPosterOf, describeAtlasPoster } from './atlasPoster'

const airport = (code: string, lat: number, lng: number): Airport => ({ code, name: code, city: code, country: 'XX', lat, lng })
const CPH = airport('CPH', 55.6, 12.6)
const NRT = airport('NRT', 35.8, 140.4)
const route = (id: string, from: Airport, to: Airport, km: number): Route => ({ flight: { id, from: from.code, to: to.code }, from, to, km })
const FLOWN = [route('a', CPH, NRT, 8700), route('b', NRT, CPH, 8700), route('c', CPH, NRT, 8700)]

const travels = {
  visited: new Set(['Japan', 'Greenland', 'Denmark', 'Peru', 'Iceland']),
  cities: 4,
  flown: FLOWN,
  trips: 3,
  years: [2024, 2016, 2019],
}

describe('atlasPosterOf', () => {
  it('has every place been to, by continent and then by name, and counts them as the atlas does', () => {
    const poster = atlasPosterOf(travels)
    expect(poster.places.map(({ country }) => country.properties.name)).toEqual(['Japan', 'Denmark', 'Iceland', 'Greenland', 'Peru'])
    expect(poster.places.every(({ isNew }) => !isNew)).toBe(true)
    expect(poster).toMatchObject({ countries: 4, countryTotal: 197, territories: 1, continents: 4, cities: 4, trips: 3, since: 2016 })
  })

  it("has the share of the world's people and land", () => {
    const { share } = atlasPosterOf(travels)
    expect(share.people).toBeGreaterThan(0.015) // Japan, mostly
    expect(share.land).toBeGreaterThan(0.015) // Greenland, mostly
  })

  it('adds up the flights, and draws each pair of airports once', () => {
    const poster = atlasPosterOf(travels)
    expect(poster).toMatchObject({ flights: 3, km: 26_100 })
    expect(poster.laps).toBeCloseTo(26_100 / 40_075, 2)
    expect(poster.routes).toEqual([{ from: CPH, to: NRT }])
  })

  it('is empty, to begin with', () => {
    const poster = atlasPosterOf({ visited: new Set(), cities: 0, flown: [], trips: 0, years: [] })
    expect(poster).toMatchObject({ places: [], countries: 0, continents: 0, flights: 0, routes: [], since: null, share: { people: 0, land: 0 } })
  })
})

describe('describeAtlasPoster', () => {
  it('says the poster in words', () => {
    expect(describeAtlasPoster(atlasPosterOf(travels))).toMatch(
      /^Your atlas: 4 of 197 countries, 1 territory, on 4 continents, 4 cities\. Home to 2% of the world's people, on \d+% of its land\. 3 flights, 26,100 km\.$/,
    )
    expect(describeAtlasPoster(atlasPosterOf({ ...travels, visited: new Set(['Peru']), cities: 0, flown: [] }))).toBe(
      "Your atlas: 1 of 197 countries, on 1 continent. Home to <1% of the world's people, on <1% of its land.",
    )
  })
})
