import { geoDistance } from 'd3-geo'
import type { Route } from './flights'
import { isToCome } from './plans'
import type { TripView } from './savedTrips'

/**
 * Replaying your trips, from the first to the last: each flight flown and
 * each place reached in turn, as a timeline in seconds from the start.
 */

/** A flight flown, or a place reached; `at` seconds from the start, and the trip it's part of (by its place in the replay) */
export type ReplayStep =
  | { kind: 'flight'; route: Route; trip: number; at: number; seconds: number }
  | { kind: 'visit'; place: string; trip: number; at: number }

/** How long the globe takes to turn to the first trip */
export const REPLAY_LEAD_IN = 1.5
/** How long a place reached shows before going on */
export const REPLAY_PAUSE = 1
/** And between trips */
export const REPLAY_GAP = 0.6

/** As a screensaver, how long it spins before the first replay, and between replays after that */
export const SCREENSAVER_FIRST_REPLAY_MS = 10_000
export const SCREENSAVER_REPLAY_EVERY_MS = 90_000

/** How long a flight takes, replayed: briskly, as there are many; Copenhagen to Doha about 2 seconds */
export const replaySeconds = ({ from, to }: { from: { lat: number; lng: number }; to: { lat: number; lng: number } }) =>
  0.8 + geoDistance([from.lng, from.lat], [to.lng, to.lat]) * 1.4

/**
 * The trips been on, oldest first, each step in its order: a trip without a
 * date has no place in time (unless it's `undated` you want, one trip
 * replayed from its card), and one to come hasn't happened, nor have the
 * flights and visits in a month still to come.
 */
export function replayOf(views: readonly TripView[], now = new Date(), { undated = false } = {}) {
  const been = views.filter((view) => (view.date ? !isToCome(view.date, now) : undated)).reverse()
  const steps: ReplayStep[] = []
  let at = REPLAY_LEAD_IN
  been.forEach((view, trip) => {
    if (trip > 0) at += REPLAY_GAP
    const routeOf = new Map(view.routes.map((route) => [route.flight.id, route]))
    for (const item of view.items) {
      if (item.kind === 'visit') {
        if (item.date && isToCome(item.date, now)) continue
        steps.push({ kind: 'visit', place: item.place, trip, at })
        at += REPLAY_PAUSE
      } else {
        const route = routeOf.get(item.flight)!
        if (route.flight.date && isToCome(route.flight.date, now)) continue
        const seconds = replaySeconds(route)
        steps.push({ kind: 'flight', route, trip, at, seconds })
        at += seconds
      }
    }
  })
  return { trips: been, steps, seconds: at }
}

/** One trip, replayed from its card: dated or not */
export const replayOfTrip = (view: TripView, now = new Date()) => replayOf([view], now, { undated: true })

/** How fast a replay can go */
export const REPLAY_SPEEDS = [1, 2, 4] as const
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number]

/**
 * A replay's own clock, in seconds of the replay: `at` when it was last set
 * going (or paused), `since` then on the real clock, going `speed` times as
 * fast, or standing still while paused
 */
export type ReplayClock = { at: number; since: number; speed: ReplaySpeed; paused: boolean }

/** A clock from the start, going at `speed` */
export const startClock = (now: number, speed: ReplaySpeed = 1): ReplayClock => ({ at: 0, since: now, speed, paused: false })

/** Where in the replay it is at a moment on the real clock */
export const replayTime = ({ at, since, speed, paused }: ReplayClock, now: number) => (paused ? at : at + (now - since) * speed)

/** The clock going on from where it is now, at another speed, or paused or not */
export const resetClock = (clock: ReplayClock, now: number, changes: Partial<Pick<ReplayClock, 'speed' | 'paused'>>): ReplayClock => ({
  ...clock,
  ...changes,
  at: replayTime(clock, now),
  since: now,
})

/** How the replay stands after a step: the places reached so far, those of the trip it's on, and the flights flown */
export function replayedBy(steps: readonly ReplayStep[], upTo: number) {
  const done = steps.slice(0, upTo + 1)
  const trip = done.at(-1)?.trip ?? -1
  const visits = done.flatMap((step) => (step.kind === 'visit' ? [step] : []))
  return {
    places: new Set(visits.map((step) => step.place)),
    thisTrip: new Set(visits.filter((step) => step.trip === trip).map((step) => step.place)),
    flights: done.flatMap((step) => (step.kind === 'flight' ? [step] : [])),
    trip,
  }
}
