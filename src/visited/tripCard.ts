import { geoDistance } from 'd3-geo'
import { countries } from '../countries'
import { cityOf } from '../data/airports'
import { EARTH_CIRCUMFERENCE_KM } from '../data/flights'
import { countdown, isToCome } from '../data/plans'
import { countriesOf } from '../data/sovereigns'
import { titleOf, whenOf, type TripView } from '../data/savedTrips'
import type { VisitDate } from '../data/visitDates'
import { viewOf } from '../globe/interaction'
import type { CardPlace } from './cardDrawing'

/**
 * A trip, as a card to keep or share: what goes on it, from the trip. Its
 * places in the order it went to them, each once, those first visited on it
 * new; its flights, to draw on its globe; and where the globe looks from.
 */
export type TripCard = {
  /** Its name, or where it went: "Japan & South Korea" */
  title: string
  /** When: "Apr 2024", "Apr – May 2024"; none for a trip without a date */
  when: string | null
  /** For a trip to come, how long until: "in 5 months" */
  toCome: string | null
  places: CardPlace[]
  /** The countries been to, Greenland counting as Denmark */
  countries: number
  /** Places first visited on it, territories too: those in green */
  newPlaces: number
  flights: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }[]
  km: number
  /** Times around the Earth */
  laps: number
  longest: { from: string; to: string; km: number } | null
  /** Where its globe looks from, and how far out it reaches, in degrees */
  view: { lat: number; lng: number }
  reach: number
}

const placeNamed = new Map(countries.map((c) => [c.properties.name, c]))
const DEGREES = 180 / Math.PI

/** "Japan", "Japan & South Korea", "Japan, South Korea & China", "Japan, South Korea & 3 more" */
export function placesTitle(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= 3) return `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`
  return `${names.slice(0, 2).join(', ')} & ${names.length - 2} more`
}

/**
 * A trip's card. `firstVisitOf` is when a place was first been to, of all
 * your visits: a place is new on the trip if that's on it.
 */
export function tripCardOf(view: TripView, firstVisitOf: (place: string) => VisitDate | null, now = new Date()): TripCard {
  const visits = view.items.flatMap((item) => (item.kind === 'visit' ? [item] : []))
  const seen = new Set<string>()
  const places = visits.flatMap(({ place }) => {
    const country = placeNamed.get(place)
    if (!country || seen.has(place)) return []
    seen.add(place)
    // New on this trip: its first visit of all is one of this trip's
    const first = firstVisitOf(place)
    const isNew = !!first && visits.some((visit) => visit.place === place && visit.date === first)
    return [{ country, isNew }]
  })
  const longest = view.routes.reduce<(typeof view.routes)[number] | null>((best, route) => (!best || route.km > best.km ? route : best), null)
  const spots = [
    ...places.map(({ country }) => ({ lng: country.properties.centroid[0], lat: country.properties.centroid[1], radius: country.properties.extent / 2 })),
    ...view.routes.flatMap(({ from, to }) => [from, to]),
  ]
  const center = spots.length ? viewOf(spots) : { lat: 20, lng: 10 }
  const reach = spots.length
    ? Math.max(...spots.map((spot) => geoDistance([center.lng, center.lat], [spot.lng, spot.lat]) * DEGREES + ('radius' in spot ? spot.radius : 0)))
    : 90
  const named = view.trip.name.trim()
  return {
    title: named || placesTitle(places.map(({ country }) => country.properties.name)) || titleOf(view),
    when: whenOf(view.date, view.endDate),
    toCome: view.date && isToCome(view.date, now) ? countdown(view.date, now) : null,
    places,
    countries: countriesOf(places.map(({ country }) => country)).size,
    newPlaces: places.filter((place) => place.isNew).length,
    flights: view.routes.map(({ from, to }) => ({ from, to })),
    km: view.km,
    laps: view.km / EARTH_CIRCUMFERENCE_KM,
    longest: longest && { from: cityOf(longest.from), to: cityOf(longest.to), km: longest.km },
    view: { lat: center.lat, lng: center.lng },
    reach,
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The card in words, for screen readers and the share text: "Japan & South Korea, Apr 2024: 2 countries, 2 new places…" */
export function describeTripCard(card: TripCard) {
  const fresh = card.newPlaces > 0 ? `, ${plural(card.newPlaces, 'new place')}` : ''
  const lines = [`${card.title}${card.when ? `, ${card.when}` : ''}: ${plural(card.countries, 'country', 'countries')}${fresh}.`]
  if (card.flights.length) lines.push(`${plural(card.flights.length, 'flight')}, ${Math.round(card.km).toLocaleString('en-US')} km.`)
  return lines.join(' ')
}
