import { countryOf } from './airports'
import type { Route } from './flights'
import { tripsOf } from './trips'
import { isVisitDate, newestFirst, partsOf, type VisitDate } from './visitDates'

/**
 * Trips as you make them: your visits and flights, in the order you went,
 * with a name. A visit is a place and when you went there (a month or a
 * year), or no date for a place you've been to, when unknown. Each visit and
 * each flight is in one trip at most. The dates and flights themselves stay
 * where they're kept (useVisitDates, useFlights): a trip says which, in what
 * order.
 */
export type TripItem = { kind: 'visit'; place: string; date: VisitDate | null } | { kind: 'flight'; flight: string }

export type SavedTrip = {
  id: string
  /** What you call it, or empty for none yet */
  name: string
  note?: string
  items: TripItem[]
}

/** A visit to a place: when, or null for a place been to, when unknown */
export type Visit = { place: string; date: VisitDate | null }

export const isTripItem = (value: unknown): value is TripItem => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  if (item.kind === 'flight') return typeof item.flight === 'string'
  return item.kind === 'visit' && typeof item.place === 'string' && (item.date === null || isVisitDate(item.date))
}

export const isSavedTrip = (value: unknown): value is SavedTrip => {
  if (typeof value !== 'object' || value === null) return false
  const trip = value as Record<string, unknown>
  return (
    typeof trip.id === 'string' &&
    typeof trip.name === 'string' &&
    (trip.note === undefined || typeof trip.note === 'string') &&
    Array.isArray(trip.items) &&
    trip.items.every(isTripItem)
  )
}

export const isSavedTrips = (value: unknown): value is SavedTrip[] => Array.isArray(value) && value.every(isSavedTrip)

/** The same visit or flight wherever it is: "visit:Japan|2024-04", "visit:Denmark|", "flight:3f2a…" */
export const itemKey = (item: TripItem) =>
  item.kind === 'visit' ? `visit:${item.place}|${item.date ?? ''}` : `flight:${item.flight}`

export const visitItem = ({ place, date }: Visit): TripItem => ({ kind: 'visit', place, date })

/** Every visit: each date of each place visited, newest first, and a place visited without a date once, with none */
export function visitsOf(visited: Iterable<string>, datesOf: (name: string) => readonly VisitDate[]): Visit[] {
  return [...visited].flatMap((place): Visit[] => {
    const dates = datesOf(place)
    return dates.length ? dates.map((date) => ({ place, date })) : [{ place, date: null }]
  })
}

/** Newest first, those without a date last, by name */
export const byWhen = (a: Visit, b: Visit) =>
  (a.date && b.date ? newestFirst(a.date, b.date) : a.date ? -1 : b.date ? 1 : 0) || a.place.localeCompare(b.place)

/** A trip as it stands: its visits and flights still there, in order, with its flights' routes and when it was */
export type TripView = {
  trip: SavedTrip
  items: TripItem[]
  /** Its flights, in its order */
  routes: Route[]
  /** Its earliest and latest dates, of a visit or a flight, or null with none */
  date: VisitDate | null
  endDate: VisitDate | null
  km: number
}

/**
 * The trips as they stand, newest first: what's no longer there left out
 * (a place taken off the atlas, a visit's date removed, a flight removed),
 * and each visit and flight in the first trip it's in only. Trips without
 * a date come last, the newest made first.
 */
export function tripViewsOf(trips: readonly SavedTrip[], visits: readonly Visit[], routes: readonly Route[]): TripView[] {
  const there = new Set(visits.map((visit) => itemKey(visitItem(visit))))
  const routeOf = new Map(routes.map((route) => [route.flight.id, route]))
  const placed = new Set<string>()
  const views = trips.map((trip, made) => {
    const items = trip.items.filter((item) => {
      const key = itemKey(item)
      const live = item.kind === 'visit' ? there.has(key) : routeOf.has(item.flight)
      if (!live || placed.has(key)) return false
      placed.add(key)
      return true
    })
    const tripRoutes = items.flatMap((item) => (item.kind === 'flight' ? [routeOf.get(item.flight)!] : []))
    const dates = items
      .flatMap((item) => (item.kind === 'visit' ? (item.date ?? []) : (routeOf.get(item.flight)!.flight.date ?? [])))
      .sort()
    return {
      view: {
        trip,
        items,
        routes: tripRoutes,
        date: dates[0] ?? null,
        endDate: dates.at(-1) ?? null,
        km: tripRoutes.reduce((sum, route) => sum + route.km, 0),
      },
      made,
    }
  })
  const dated = views
    .filter(({ view }) => view.date)
    .sort((a, b) => newestFirst(a.view.date!, b.view.date!) || newestFirst(a.view.endDate!, b.view.endDate!) || b.made - a.made)
  return [...dated, ...views.filter(({ view }) => !view.date).reverse()].map(({ view }) => view)
}

/** What no trip has yet: visits newest first (those without a date last), and flights in the order added */
export function looseOf(views: readonly TripView[], visits: readonly Visit[], routes: readonly Route[]) {
  const inTrips = new Set(views.flatMap((view) => view.items.map(itemKey)))
  return {
    visits: visits.filter((visit) => !inTrips.has(itemKey(visitItem(visit)))).sort(byWhen),
    flights: routes.filter((route) => !inTrips.has(itemKey({ kind: 'flight', flight: route.flight.id }))),
  }
}

