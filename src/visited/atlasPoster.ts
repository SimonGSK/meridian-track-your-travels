import { countries, type CountryFeature } from '../countries'
import { CONTINENTS } from '../data/continents'
import { worldShareOf } from '../data/facts'
import { EARTH_CIRCUMFERENCE_KM, uniqueRoutes, type Route } from '../data/flights'
import { countriesOf } from '../data/sovereigns'
import type { CardPlace } from './cardDrawing'
import { percentLabel } from './percentLabel'

/**
 * Your atlas, all of it, as a poster to keep or share: every place been to,
 * on a map of the world, with their flags; how many countries of the
 * world's, territories, continents and cities; how much of the world's
 * people and land they are; and every flight.
 */
export type AtlasPoster = {
  /** Every place been to, by continent, then by name */
  places: CardPlace[]
  /** The countries been to, Greenland counting as Denmark */
  countries: number
  /** Of the world's */
  countryTotal: number
  territories: number
  continents: number
  cities: number
  /** The share of the world's people living in the places, and of its land, from 0 to 1 */
  share: { people: number; land: number }
  flights: number
  km: number
  /** Times around the Earth */
  laps: number
  /** Each pair of airports flown between once, to draw */
  routes: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }[]
  /** Trips been on */
  trips: number
  /** The first year with a date, if any has one */
  since: number | null
}

const isCountry = (c: CountryFeature) => c.properties.kind === 'country'
const COUNTRY_TOTAL = countries.filter(isCountry).length
const byContinentAndName = (a: CountryFeature, b: CountryFeature) =>
  CONTINENTS.indexOf(a.properties.continent) - CONTINENTS.indexOf(b.properties.continent) || a.properties.name.localeCompare(b.properties.name)

type Travels = {
  /** Places been to, by name */
  visited: ReadonlySet<string>
  /** Cities been to */
  cities: number
  /** The flights flown */
  flown: readonly Route[]
  /** Trips been on */
  trips: number
  /** The years with dates */
  years: readonly number[]
}

export function atlasPosterOf({ visited, cities, flown, trips, years }: Travels): AtlasPoster {
  const places = countries.filter((c) => visited.has(c.properties.name)).sort(byContinentAndName)
  const km = flown.reduce((sum, route) => sum + route.km, 0)
  return {
    places: places.map((country) => ({ country, isNew: false })),
    countries: countriesOf(places).size,
    countryTotal: COUNTRY_TOTAL,
    territories: places.filter((c) => !isCountry(c)).length,
    continents: CONTINENTS.filter((continent) => places.some((c) => c.properties.continent === continent)).length,
    cities,
    share: worldShareOf(places),
    flights: flown.length,
    km,
    laps: km / EARTH_CIRCUMFERENCE_KM,
    routes: uniqueRoutes(flown).map(({ from, to }) => ({ from, to })),
    trips,
    since: years.length ? Math.min(...years) : null,
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "Home to 17% of the world's people, on 8% of its land" */
export const shareLine = ({ people, land }: AtlasPoster['share']) =>
  `Home to ${percentLabel(people, 1)} of the world's people, on ${percentLabel(land, 1)} of its land`

/** The poster in words, for screen readers and the share text: "Your atlas: 41 of 197 countries, 1 territory…" */
export function describeAtlasPoster(poster: AtlasPoster) {
  const parts = [
    `${poster.countries} of ${poster.countryTotal} countries`,
    poster.territories > 0 ? plural(poster.territories, 'territory', 'territories') : null,
    `on ${plural(poster.continents, 'continent')}`,
    poster.cities > 0 ? plural(poster.cities, 'city', 'cities') : null,
  ]
  const lines = [`Your atlas: ${parts.filter(Boolean).join(', ')}.`]
  if (poster.places.length) lines.push(`${shareLine(poster.share)}.`)
  if (poster.flights) lines.push(`${plural(poster.flights, 'flight')}, ${Math.round(poster.km).toLocaleString('en-US')} km.`)
  return lines.join(' ')
}
