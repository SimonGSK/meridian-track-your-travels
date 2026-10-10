import { useCallback } from 'react'
import { isSavedTrips, itemKey, type SavedTrip, type TripItem } from '../data/savedTrips'
import type { VisitDate } from '../data/visitDates'
import { usePersistentState } from '../storage'
import { TRIP_NAME_MAX, TRIP_NOTE_MAX, type TripName } from './useTripNames'

export const TRIPS_KEY = 'countries-app.trips'

/** Trips saved, or null before any were made: then they're made from the flights there are (see tripsFromFlights) */
export const isSavedTripsOrNone = (value: unknown): value is SavedTrip[] | null => value === null || isSavedTrips(value)

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

const without = (items: readonly TripItem[], key: string) => items.filter((item) => itemKey(item) !== key)

/**
 * The trips you've made, saved in this browser: each a name, and your
 * visits and flights in the order you went. A visit or flight goes in one
 * trip at a time, so putting it in one takes it out of any other.
 */
export function useTrips() {
  const [trips, setTrips] = usePersistentState<SavedTrip[] | null>(TRIPS_KEY, null, isSavedTripsOrNone)
  const change = useCallback(
    (update: (trips: SavedTrip[]) => SavedTrip[]) => setTrips((prev) => update(prev ?? [])),
    [setTrips],
  )

  /** A new trip, with what's to go in it already; gives its id */
  const create = useCallback(
    (name: string, items: readonly TripItem[] = []) => {
      const id = newId()
      const keys = new Set(items.map(itemKey))
      change((prev) => [
        ...prev.map((trip) => ({ ...trip, items: trip.items.filter((item) => !keys.has(itemKey(item))) })),
        { id, name: name.slice(0, TRIP_NAME_MAX), items: [...items] },
      ])
      return id
    },
    [change],
  )

  /** Names a trip and notes it; an empty note is none */
  const rename = useCallback(
    (id: string, { name, note = '' }: TripName) =>
      change((prev) =>
        prev.map((trip) => {
          if (trip.id !== id) return trip
          const { note: _, ...rest } = trip
          const kept = note.slice(0, TRIP_NOTE_MAX)
          return { ...rest, name: name.slice(0, TRIP_NAME_MAX), ...(kept.trim() ? { note: kept } : {}) }
        }),
      ),
    [change],
  )

  /** Undoes a trip: what was in it is in none. Gives how to put it back */
  const remove = useCallback(
    (id: string) => {
      const index = (trips ?? []).findIndex((trip) => trip.id === id)
      const removed = (trips ?? [])[index]
      change((prev) => prev.filter((trip) => trip.id !== id))
      return () => {
        if (removed) change((prev) => (prev.some((trip) => trip.id === id) ? prev : [...prev.slice(0, index), removed, ...prev.slice(index)]))
      }
    },
    [trips, change],
  )

  /** Puts a visit or flight in a trip, at `index` (the end without one), taking it out of any other */
  const add = useCallback(
    (id: string, item: TripItem, index?: number) => {
      const key = itemKey(item)
      change((prev) =>
        prev.map((trip) => {
          const items = without(trip.items, key)
          if (trip.id !== id) return items.length === trip.items.length ? trip : { ...trip, items }
          const at = Math.min(index ?? items.length, items.length)
          return { ...trip, items: [...items.slice(0, at), item, ...items.slice(at)] }
        }),
      )
    },
    [change],
  )

  /** Takes a visit or flight out of its trip, by its key (itemKey) */
  const takeOut = useCallback(
    (key: string) =>
      change((prev) =>
        prev.map((trip) => (trip.items.some((item) => itemKey(item) === key) ? { ...trip, items: without(trip.items, key) } : trip)),
      ),
    [change],
  )

  /** Moves what's at one place in a trip to another, of those `shown` (the items still there, in order) */
  const move = useCallback(
    (id: string, shown: readonly TripItem[], from: number, to: number) => {
      if (from === to || !shown[from] || !shown[to]) return
      const order = [...shown]
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      change((prev) => prev.map((trip) => (trip.id === id ? { ...trip, items: order } : trip)))
    },
    [change],
  )

  /** A visit's date changed (or a place's first date added, or its last removed): its trip keeps it */
  const redate = useCallback(
    (place: string, from: VisitDate | null, to: VisitDate | null) => {
      const before = itemKey({ kind: 'visit', place, date: from })
      const after = itemKey({ kind: 'visit', place, date: to })
      change((prev) =>
        prev.map((trip) => {
          if (!trip.items.some((item) => itemKey(item) === before)) return trip
          // Where it was; the visit it becomes, if that was somewhere else already, isn't there too
          const items = trip.items.filter((item) => itemKey(item) !== after)
          return { ...trip, items: items.map((item) => (itemKey(item) === before ? { kind: 'visit' as const, place, date: to } : item)) }
        }),
      )
    },
    [change],
  )

  /** The trips made from the flights there were, the first time */
  const start = useCallback((made: SavedTrip[]) => setTrips((prev) => prev ?? made), [setTrips])

  return { trips, create, rename, remove, add, takeOut, move, redate, start }
}
