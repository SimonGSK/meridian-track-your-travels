import { describe, expect, it } from 'vitest'
import type { Airport } from './airports'
import type { Route } from './flights'
import {
  isSavedTrips,
  itemKey,
  joinTrips,
  journeysOf,
  looseOf,
  placeFor,
  placesOf,
  tripViewsOf,
  tripsFromFlights,
  tripsOfVisits,
  visitsInTrips,
  visitsOf,
  visitsOfPlans,
  type SavedTrip,
  type TripItem,
} from './savedTrips'
import type { VisitDate } from './visitDates'

const airport = (code: string, country: string, lat: number, lng: number): Airport => ({ code, name: code, city: code, country, lat, lng })
const CPH = airport('CPH', 'DK', 55.6, 12.6)
const NRT = airport('NRT', 'JP', 35.8, 140.4)
const ICN = airport('ICN', 'KR', 37.5, 126.4)
const LHR = airport('LHR', 'GB', 51.5, -0.5)
const route = (id: string, from: Airport, to: Airport, date?: VisitDate, km = 1000): Route => ({
  flight: { id, from: from.code, to: to.code, ...(date ? { date } : {}) },
  from,
  to,
  km,
})
const visit = (place: string, date: VisitDate | null = null): TripItem => ({ kind: 'visit', place, date })
const flight = (id: string): TripItem => ({ kind: 'flight', flight: id })
const trip = (id: string, items: TripItem[], name = ''): SavedTrip => ({ id, name, items })

const asia = [route('a', CPH, NRT, '2024-04', 8700), route('b', NRT, ICN, '2024-04', 1200), route('c', ICN, CPH, '2024-05', 8900)]

describe('visitsOf', () => {
  it('has each date of each place, and a place without dates once, with none', () => {
    const dates: Record<string, VisitDate[]> = { Japan: ['2024-04', '2019'] }
    expect(visitsOf(['Japan', 'Denmark'], (name) => dates[name] ?? [])).toEqual([
      { place: 'Japan', date: '2024-04' },
      { place: 'Japan', date: '2019' },
      { place: 'Denmark', date: null },
    ])
  })
})

describe('isSavedTrips', () => {
  it('takes trips of visits and flights, and nothing else', () => {
    expect(isSavedTrips([trip('t', [visit('Japan', '2024-04'), flight('a'), visit('Denmark')], 'Asia')])).toBe(true)
    expect(isSavedTrips([{ id: 't', name: 'x', items: [{ kind: 'visit', place: 'Japan', date: 'April' }] }])).toBe(false)
    expect(isSavedTrips([{ id: 't', items: [] }])).toBe(false)
    expect(isSavedTrips({})).toBe(false)
  })
})

describe('tripViewsOf', () => {
  it('has each trip with its flights, when it was and how far, newest first, those without a date yet at the top', () => {
    const views = tripViewsOf(
      [
        trip('old', [visit('United Kingdom', '2017-11')]),
        trip('empty', []),
        trip('asia', [flight('a'), visit('Japan', '2024-04'), flight('b'), visit('South Korea', '2024-04'), flight('c')]),
      ],
      asia,
    )
    expect(views.map((v) => v.trip.id)).toEqual(['empty', 'asia', 'old'])
    expect(views[1].routes.map((r) => r.flight.id)).toEqual(['a', 'b', 'c'])
    expect([views[1].date, views[1].endDate, views[1].km]).toEqual(['2024-04', '2024-05', 18_800])
  })

  it('leaves out flights no longer there, and a visit or flight in more than one trip from all but the first', () => {
    const views = tripViewsOf(
      [trip('one', [visit('Japan', '2024-04'), visit('Japan', '2019'), flight('gone')]), trip('two', [visit('Japan', '2024-04'), flight('a')])],
      asia,
    )
    expect(views.find((v) => v.trip.id === 'one')!.items).toEqual([visit('Japan', '2024-04'), visit('Japan', '2019')])
    expect(views.find((v) => v.trip.id === 'two')!.items).toEqual([flight('a')])
    expect(visitsInTrips(views)).toEqual([
      { place: 'Japan', date: '2024-04' },
      { place: 'Japan', date: '2019' },
    ])
  })
})

describe('looseOf', () => {
  it('has the places marked visited that no trip went to, each once, by name, and the flights in none', () => {
    const views = tripViewsOf([trip('t', [visit('Japan', '2024-04'), flight('a')])], asia)
    const loose = looseOf(views, ['Sweden', 'Japan', 'Denmark'], asia)
    expect(loose.places).toEqual(['Denmark', 'Sweden'])
    expect(loose.flights.map((r) => r.flight.id)).toEqual(['b', 'c'])
  })
})