/** The places a trip went to, in order, each once: "Japan", "South Korea" */
export const placesOf = (items: readonly TripItem[]) => [
  ...new Set(items.flatMap((item) => (item.kind === 'visit' ? [item.place] : []))),
]

/**
 * The countries a trip went to, for its flags: its places, or for one of
 * only flights, the countries they landed in, home left out
 */
export function countriesOfTrip({ items, routes }: Pick<TripView, 'items' | 'routes'>): string[] {
  const places = placesOf(items)
  if (places.length || !routes.length) return places
  const home = countryOf(routes[0].from)
  return [...new Set(routes.map((route) => countryOf(route.to)).filter((place) => place !== home))]
}

/** What a trip is called, in words: its name, or else where it went */
export function titleOf(view: Pick<TripView, 'trip' | 'items' | 'routes'>) {
  if (view.trip.name.trim()) return view.trip.name
  return countriesOfTrip(view).join(' → ') || 'Unnamed trip'
}

/**
 * Where something new goes in a trip, so it lands between what it fits:
 * a flight after the last place or flight it leaves from (the same
 * country), or else before the first place it lands in; a place after the
 * last flight that lands there, or else before the first that leaves from
 * it; anything else at the end.
 */
export function placeFor(item: TripItem, items: readonly TripItem[], routes: readonly Route[]): number {
  const routeOf = new Map(routes.map((route) => [route.flight.id, route]))
  const ends = (other: TripItem) => {
    const route = other.kind === 'flight' ? routeOf.get(other.flight) : undefined
    return route ? { from: countryOf(route.from), to: countryOf(route.to) } : null
  }
  const after = (fits: (other: TripItem) => boolean) => items.findLastIndex(fits)
  const before = (fits: (other: TripItem) => boolean) => items.findIndex(fits)
  let at = -1
  if (item.kind === 'flight') {
    const route = routeOf.get(item.flight)
    if (!route) return items.length
    const [from, to] = [countryOf(route.from), countryOf(route.to)]
    at = after((other) => (other.kind === 'visit' ? other.place === from : ends(other)?.to === from)) + 1
    if (at === 0) at = before((other) => other.kind === 'visit' && other.place === to)
  } else {
    at = after((other) => ends(other)?.to === item.place) + 1
    if (at === 0) at = before((other) => ends(other)?.from === item.place)
  }
  return at === -1 ? items.length : at
}

/** Within a month of each other, or the same year when one has only the year */
function closeInTime(a: VisitDate, b: VisitDate) {
  const [x, y] = [partsOf(a), partsOf(b)]
  if (x.month === null || y.month === null) return x.year === y.year
  return Math.abs(x.year * 12 + x.month - (y.year * 12 + y.month)) <= 1
}

/**
 * Trips made from flights, for those who had flights before trips could be
 * made: the trips worked out from them (see tripsOf), each with the places
 * landed in as stops, where you've a visit then (or one without a date), and
 * the name it had.
 */
export function tripsFromFlights(
  routes: readonly Route[],
  visits: readonly Visit[],
  nameOf: (legs: readonly string[]) => { name: string; note?: string } | null,
  newId: () => string,
): SavedTrip[] {
  const used = new Set<string>()
  const visitFor = (place: string, date: VisitDate | undefined) => {
    const free = visits.filter((visit) => visit.place === place && !used.has(itemKey(visitItem(visit))))
    return (date && free.find((visit) => visit.date && closeInTime(visit.date, date))) || free.find((visit) => !visit.date) || null
  }
  return tripsOf(routes).map(({ routes: legs }) => {
    const home = countryOf(legs[0].from)
    const items: TripItem[] = []
    for (const route of legs) {
      items.push({ kind: 'flight', flight: route.flight.id })
      const there = countryOf(route.to)
      if (there === home || items.some((item) => item.kind === 'visit' && item.place === there)) continue
      const visit = visitFor(there, route.flight.date)
      if (!visit) continue
      used.add(itemKey(visitItem(visit)))
      items.push(visitItem(visit))
    }
    const named = nameOf(legs.map((route) => route.flight.id))
    return { id: newId(), name: named?.name ?? '', ...(named?.note ? { note: named.note } : {}), items }
  })
}

/**
 * Your flights as they were flown, for the planes on the globe: each trip's
 * flights in its order, then the flights in no trip, grouped as worked out
 * from where they go (see tripsOf)
 */
export function journeysOf(routes: readonly Route[], trips: readonly SavedTrip[]): Route[][] {
  const routeOf = new Map(routes.map((route) => [route.flight.id, route]))
  const taken = new Set<string>()
  const inTrips = trips.map((trip) =>
    trip.items.flatMap((item) => {
      if (item.kind !== 'flight' || taken.has(item.flight) || !routeOf.has(item.flight)) return []
      taken.add(item.flight)
      return [routeOf.get(item.flight)!]
    }),
  )
  const loose = routes.filter((route) => !taken.has(route.flight.id))
  return [...inTrips.filter((legs) => legs.length > 0), ...tripsOf(loose).map((trip) => trip.routes)]
}
