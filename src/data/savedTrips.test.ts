import { describe, expect, it } from 'vitest'
import type { Airport } from './airports'
import type { Route } from './flights'
import {
  isSavedTrips,
  itemKey,
  journeysOf,
  looseOf,
  placeFor,
  placesOf,
  tripViewsOf,
  tripsFromFlights,
  visitsOf,
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
  const visits = [
    { place: 'Japan', date: '2024-04' },
    { place: 'South Korea', date: '2024-04' },
    { place: 'United Kingdom', date: '2017-11' },
  ]

  it('has each trip with its flights, when it was and how far, newest first, those without a date last', () => {
    const views = tripViewsOf(
      [
        trip('old', [visit('United Kingdom', '2017-11')]),
        trip('empty', []),
        trip('asia', [flight('a'), visit('Japan', '2024-04'), flight('b'), visit('South Korea', '2024-04'), flight('c')]),
      ],
      visits,
      asia,
    )
    expect(views.map((v) => v.trip.id)).toEqual(['asia', 'old', 'empty'])
    expect(views[0].routes.map((r) => r.flight.id)).toEqual(['a', 'b', 'c'])
    expect([views[0].date, views[0].endDate, views[0].km]).toEqual(['2024-04', '2024-05', 18_800])
  })

  it("leaves out what's no longer there, and a visit or flight in more than one trip from all but the first", () => {
    const views = tripViewsOf(
      [trip('one', [visit('Japan', '2024-04'), visit('Japan', '2019'), flight('gone')]), trip('two', [visit('Japan', '2024-04'), flight('a')])],
      visits,
      asia,
    )
    expect(views.find((v) => v.trip.id === 'one')!.items).toEqual([visit('Japan', '2024-04')])
    expect(views.find((v) => v.trip.id === 'two')!.items).toEqual([flight('a')])
  })
})

describe('looseOf', () => {
  it('has the visits in no trip, newest first and those without a date last, and the flights in none', () => {
    const visits = [
      { place: 'Denmark', date: null },
      { place: 'Japan', date: '2024-04' },
      { place: 'Kenya', date: '2024' },
      { place: 'Sweden', date: '2023-12' },
    ]
    const views = tripViewsOf([trip('t', [visit('Japan', '2024-04'), flight('a')])], visits, asia)
    const loose = looseOf(views, visits, asia)
    expect(loose.visits.map((v) => v.place)).toEqual(['Kenya', 'Sweden', 'Denmark'])
    expect(loose.flights.map((r) => r.flight.id)).toEqual(['b', 'c'])
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
