import { geoDistance } from 'd3-geo'
import { nearestAirport, type Airport } from './airports'
import type { City } from './cities'
import type { VisitDate } from './visitDates'

/** A flight you've taken, between two airports (IATA codes), and when, if you said */
export type Flight = { id: string; from: string; to: string; date?: VisitDate }

/** As saved: the first flights went between cities (GeoNames ids), before there were airports */
export type StoredFlight = { id: string; from: string | number; to: string | number; date?: VisitDate }

/** The Earth's mean radius */
export const EARTH_KM = 6371
/** Once around the Earth at the equator */
export const EARTH_CIRCUMFERENCE_KM = 40_075

type Place = { lat: number; lng: number }

/** Great-circle distance, as the plane flies */
export const distanceKm = (from: Place, to: Place) => geoDistance([from.lng, from.lat], [to.lng, to.lat]) * EARTH_KM

/** A flight with its airports looked up, or null if one isn't in the list any more */
export function routeOf(flight: Flight, airportByCode: ReadonlyMap<string, Airport>) {
  const from = airportByCode.get(flight.from)
  const to = airportByCode.get(flight.to)
  return from && to ? { flight, from, to, km: distanceKm(from, to) } : null
}

export type Route = NonNullable<ReturnType<typeof routeOf>>

/** How many flights, how far in all, and how many times around the Earth that is */
export function flightStats(routes: readonly Route[]) {
  const km = routes.reduce((sum, route) => sum + route.km, 0)
  return { flights: routes.length, km, aroundEarth: km / EARTH_CIRCUMFERENCE_KM }
}

/** One arc per pair of airports, whichever way and however often it was flown */
export function uniqueRoutes(routes: readonly Route[]) {
  const seen = new Map<string, Route>()
  for (const route of routes) {
    const key = [route.from.code, route.to.code].sort().join('-')
    if (!seen.has(key)) seen.set(key, route)
  }
  return [...seen.values()]
}

export const isAirportFlight = (flight: StoredFlight): flight is Flight =>
  typeof flight.from === 'string' && typeof flight.to === 'string'

/**
 * Flights saved between cities, moved to the airports serving them (the
 * nearest big one); a flight whose city has no airport is dropped.
 */
export function migrateFlights(
  stored: readonly StoredFlight[],
  cityById: ReadonlyMap<number, City>,
  airports: readonly Airport[],
): Flight[] {
  const airportOf = (end: string | number) => {
    if (typeof end === 'string') return end
    const city = cityById.get(end)
    return city ? (nearestAirport(airports, city)?.code ?? null) : null
  }
  return stored.flatMap((flight) => {
    const [from, to] = [airportOf(flight.from), airportOf(flight.to)]
    return from && to && from !== to ? [{ ...flight, from, to }] : []
  })
}

const whole = new Intl.NumberFormat('en-US')
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumSignificantDigits: 3 })

/** "8,620 km", or "84.3K km" from 10,000 km */
export const formatDistance = (km: number) => `${km < 10_000 ? whole.format(Math.round(km)) : compact.format(km)} km`
