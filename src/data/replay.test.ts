import { describe, expect, it } from 'vitest'
import type { Airport } from './airports'
import type { Route } from './flights'
import {
  REPLAY_GAP,
  REPLAY_LEAD_IN,
  REPLAY_PAUSE,
  replayOf,
  replayOfTrip,
  replaySeconds,
  replayTime,
  replayedBy,
  resetClock,
  startClock,
} from './replay'
import { tripViewsOf, type SavedTrip, type TripItem } from './savedTrips'
import type { VisitDate } from './visitDates'

const airport = (code: string, country: string, lat: number, lng: number): Airport => ({ code, name: code, city: code, country, lat, lng })
const CPH = airport('CPH', 'DK', 55.6, 12.6)
const NRT = airport('NRT', 'JP', 35.8, 140.4)
const route = (id: string, from: Airport, to: Airport, date: VisitDate): Route => ({
  flight: { id, from: from.code, to: to.code, date },
  from,
  to,
  km: 8700,
})
const ROUTES = [route('out', CPH, NRT, '2024-04'), route('back', NRT, CPH, '2024-04'), route('later', CPH, NRT, '2099-01')]
const visit = (place: string, date: VisitDate | null): TripItem => ({ kind: 'visit', place, date })
const flight = (id: string): TripItem => ({ kind: 'flight', flight: id })
const trips: SavedTrip[] = [
  { id: 'japan', name: 'Japan', items: [flight('out'), visit('Japan', '2024-04'), flight('back')] },
  { id: 'nordics', name: '', items: [visit('Sweden', '2018-07'), visit('Norway', '2018-07')] },
  { id: 'someday', name: '', items: [visit('Peru', null)] },
  { id: 'to-come', name: '', items: [flight('later'), visit('Chile', '2099-01')] },
]
const NOW = new Date('2026-10-11T12:00')

describe('replayOf', () => {
  const { trips: played, steps, seconds } = replayOf(tripViewsOf(trips, ROUTES), NOW)

  it('plays the trips been on, oldest first, and not those without a date or still to come', () => {
    expect(played.map((view) => view.trip.id)).toEqual(['nordics', 'japan'])
  })

  it('goes through each in its order: a pause at each place, each flight as long as it is far', () => {
    expect(steps.map((step) => `${step.trip} ${step.kind === 'visit' ? step.place : step.route.flight.id} @${step.at.toFixed(1)}`)).toEqual([
      `0 Sweden @${REPLAY_LEAD_IN.toFixed(1)}`,
      `0 Norway @${(REPLAY_LEAD_IN + REPLAY_PAUSE).toFixed(1)}`,
      `1 out @${(REPLAY_LEAD_IN + 2 * REPLAY_PAUSE + REPLAY_GAP).toFixed(1)}`,
      `1 Japan @${(REPLAY_LEAD_IN + 2 * REPLAY_PAUSE + REPLAY_GAP + replaySeconds(ROUTES[0])).toFixed(1)}`,
      `1 back @${(REPLAY_LEAD_IN + 3 * REPLAY_PAUSE + REPLAY_GAP + replaySeconds(ROUTES[0])).toFixed(1)}`,
    ])
    expect(seconds).toBeCloseTo(REPLAY_LEAD_IN + 3 * REPLAY_PAUSE + REPLAY_GAP + 2 * replaySeconds(ROUTES[0]))
  })

  it('flies faster the shorter the flight, briskly', () => {
    expect(replaySeconds({ from: CPH, to: NRT })).toBeGreaterThan(replaySeconds({ from: CPH, to: { lat: 59.6, lng: 17.9 } }))
    expect(replaySeconds({ from: CPH, to: NRT })).toBeLessThan(3.5)
  })

  it('stands after each step: the places reached so far, those of the trip it is on, and the flights flown', () => {
    const start = replayedBy(steps, -1)
    expect([...start.places, ...start.thisTrip, start.flights.length, start.trip]).toEqual([0, -1])
    const inJapan = replayedBy(steps, 3)
    expect([...inJapan.places]).toEqual(['Sweden', 'Norway', 'Japan'])
    expect([...inJapan.thisTrip]).toEqual(['Japan'])
    expect(inJapan.flights.map((step) => step.route.flight.id)).toEqual(['out'])
    expect(inJapan.trip).toBe(1)
  })
})

describe('one trip', () => {
  it('replays a trip of its own, with a date or none, but nothing still to come', () => {
    const views = tripViewsOf(trips, ROUTES)
    const one = (id: string) => replayOfTrip(views.find((view) => view.trip.id === id)!, NOW)
    expect(one('japan').steps.map((step) => step.kind)).toEqual(['flight', 'visit', 'flight'])
    expect(one('japan').steps[0].at).toBe(REPLAY_LEAD_IN)
    expect(one('someday').steps).toEqual([expect.objectContaining({ kind: 'visit', place: 'Peru' })])
    expect(one('to-come').steps).toEqual([])
  })
})

describe('the replay clock', () => {
  it('goes from the start at its speed, standing still while paused, and on from where it was', () => {
    let clock = startClock(100)
    expect(replayTime(clock, 103)).toBe(3)
    clock = resetClock(clock, 103, { speed: 4 })
    expect(replayTime(clock, 104)).toBe(7) // four seconds in one
    clock = resetClock(clock, 104, { paused: true })
    expect(replayTime(clock, 200)).toBe(7) // paused
    clock = resetClock(clock, 200, { paused: false })
    expect(replayTime(clock, 201)).toBe(11) // on, still four times as fast
    expect(startClock(0, 2).speed).toBe(2)
  })
})

