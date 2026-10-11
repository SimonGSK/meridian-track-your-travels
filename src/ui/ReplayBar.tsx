import { formatVisitDate } from '../data/visitDates'
import { titleOf, type TripView } from '../data/savedTrips'

type Props = {
  /** The trip being replayed, or null before the first */
  trip: TripView | null
  index: number
  count: number
  onStop: () => void
}

/** At the bottom while your trips are replayed: which trip of how many, when, and a way to stop */
export default function ReplayBar({ trip, index, count, onStop }: Props) {
  return (
    <div className="follow-bar" role="status" aria-label="Replaying your trips">
      <span className="follow-text">
        {trip ? (
          <>
            <strong>{titleOf(trip)}</strong>
            {trip.date && <span>{formatVisitDate(trip.date)}</span>}
            <span className="follow-count">
              {index + 1} of {count}
            </span>
          </>
        ) : (
          <span>Your trips, from the first</span>
        )}
      </span>
      <button type="button" className="undo-button" onClick={onStop}>
        Stop
      </button>
    </div>
  )
}
