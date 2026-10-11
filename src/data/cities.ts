import { countries, type CountryFeature } from '../countries'
import { placeKey } from './facts'
import { normalizeName } from './names'

/**
 * The big and well-known cities of each place, from GeoNames (CC BY 4.0),
 * picked by scripts/extract-cities.mjs (`npm run data:cities`).
 */
export type City = {
  /** GeoNames id */
  id: number
  name: string
  /** The place it's in on the map: an ISO alpha-2 code, or a map name (see placeKey) */
  place: string
  lat: number
  lng: number
  population: number
  capital?: true
  /**
   * The state or province it's in ("US-NY"), in countries that have them on
   * the map: from GeoNames, as a city on a coast or a border can fall just
   * outside its state's simplified outline
   */
  region?: string
  /**
   * How far it reaches from its point, in km: the radius of a circle as big
   * as its built-up land, from Natural Earth's urban areas, by
   * scripts/measure-cities.mjs; none for a city not in built-up land
   */
  radiusKm?: number
}

/** The cities, loaded on demand like the region shapes */
export const loadCities = () => import('./cities.json').then((m) => m.default as City[])

/** A country's cities: the capital first, then the biggest */
export const citiesOf = (cities: readonly City[], country: CountryFeature) => {
  const key = placeKey(country)
  return cities
    .filter((c) => c.place === key)
    .sort((a, b) => Number(!!b.capital) - Number(!!a.capital) || b.population - a.population)
}

let countryByKey: Map<string, CountryFeature> | null = null

/** The country a city is in */
export function countryOfCity(city: City): CountryFeature | null {
  countryByKey ??= new Map(countries.map((c) => [placeKey(c), c]))
  return countryByKey.get(city.place) ?? null
}

/** "1 city", "4 cities" */
export const citiesLabel = (count: number) => `${count} ${count === 1 ? 'city' : 'cities'}`

/** The cities whose name, or a word of it, starts with what's typed: those starting with it first, then the biggest */
export function findCities(cities: readonly City[], query: string, limit = 6) {
  const wanted = normalizeName(query)
  if (!wanted) return []
  return cities
    .map((city) => {
      const name = normalizeName(city.name)
      const rank = name.startsWith(wanted) ? 0 : name.split(/[\s(-]+/).some((word) => word.startsWith(wanted)) ? 1 : -1
      return { city, rank }
    })
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || b.city.population - a.city.population)
    .slice(0, limit)
    .map(({ city }) => city)
}
