import { useCallback } from 'react'
import { isVisitDate, newestFirst, type VisitDate } from '../data/visitDates'
import { usePersistentState } from '../storage'

export const VISIT_DATES_KEY = 'countries-app.visit-dates'
/** A few words about each visit, apart from the dates so those stay as they were saved */
export const VISIT_NOTES_KEY = 'countries-app.visit-notes'

/** The longest note: a line or two */
export const NOTE_MAX_LENGTH = 200

type VisitDates = Record<string, VisitDate[]>

export const isVisitDates = (value: unknown): value is VisitDates =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((dates) => Array.isArray(dates) && dates.every(isVisitDate))

type VisitNotes = Record<string, Record<VisitDate, string>>

export const isVisitNotes = (value: unknown): value is VisitNotes =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(
    (notes) =>
      typeof notes === 'object' &&
      notes !== null &&
      !Array.isArray(notes) &&
      Object.entries(notes).every(([date, note]) => isVisitDate(date) && typeof note === 'string'),
  )

/** Without the visit's note, and without the country once it has none */
function withoutNote(notes: VisitNotes, name: string, date: VisitDate): VisitNotes {
  const { [name]: ofCountry = {}, ...others } = notes
  const { [date]: _, ...left } = ofCountry
  return Object.keys(left).length ? { ...others, [name]: left } : others
}

const NONE: readonly VisitDate[] = []

/**
 * When you went to each country, by name: several visits, each a month or
 * a year, each with a note if you like, saved in this browser. Visits are
 * made in trips now, so the dates saved here are from before: they become
 * trips (see tripsOfVisits) and are let go, and the notes stay.
 */
export function useVisitDates() {
  const [saved, setSaved] = usePersistentState<VisitDates>(VISIT_DATES_KEY, {}, isVisitDates)
  const [notes, setNotes] = usePersistentState<VisitNotes>(VISIT_NOTES_KEY, {}, isVisitNotes)

  /** Newest first */
  const datesOf = useCallback(
    (name: string): readonly VisitDate[] => (saved[name] ? [...saved[name]].sort(newestFirst) : NONE),
    [saved],
  )
  const addVisit = useCallback(
    (name: string, date: VisitDate) =>
      setSaved((prev) => (prev[name]?.includes(date) ? prev : { ...prev, [name]: [...(prev[name] ?? []), date] })),
    [setSaved],
  )
  const removeVisit = useCallback(
    (name: string, date: VisitDate) => {
      setSaved((prev) => {
        const { [name]: dates = [], ...rest } = prev
        const left = dates.filter((d) => d !== date)
        return left.length ? { ...rest, [name]: left } : rest
      })
      // Its note goes with it
      setNotes((prev) => (prev[name]?.[date] === undefined ? prev : withoutNote(prev, name, date)))
    },
    [setSaved, setNotes],
  )

  /** The note on a visit, if it has one */
  const noteOf = useCallback((name: string, date: VisitDate): string | undefined => notes[name]?.[date], [notes])
  /** Writes a visit's note; an empty one removes it */
  const setNote = useCallback(
    (name: string, date: VisitDate, note: string) => {
      const text = note.slice(0, NOTE_MAX_LENGTH)
      setNotes((prev) =>
        text.trim() ? { ...prev, [name]: { ...prev[name], [date]: text } } : withoutNote(prev, name, date),
      )
    },
    [setNotes],
  )
  /** Lets the dates go, once they're in trips; the notes stay */
  const clearDates = useCallback(() => setSaved({}), [setSaved])
  return { datesOf, addVisit, removeVisit, noteOf, setNote, clearDates }
}
