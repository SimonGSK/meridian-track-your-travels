import { describe, expect, it } from 'vitest'
import { countries } from '../countries'
import { MIDNIGHT } from '../globe/themes'
import { recording } from '../test/recordingCanvas'
import { COLORS } from './cardDrawing'
import { drawTripCard } from './drawTripCard'
import type { TripCard } from './tripCard'

const byName = (name: string) => countries.find((c) => c.properties.name === name)!
const TOKYO = { lat: 35.8, lng: 140.4 }
const SEOUL = { lat: 37.5, lng: 126.4 }
const COPENHAGEN = { lat: 55.6, lng: 12.6 }
const trip: TripCard = {
  title: 'Spring in Asia',
  when: 'Apr – May 2024',
  toCome: null,
  places: [
    { country: byName('Japan'), isNew: false },
    { country: byName('South Korea'), isNew: true },
  ],
  countries: 2,
  newPlaces: 1,
  flights: [
    { from: COPENHAGEN, to: TOKYO },
    { from: TOKYO, to: SEOUL },
    { from: SEOUL, to: COPENHAGEN },
  ],
  km: 18_800,
  laps: 18_800 / 40_075,
  longest: { from: 'Seoul', to: 'Copenhagen', km: 8_900 },
  view: { lat: 50, lng: 80 },
  reach: 60,
}
const flagsOf = (card: TripCard) => new Map(card.places.map((p) => [p.country, { flag: p.country.properties.name }] as const))

describe('drawTripCard', () => {
  it('draws its name, when, how many countries, new and flights, and how far it flew', () => {
    const { context, texts } = recording()
    drawTripCard(context, trip, flagsOf(trip) as never)
    const drawn = texts.map((t) => t.text)
    expect(drawn).toEqual(
      expect.arrayContaining([
        'MERIDIAN',
        'A trip',
        'Spring in Asia',
        'Apr – May 2024',
        '2',
        'COUNTRIES',
        '1',
        'NEW',
        '3',
        'FLIGHTS',
        '✈ 18,800 km flown · 0.5× around the Earth',
        'Longest: Seoul → Copenhagen · 8,900 km',
      ]),
    )
  })

  it('colors the places first visited on it green, and those been to before as on the globe', () => {
    const { context, fills } = recording()
    drawTripCard(context, trip, flagsOf(trip) as never)
    expect(fills.filter((color) => color === MIDNIGHT.correct)).toHaveLength(1) // South Korea
    expect(fills.filter((color) => color === MIDNIGHT.visited)).toHaveLength(1) // Japan
  })

  it("draws its places' flags, in the order it went", () => {
    const { context, images } = recording()
    drawTripCard(context, trip, flagsOf(trip) as never)
    expect(images).toEqual([{ flag: 'Japan' }, { flag: 'South Korea' }])
  })

  it('counts down to a trip to come, and leaves out the flights for one without', () => {
    const coming: TripCard = { ...trip, toCome: 'in 5 months', flights: [], km: 0, laps: 0, longest: null }
    const { context, texts } = recording()
    drawTripCard(context, coming, flagsOf(coming) as never)
    const drawn = texts.map((t) => t.text)
    expect(drawn).toEqual(expect.arrayContaining(['Coming up', 'Apr – May 2024 · in 5 months', '0', 'FLIGHTS']))
    expect(drawn.some((t) => t.startsWith('✈') || t.startsWith('Longest'))).toBe(false)
  })

  it('makes a long name smaller to fit, then puts it on two lines, and cuts it short if it still does not fit', () => {
    /** Its name's lines, and how big */
    const titleOf = (title: string) => {
      const { context, texts } = recording()
      drawTripCard(context, { ...trip, title }, flagsOf(trip) as never)
      const lines = texts.filter((t) => t.fill === COLORS.cream && t.font.startsWith('700'))
      return { lines: lines.map((t) => t.text), size: Number(/(\d+)px/.exec(lines[0].font)![1]) }
    }
    // 960 wide, a letter half as wide as the font is big: 30 letters at the smallest
    expect(titleOf('Spring in Asia')).toEqual({ lines: ['Spring in Asia'], size: 120 })
    expect(titleOf('Two weeks around the Med')).toEqual({ lines: ['Two weeks around the Med'], size: 80 })
    expect(titleOf('Kenya, South Africa & United Arab Emirates')).toEqual({ lines: ['Kenya, South Africa &', 'United Arab Emirates'], size: 88 })
    expect(titleOf('A very long name for a trip around the world, by train and boat and back again')).toEqual({
      lines: ['A very long name for a trip', 'around the world, by train…'],
      size: 64,
    })
    expect(titleOf('Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch').lines).toEqual(['Llanfairpwllgwyngyllgogerychw…'])
  })
})