describe('what there was before visits were only made in trips', () => {
  const ids = () => {
    let n = 0
    return () => `new-${++n}`
  }

  it("puts a visit in a trip whose flight lands there within a month, where it fits, and gives back the others", () => {
    const made = [trip('asia', [flight('a'), flight('b'), flight('c')])]
    const { trips, rest } = joinTrips(
      made,
      [
        { place: 'South Korea', date: '2024-05' },
        { place: 'Japan', date: '2019' },
        { place: 'Kenya', date: '2024-04' },
      ],
      asia,
    )
    expect(trips[0].items).toEqual([flight('a'), flight('b'), visit('South Korea', '2024-05'), flight('c')])
    expect(made[0].items).toHaveLength(3) // left as it was
    expect(rest).toEqual([
      { place: 'Japan', date: '2019' },
      { place: 'Kenya', date: '2024-04' },
    ])
  })

  it('makes a trip a month of the dated visits in none, oldest first', () => {
    const trips = tripsOfVisits(
      [trip('t', [visit('Japan', '2024-04')])],
      [
        { place: 'Japan', date: '2024-04' }, // in a trip already
        { place: 'Kenya', date: '2024-04' },
        { place: 'Sweden', date: '2019' },
        { place: 'Norway', date: '2024-04' },
        { place: 'Denmark', date: null }, // marked visited, no date: in no trip
      ],
      ids(),
    )
    expect(trips).toEqual([
      { id: 'new-1', name: '', items: [visit('Sweden', '2019')] },
      { id: 'new-2', name: '', items: [visit('Kenya', '2024-04'), visit('Norway', '2024-04')] },
    ])
  })

  it('makes visits of plans, in the month of their day, soonest first', () => {
    expect(visitsOfPlans({ Chile: '2027-03-02', India: '2026-11-20' })).toEqual([
      { place: 'India', date: '2026-11' },
      { place: 'Chile', date: '2027-03' },
    ])
  })
})

describe('placesOf', () => {
  it('names the places of a trip in order, each once', () => {
    expect(placesOf([visit('Japan', '2024-04'), flight('a'), visit('South Korea'), visit('Japan', '2019')])).toEqual(['Japan', 'South Korea'])
  })
})

describe('placeFor', () => {
  it('puts a flight after the place it leaves from, and a place after the flight that lands there', () => {
    const items = [flight('a'), visit('Japan', '2024-04'), visit('South Korea', '2024-04')]
    expect(placeFor(flight('b'), items, asia)).toBe(2) // Tokyo → Seoul, between Japan and South Korea
    expect(placeFor(visit('Japan', '2024-04'), [flight('a'), flight('b')], asia)).toBe(1)
    expect(placeFor(visit('United Kingdom'), items, asia)).toBe(3) // nothing lands there: at the end
  })

  it('or else puts a flight before the place it lands in, and a place before the flight that leaves from it', () => {
    expect(placeFor(flight('a'), [visit('Japan', '2024-04')], asia)).toBe(0) // Copenhagen → Tokyo, before Japan
    expect(placeFor(visit('South Korea'), [flight('a'), flight('c')], asia)).toBe(1) // before Seoul → Copenhagen
  })
})

describe('tripsFromFlights', () => {
  const ids = () => {
    let n = 0
    return () => `trip-${++n}`
  }

  it('makes a trip of each worked out from the flights, with the places landed in where there was a visit then, and its name', () => {
    const visits = [
      { place: 'Japan', date: '2019' },
      { place: 'Japan', date: '2024-04' },
      { place: 'South Korea', date: null },
      { place: 'Denmark', date: null },
    ]
    const trips = tripsFromFlights(asia, visits, (legs) => (legs.includes('a') ? { name: 'Asia', note: 'Spring' } : null), ids())
    expect(trips).toEqual([
      {
        id: 'trip-1',
        name: 'Asia',
        note: 'Spring',
        // Home, Denmark, isn't a stop
        items: [flight('a'), visit('Japan', '2024-04'), flight('b'), visit('South Korea'), flight('c')],
      },
    ])
  })

  it('makes a trip of a flight on its own too, and leaves out places with no visit to go with it', () => {
    const trips = tripsFromFlights([route('l', CPH, LHR, '2017-11')], [], () => null, ids())
    expect(trips).toEqual([{ id: 'trip-1', name: '', items: [flight('l')] }])
  })

  it('uses each visit in one trip only', () => {
    const twice = [route('x', CPH, NRT, '2024-04'), route('y', NRT, CPH, '2024-04'), route('z', CPH, NRT, '2024-05')]
    const trips = tripsFromFlights(twice, [{ place: 'Japan', date: '2024-04' }], () => null, ids())
    expect(trips.flatMap((t) => t.items.filter((i) => i.kind === 'visit'))).toEqual([visit('Japan', '2024-04')])
  })
})

describe('journeysOf', () => {
  it("flies each trip's flights in its order, then the others as worked out from where they go", () => {
    const loose = [route('l', CPH, LHR, '2017-11'), route('m', LHR, CPH, '2017-11')]
    const journeys = journeysOf([...asia, ...loose], [trip('t', [flight('b'), visit('Japan'), flight('a')]), trip('e', [])])
    expect(journeys.map((legs) => legs.map((r) => r.flight.id))).toEqual([['b', 'a'], ['c'], ['l', 'm']])
  })
})

describe('itemKey', () => {
  it('tells visits apart by place and date, and flights by id', () => {
    expect(itemKey(visit('Japan', '2024-04'))).not.toBe(itemKey(visit('Japan')))
    expect(itemKey(flight('a'))).toBe('flight:a')
  })
})
