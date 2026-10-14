import { formatVisitDate } from '../data/visitDates'
import { titleOf, type TripView } from '../data/savedTrips'
import type { ReplaySpeed } from '../data/replay'
import { PauseIcon, PlayIcon } from '../icons'

type Props = {
  /** The trip being replayed, or null before the first */
  trip: TripView | null
  index: number
  count: number
  /** Replaying one trip: where it's got to ("Copenhagen → Dubai", "Japan"), rather than which trip of how many */
  step?: string | null
  paused: boolean
  speed: ReplaySpeed
  /** Pauses, or plays on */
  onPause: () => void
  /** The next speed, round from the fastest to the first */
  onSpeed: () => void
  onStop: () => void
}

/**
 * At the bottom while trips are replayed: which trip of how many (or, for
 * one, where it's got to), when, and ways to pause, go faster, and stop
 */
export default function ReplayBar({ trip, index, count, step, paused, speed, onPause, onSpeed, onStop }: Props) {
  const one = step !== undefined
  return (
    <div className="follow-bar replay-bar" role="status" aria-label={one ? 'Replaying a trip' : 'Replaying your trips'}>
      <span className="follow-text">
        {trip ? (
          <>
            <strong>{titleOf(trip)}</strong>
            {trip.date && <span>{formatVisitDate(trip.date)}</span>}
            {one ? (
              step && <span className="follow-count">{step}</span>
            ) : (
              <span className="follow-count">
                {index + 1} of {count}
              </span>
            )}
          </>
        ) : (
          <span>{one ? 'The trip, from the start' : 'Your trips, from the first'}</span>
        )}
      </span>
      <button type="button" className="icon-button small" onClick={onPause} aria-label={paused ? 'Play on' : 'Pause'}>
        {paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
      </button>
      <button type="button" className="text-button replay-speed" onClick={onSpeed} aria-label={`Speed ${speed}×`} title="Faster">
        {speed}×
      </button>
      <button type="button" className="undo-button" onClick={onStop}>
        Stop
      </button>
    </div>
  )
}
