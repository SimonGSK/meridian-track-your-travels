import { describe, expect, it } from 'vitest'
import type { Airport } from '../data/airports'
import type { Route } from '../data/flights'
import { tripViewsOf, type SavedTrip, type TripItem } from '../data/savedTrips'
import type { VisitDate } from '../data/visitDates'
import { describeTripCard, placesTitle, tripCardOf } from './tripCard'

const airport = (code: string, city: string, country: string, lat: number, lng: number): Airport => ({ code, name: code, city, country, lat, lng })
const CPH = airport('CPH', 'Copenhagen', 'DK', 55.6, 12.6)
const NRT = airport('NRT', 'Tokyo (Narita)', 'JP', 35.8, 140.4)
const ICN = airport('ICN', 'Seoul', 'KR', 37.5, 126.4)
const route = (id: string, from: Airport, to: Airport, date: VisitDate, km: number): Route => ({ flight: { id, from: from.code, to: to.code, date }, from, to, km })
const ROUTES = [route('a', CPH, NRT, '2024-04', 8700), route('b', NRT, ICN, '2024-04', 1200), route('c', ICN, CPH, '2024-05', 8900)]
const visit = (place: string, date: VisitDate | null = null): TripItem => ({ kind: 'visit', place, date })
const flight = (id: string): TripItem => ({ kind: 'flight', flight: id })
const viewOf = (items: TripItem[], name = '') => tripViewsOf([{ id: 't', name, items } satisfies SavedTrip], ROUTES)[0]

const ASIA = [flight('a'), visit('Japan', '2024-04'), flight('b'), visit('South Korea', '2024-04'), flight('c')]
/** Japan first in 2019; South Korea first on this trip */
const FIRST: Record<string, VisitDate> = { Japan: '2019', 'South Korea': '2024-04' }
const firstVisitOf = (place: string) => FIRST[place] ?? null

describe('placesTitle', () => {
  it('names up to three places, and how many more after two', () => {
    expect(placesTitle([])).toBe('')
    expect(placesTitle(['Japan'])).toBe('Japan')
    expect(placesTitle(['Japan', 'South Korea'])).toBe('Japan & South Korea')
    expect(placesTitle(['Japan', 'South Korea', 'China'])).toBe('Japan, South Korea & China')
    expect(placesTitle(['Japan', 'South Korea', 'China', 'Vietnam', 'Laos'])).toBe('Japan, South Korea & 3 more')
  })
})

describe('tripCardOf', () => {
  it('has its name, when, places, the new ones, and its flights', () => {
    const card = tripCardOf(viewOf(ASIA, 'Spring in Asia'), firstVisitOf)
    expect(card).toMatchObject({
      title: 'Spring in Asia',
      when: 'Apr – May 2024',
      toCome: null,
      countries: 2,
      newPlaces: 1,
      km: 18_800,
      longest: { from: 'Seoul', to: 'Copenhagen', km: 8900 },
    })
    expect(card.places.map(({ country, isNew }) => [country.properties.name, isNew])).toEqual([
      ['Japan', false],
      ['South Korea', true],
    ])
    expect(card.flights).toHaveLength(3)
    expect(card.laps).toBeCloseTo(18_800 / 40_075, 2)
  })

  it('is named by where it went, without a name', () => {
    expect(tripCardOf(viewOf(ASIA), firstVisitOf).title).toBe('Japan & South Korea')
    // Only flights: where they landed, as the trip is called in the list
    expect(tripCardOf(viewOf([flight('a')]), firstVisitOf).title).toBe('Japan')
  })

  it('has each place once, in the order it went, and counts Greenland as Denmark', () => {
    const card = tripCardOf(viewOf([visit('Denmark', '2023-06'), visit('Greenland', '2023-07'), visit('Denmark', '2023-08')]), () => null)
    expect(card.places.map(({ country }) => country.properties.name)).toEqual(['Denmark', 'Greenland'])
    expect(card.countries).toBe(1)
    expect(card.newPlaces).toBe(0)
  })

  it('looks at the places from close by, and at a long flight from further out', () => {
    const near = tripCardOf(viewOf([visit('Japan', '2024-04')]), firstVisitOf)
    expect(near.view.lat).toBeCloseTo(36, -1)
    expect(near.view.lng).toBeCloseTo(138, -1)
    expect(near.reach).toBeLessThan(20)
    const far = tripCardOf(viewOf(ASIA), firstVisitOf)
    expect(far.reach).toBeGreaterThan(40)
  })

  it('counts down to a trip to come', () => {
    const card = tripCardOf(viewOf([visit('Peru', '2027-03')]), () => '2027-03', new Date('2026-10-15T12:00'))
    expect(card).toMatchObject({ when: 'Mar 2027', toCome: 'in 5 months', newPlaces: 1 })
  })

  it('has no date for a trip without one', () => {
    expect(tripCardOf(viewOf([visit('Peru')]), () => null)).toMatchObject({ when: null, toCome: null, flights: [], longest: null })
  })
})

describe('describeTripCard', () => {
  it('says the card in words', () => {
    expect(describeTripCard(tripCardOf(viewOf(ASIA, 'Spring in Asia'), firstVisitOf))).toBe(
      'Spring in Asia, Apr – May 2024: 2 countries, 1 new place. 3 flights, 18,800 km.',
    )
    expect(describeTripCard(tripCardOf(viewOf([visit('Peru')]), () => null))).toBe('Peru: 1 country.')
  })
})
