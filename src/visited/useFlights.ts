import { useCallback, useEffect, useMemo } from 'react'
import type { Airport } from '../data/airports'
import type { City } from '../data/cities'
import { isAirportFlight, migrateFlights, type StoredFlight } from '../data/flights'
import { isVisitDate, type VisitDate } from '../data/visitDates'
import { usePersistentState } from '../storage'

export const FLIGHTS_KEY = 'countries-app.flights'

const isEnd = (end: unknown) => typeof end === 'string' || typeof end === 'number'
export const isFlightList = (value: unknown): value is StoredFlight[] =>
  Array.isArray(value) &&
  value.every(
    (f) =>
      typeof f === 'object' &&
      f !== null &&
      typeof f.id === 'string' &&
      isEnd(f.from) &&
      isEnd(f.to) &&
      (f.date === undefined || isVisitDate(f.date)),
  )

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/**
 * Flights you've taken, between airports, in the order added, saved in this
 * browser. Flights saved between cities move to their airports once the
 * cities and airports have loaded.
 */
export function useFlights(cities: readonly City[] | null, airports: readonly Airport[] | null) {
  const [stored, setStored] = usePersistentState<StoredFlight[]>(FLIGHTS_KEY, [], isFlightList)
  const flights = useMemo(() => stored.filter(isAirportFlight), [stored])

  useEffect(() => {
    if (!cities || !airports || stored.every(isAirportFlight)) return
    setStored(migrateFlights(stored, new Map(cities.map((c) => [c.id, c])), airports))
  }, [cities, airports, stored, setStored])

  /** Adds a flight; gives its id, or null for one that goes nowhere */
  const add = useCallback(
    (from: string, to: string, date: VisitDate | null = null) => {
      if (from === to) return null
      const id = newId()
      setStored((prev) => [...prev, { id, from, to, ...(date ? { date } : {}) }])
      return id
    },
    [setStored],
  )
  /** Removes a flight; gives back how to put it back where it was in the order, which trips are told apart by */
  const remove = useCallback(
    (id: string) => {
      const index = stored.findIndex((f) => f.id === id)
      const flight = stored[index]
      setStored((prev) => prev.filter((f) => f.id !== id))
      return () => {
        if (flight) setStored((prev) => (prev.some((f) => f.id === id) ? prev : [...prev.slice(0, index), flight, ...prev.slice(index)]))
      }
    },
    [stored, setStored],
  )
  /** When a flight was, or null for no date */
  const setDate = useCallback(
    (id: string, date: VisitDate | null) =>
      setStored((prev) =>
        prev.map((flight) => {
          if (flight.id !== id) return flight
          const undated = { id: flight.id, from: flight.from, to: flight.to }
          return date ? { ...undated, date } : undated
        }),
      ),
    [setStored],
  )
  return { flights, add, remove, setDate }
}
