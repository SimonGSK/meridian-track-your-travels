import { describe, expect, it } from 'vitest'
import { countries } from '../countries'
import { MIDNIGHT } from '../globe/themes'
import { recording } from '../test/recordingCanvas'
import type { AtlasPoster } from './atlasPoster'
import { flagRowsFor } from './cardDrawing'
import { drawAtlasPoster } from './drawAtlasPoster'

const byName = (name: string) => countries.find((c) => c.properties.name === name)!
const poster: AtlasPoster = {
  places: ['Japan', 'Denmark', 'Greenland'].map((name) => ({ country: byName(name), isNew: false })),
  countries: 2,
  countryTotal: 197,
  territories: 1,
  continents: 2,
  cities: 4,
  share: { people: 0.0153, land: 0.0158 },
  flights: 12,
  km: 60_000,
  laps: 60_000 / 40_075,
  routes: [{ from: { lat: 55.6, lng: 12.6 }, to: { lat: 35.8, lng: 140.4 } }],
  trips: 7,
  since: 2016,
}
const flagsOf = (p: AtlasPoster) => new Map(p.places.map(({ country }) => [country, { flag: country.properties.name }] as const))

describe('drawAtlasPoster', () => {
  it("draws how many of the world's countries, the territories, continents and cities, the world's share, and the flights", () => {
    const { context, texts } = recording()
    drawAtlasPoster(context, poster, flagsOf(poster) as never)
    expect(texts.map((t) => t.text)).toEqual(
      expect.arrayContaining([
        'MERIDIAN',
        'Your atlas',
        '2',
        'countries of 197',
        "1% OF THE WORLD'S COUNTRIES",
        '1',
        'TERRITORY',
        'CONTINENTS',
        '4',
        'CITIES',
        "Home to 2% of the world's people, on 2% of its land",
        '✈ 12 flights · 60,000 km · 1.5× around the Earth',
        '7 trips since 2016',
      ]),
    )
  })

  it('colors the places been to on the map, and draws their flags', () => {
    const { context, fills, images } = recording()
    drawAtlasPoster(context, poster, flagsOf(poster) as never)
    expect(fills.filter((color) => color === MIDNIGHT.visited)).toHaveLength(3)
    expect(images).toEqual([{ flag: 'Japan' }, { flag: 'Denmark' }, { flag: 'Greenland' }])
  })

  it('says when, without flights or trips', () => {
    const { context, texts } = recording()
    drawAtlasPoster(context, { ...poster, flights: 0, km: 0, laps: 0, routes: [], trips: 0 }, flagsOf(poster) as never)
    const drawn = texts.map((t) => t.text)
    expect(drawn).toContain('Since 2016')
    expect(drawn.some((t) => t.startsWith('✈'))).toBe(false)
  })
})

describe('flagRowsFor', () => {
  it('makes the flags as big as all of them fit, down to the smallest, and then as many as fit', () => {
    // A few: as big as they come
    expect(flagRowsFor(5, 1000, 280, [120, 56])).toMatchObject({ width: 120 })
    // 42: smaller, in rows that hold them all
    const many = flagRowsFor(42, 1000, 280, [120, 56])
    expect(many.aRow * many.rows).toBeGreaterThanOrEqual(42)
    expect(many.width).toBeLessThan(120)
    expect(many.aRow * (many.width + many.gap) - many.gap).toBeLessThanOrEqual(1000)
    expect(many.rows * (many.width * 0.75 + many.gap) - many.gap).toBeLessThanOrEqual(280)
    // Every place: the smallest, the rest as "+N"
    const all = flagRowsFor(240, 1000, 280, [120, 56])
    expect(all.width).toBe(56)
    expect(all.aRow * all.rows).toBeLessThan(240)
  })
})
