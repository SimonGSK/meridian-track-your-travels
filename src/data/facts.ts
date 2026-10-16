import { countries, type CountryFeature } from '../countries'
import rawFacts from './country-facts.json'
import { sharesCode } from './names'

/**
 * Capital, population and area, from the World Bank's open data (CC BY 4.0)
 * via `npm run data:facts`, with places it doesn't cover filled in from
 * country-facts-extra.json and marked as estimates.
 */
export type CountryFacts = {
  capital: string | null
  population: number | null
  populationYear?: number | null
  areaKm2?: number | null
  source: 'World Bank' | 'Estimate'
  /** e.g. "Includes Somaliland, …" or "No permanent population" */
  note?: string
}

const facts = rawFacts as Record<string, CountryFacts>

/** A place's key in the data files: its ISO alpha-2 code, or its map name if it has no code of its own */
export function placeKey(country: CountryFeature) {
  const { isoAlpha2, mapName } = country.properties
  return isoAlpha2 && !sharesCode(mapName) ? isoAlpha2 : mapName
}

export function factsOf(country: CountryFeature): CountryFacts | null {
  return facts[placeKey(country)] ?? null
}

/**
 * A place's people, and its land: as big as it is on the map, which measures
 * every place alike, where the World Bank counts only Greenland's land free
 * of ice, a fifth of it
 */
const sizeOf = (place: CountryFeature) => ({ people: factsOf(place)?.population ?? 0, land: place.properties.areaKm2 })

/** Everyone, and all the land, in every place on the map, Antarctica too */
const WORLD = countries.map(sizeOf).reduce((world, size) => ({ people: world.people + size.people, land: world.land + size.land }))

/**
 * The share of the world's people who live in these places, and of its land
 * they cover, from 0 to 1. Each place counts for itself: Greenland's people
 * and land are Greenland's, not Denmark's.
 */
export function worldShareOf(places: Iterable<CountryFeature>) {
  let [people, land] = [0, 0]
  for (const place of new Set(places)) {
    const size = sizeOf(place)
    people += size.people
    land += size.land
  }
  return { people: people / WORLD.people, land: land / WORLD.land }
}

const whole = new Intl.NumberFormat('en-US')
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })
const twoDecimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** "1.45 billion", "5.98 million", "103,267" */
export function formatPopulation(population: number) {
  if (population >= 1e9) return `${twoDecimals.format(population / 1e9)} billion`
  if (population >= 1e6) return `${twoDecimals.format(population / 1e6)} million`
  return whole.format(population)
}

/** "42,920 km²", "2.5 km²", "0.49 km²" */
export function formatArea(km2: number) {
  const format = km2 < 1 ? twoDecimals : km2 < 10 ? oneDecimal : whole
  return `${format.format(km2)} km²`
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 3 })

/** "45.7M", "1.45B", "103K", "764" */
export const formatPopulationShort = (population: number) => compact.format(population)

/** "2.78M km²" for the biggest countries, else as formatArea */
export const formatAreaShort = (km2: number) => (km2 >= 1e6 ? `${compact.format(km2)} km²` : formatArea(km2))
