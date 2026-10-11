import { useState } from 'react'
import { countries } from '../countries'
import { countdown } from '../data/plans'
import { countriesOfTrip, titleOf, type TripView } from '../data/savedTrips'
import { formatVisitDate, type VisitDate } from '../data/visitDates'
import { PencilIcon } from '../icons'
import Card from '../ui/Card'
import { noAutofill } from '../ui/noAutofill'
import { NOTE_MAX_LENGTH } from './useVisitDates'
import { Flag } from './VisitedPanel'

/** A visit to the place, in a trip: when (null for unknown), and whether it's still to come */
export type CountryVisit = { date: VisitDate | null; trip: TripView; toCome: boolean }

type Props = {
  /** Newest first, those to come first of all */
  visits: CountryVisit[]
  /** The note on a visit, if it has one */
  noteOf: (date: VisitDate) => string | undefined
  /** Writes a visit's note; an empty one removes it */
  onNote: (date: VisitDate, note: string) => void
  /** Opens a trip in the Trips list */
  onOpenTrip: (id: string) => void
}

const placeNamed = new Map(countries.map((c) => [c.properties.name, c]))

/**
 * A place's visits, each in the trip it was part of, to open there: visits
 * are made in trips. Each can have a note.
 */
export default function CountryVisits({ visits, noteOf, onNote, onOpenTrip }: Props) {
  /** The visit whose note is being written */
  const [writing, setWriting] = useState<VisitDate | null>(null)
  return (
    <Card label="Visits" meta={String(visits.length).padStart(2, '0')} className="visits-card">
      {visits.length === 0 ? (
        <p className="muted">
          No visits in a trip yet. In Visited › Trips, add this place to a trip, with when you went.
        </p>
      ) : (
        <ul className="city-list visit-list" aria-label="Visits">
          {visits.map(({ date, trip, toCome }) => {
            const when = date ? formatVisitDate(date) : 'No date'
            const note = date ? noteOf(date) : undefined
            const title = titleOf(trip)
            const flags = trip.trip.name.trim() ? [] : countriesOfTrip(trip).flatMap((place) => placeNamed.get(place) ?? [])
            return (
              <li key={`${trip.trip.id}-${date}`} className={`${toCome ? 'to-come' : ''}${writing === date ? ' writing' : ''}`}>
                <span className="dot" aria-hidden="true" />
                <span className="visit-text">
                  <span className="city-name">
                    {when}
                    {toCome && date && <span className="row-meta"> · {countdown(date)}</span>}
                  </span>
                  <button
                    type="button"
                    className="link-button visit-trip"
                    onClick={() => onOpenTrip(trip.trip.id)}
                    aria-label={`Open the trip ${title}`}
                  >
                    {flags.length > 0 ? flags.map((country) => <Flag key={country.properties.name} country={country} named />) : title}
                  </button>
                  {note && writing !== date && <span className="visit-note">{note}</span>}
                </span>
                {date && (
                  <button
                    type="button"
                    className="remove-button note-button"
                    aria-expanded={writing === date}
                    onClick={() => setWriting(writing === date ? null : date)}
                    aria-label={note ? `Change the note on the visit in ${when}` : `Add a note to the visit in ${when}`}
                  >
                    <PencilIcon size={14} />
                  </button>
                )}
                {date && writing === date && (
                  <form
                    className="note-editor"
                    onSubmit={(e) => {
                      e.preventDefault()
                      setWriting(null)
                    }}
                  >
                    <input
                      {...noAutofill('note')}
                      type="text"
                      aria-label={`Note on the visit in ${when}`}
                      placeholder="Who with, what you did…"
                      maxLength={NOTE_MAX_LENGTH}
                      value={note ?? ''}
                      onChange={(e) => onNote(date, e.target.value)}
                      // Opened by pressing the note button, to write in straight away
                      autoFocus
                    />
                    <button type="submit" className="link-button">
                      Done
                    </button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
