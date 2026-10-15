import { describe, expect, it } from 'vitest'
import { countries } from '../countries'
import { MIDNIGHT } from '../globe/themes'
import { recording } from '../test/recordingCanvas'
import { CARD_HEIGHT, CARD_WIDTH, drawWrapped } from './drawWrapped'
import type { Wrapped } from './wrapped'

const byName = (name: string) => countries.find((c) => c.properties.name === name)!
const year: Wrapped = {
  year: 2025,
  places: [
    { country: byName('Japan'), isNew: true },
    { country: byName('Peru'), isNew: true },
    { country: byName('France'), isNew: false },
  ],
  countries: 3,
  newPlaces: 2,
  continents: 3,
  flights: 4,
  km: 23_400,
  laps: 23_400 / 40_075,
  longest: { from: 'Copenhagen', to: 'Tokyo', km: 8_700 },
  busiestMonth: { name: 'April', places: 2 },
  mostTravelled: true,
  view: { lat: 30, lng: 40 },
}
const flagsOf = (w: Wrapped) => new Map(w.places.map((p) => [p.country, { flag: p.country.properties.name }] as const))

describe('drawWrapped', () => {
  it('is a story-sized card', () => {
    expect(CARD_WIDTH / CARD_HEIGHT).toBeCloseTo(9 / 16)
  })

  it('draws the year, how many countries, new and continents, and the flights', () => {
    const { context, texts } = recording()
    drawWrapped(context, year, flagsOf(year) as never)
    const drawn = texts.map((t) => t.text)
    expect(drawn).toEqual(
      expect.arrayContaining([
        'MERIDIAN',
        '2025',
        'wrapped',
        'YOUR MOST TRAVELLED YEAR',
        '3',
        'COUNTRIES',
        '2',
        'NEW',
        'CONTINENTS',
        '✈ 4 flights · 23,400 km · 0.6× around the Earth',
        'Longest: Copenhagen → Tokyo · 8,700 km',
      ]),
    )
  })

  it('colors the places first visited green, as the "new" figure, and those visited before as on the globe', () => {
    const { context, fills } = recording()
    drawWrapped(context, year, flagsOf(year) as never)
    expect(fills.filter((color) => color === MIDNIGHT.correct)).toHaveLength(2) // Japan and Peru
    expect(fills.filter((color) => color === MIDNIGHT.visited)).toHaveLength(1) // France
  })

  it("draws each place's flag, the new ones first", () => {
    const { context, images } = recording()
    drawWrapped(context, year, flagsOf(year) as never)
    expect(images).toEqual([{ flag: 'Japan' }, { flag: 'Peru' }, { flag: 'France' }])
  })

  it('fits up to 18 flags, the rest as "+N"', () => {
    const many: Wrapped = { ...year, places: countries.slice(0, 25).map((country) => ({ country, isNew: false })) }
    const { context, images, texts } = recording()
    drawWrapped(context, many, flagsOf(many) as never)
    expect(images).toHaveLength(17)
    expect(texts.map((t) => t.text)).toContain('+8')
  })

  it('names the busiest month for a year without flights, and leaves out what it was not', () => {
    const quiet: Wrapped = { ...year, flights: 0, km: 0, laps: 0, longest: null, mostTravelled: false, continents: 1 }
    const { context, texts } = recording()
    drawWrapped(context, quiet, flagsOf(quiet) as never)
    const drawn = texts.map((t) => t.text)
    expect(drawn).toContain('Busiest month: April, 2 places')
    expect(drawn).toContain('CONTINENT')
    expect(drawn.some((t) => t.startsWith('✈') || t === 'YOUR MOST TRAVELLED YEAR')).toBe(false)
  })
})
