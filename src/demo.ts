import { DAILY_KEY, dayKey, shiftDay } from './games/daily'
import { BEST_SCORES_KEY } from './games/useGame'
import { FLIGHTS_KEY } from './visited/useFlights'
import { VISITED_STORAGE_KEY } from './visited/useVisited'
import { VISITED_CITIES_KEY } from './visited/useVisitedCities'
import { VISITED_REGIONS_KEY } from './visited/useVisitedRegions'
import { VISIT_DATES_KEY, VISIT_NOTES_KEY } from './visited/useVisitDates'
import { WISHLIST_KEY } from './visited/useWishlist'
import { PLANS_KEY } from './visited/usePlans'
import { TRIP_NAMES_KEY } from './visited/useTripNames'
import { dayOf, monthOf } from './data/plans'

/**
 * Sample data, to see the app as someone who's travelled a lot would:
 * `npm run dev:demo` serves it on its own port, which the browser keeps
 * apart from your own data. It's put in when nothing is saved there yet,
 * and again with `?reset` in the address.
 */

/** When each place was visited; Denmark is home, so it has none */
export const DEMO_VISITS: Record<string, string[]> = {
  Denmark: [],
  Sweden: ['2018-07', '2020-05', '2021-06', '2023-12', '2024-08'],
  Norway: ['2017-02', '2023-07'],
  Finland: ['2022-01'],
  Iceland: ['2026-06'],
  Greenland: ['2026-06'],
  Estonia: ['2022-01'],
  Latvia: ['2022-01'],
  Lithuania: ['2022-02'],
  Germany: ['2016-10', '2019-03', '2022-09', '2024-12'],
  Netherlands: ['2018-04'],
  Belgium: ['2018-04'],
  Luxembourg: ['2018-04'],
  France: ['2019-08', '2025-07'],
  Italy: ['2018-05', '2021-09'],
  Spain: ['2017-08', '2020-02', '2023-04'],
  Portugal: ['2022-05'],
  'United Kingdom': ['2017-11'],
  Greece: ['2023-06'],
  Croatia: ['2021-08'],
  Czechia: ['2016-05'],
  Austria: ['2016-05'],
  Switzerland: ['2024-01'],
  Poland: ['2020-10'],
  Japan: ['2025-04'],
  'South Korea': ['2025-04'],
  Thailand: ['2024-02'],
  Singapore: ['2024-02'],
  Vietnam: ['2019-03'],
  Australia: ['2024-02'],
  'New Zealand': ['2024-03'],
  'United States': ['2023-09'],
  Canada: ['2023-10'],
  Mexico: ['2020-02'],
  Morocco: ['2018'],
  Egypt: ['2021-02'],
  Kenya: ['2025-11'],
  'South Africa': ['2025-12'],
  'United Arab Emirates': ['2025-12'],
  Peru: ['2019-11'],
  Argentina: ['2019-12'],
  Brazil: ['2019-12'],
}

/** A few words on some of the visits */
export const DEMO_NOTES: Record<string, Record<string, string>> = {
  Japan: { '2025-04': 'Cherry blossom in Kyoto' },
  France: { '2025-07': 'The Tour de France finish in Paris' },
  Iceland: { '2026-06': 'Midnight sun, and whales off Húsavík' },
  Kenya: { '2025-11': 'Safari in the Masai Mara' },
  Peru: { '2019-11': 'Machu Picchu at sunrise' },
  Sweden: { '2023-12': 'Christmas markets in Stockholm' },
}

export const DEMO_WISHLIST = ['Chile', 'Bolivia', 'India', 'Nepal', 'Indonesia', 'Jordan', 'Namibia']

export const DEMO_REGIONS = ['US-NY', 'US-CA', 'US-HI', 'CA-BC', 'AU-NS', 'AU-VI', 'BR-RJ']

/** Cities by GeoNames id: Copenhagen, Aarhus, Stockholm, Oslo, Helsinki, Tallinn, Reykjavík, Berlin, Paris, … */
export const DEMO_CITIES = [
  2618425, 2624652, 2673730, 3143244, 658225, 588409, 3413829, 2950159, 2988507, 3169070, 3176959, 3128760,
  2267057, 2643743, 2759794, 264371, 3067696, 2761369, 3201047, 1850147, 1857910, 1835848, 1609350, 1880252,
  2147714, 2158177, 2193733, 5128581, 5368361, 5391959, 5856195, 6173331, 2542997, 360630, 3369157, 184745,
  3936456, 3941584, 3451190, 3435910, 292223, 1581130, 3530597,
]

/** Trips, as "CPH-ICN" legs, and when */
const TRIPS: [string, string[]][] = [
  ['2026-06', ['CPH-KEF', 'KEF-CPH']],
  ['2025-12', ['CPH-NBO', 'NBO-CPT', 'CPT-DXB', 'DXB-CPH']],
  ['2025-07', ['CPH-CDG', 'CDG-CPH']],
  ['2025-04', ['CPH-ICN', 'ICN-NRT', 'HND-CPH']],
  ['2024-02', ['CPH-BKK', 'BKK-SIN', 'SIN-SYD', 'SYD-AKL', 'AKL-CPH']],
  ['2023-09', ['CPH-JFK', 'JFK-LAX', 'LAX-HNL', 'HNL-YVR', 'YVR-CPH']],
  ['2022-05', ['CPH-LIS', 'LIS-CPH']],
  ['2019-11', ['CPH-LIM', 'LIM-CUZ', 'CUZ-LIM', 'LIM-EZE', 'EZE-GIG', 'GIG-CPH']],
]

export const DEMO_FLIGHTS = [
  ...TRIPS.flatMap(([date, legs]) =>
    legs.map((leg) => {
      const [from, to] = leg.split('-')
      return { id: `demo-${date}-${leg}`, from, to, date }
    }),
  ),
  // Without dates: a weekend in Stockholm, and Marrakesh
  { id: 'demo-ARN', from: 'CPH', to: 'ARN' },
  { id: 'demo-ARN-back', from: 'ARN', to: 'CPH' },
  { id: 'demo-RAK', from: 'CPH', to: 'RAK' },
]

/** Names for some of the trips, by their first flight, as trips were named before they were made by hand */
const TRIP_NAMES = {
  'demo-2025-04-CPH-ICN': { name: 'Seoul and Tokyo', note: 'Cherry blossom season' },
  'demo-2024-02-CPH-BKK': { name: 'Around the world' },
  'demo-2019-11-CPH-LIM': { name: 'South America' },
}

const BEST_SCORES = {
  'flags:easy': 9,
  'flags:medium': 7,
  'capital:easy': 8,
  'shape:easy': 6,
  'find-points:easy': 24,
  'letter:S': 18,
  'all:Europe': 38,
  'higher:population': 14,
  'higher:area': 9,
}

/** The daily challenges of the last week, up to yesterday, so today's is still to play */
function dailyResults(today: Date) {
  const squares = ['🟩🟩🟨🟩🟥', '🟩🟩🟩🟩🟩', '🟧🟩🟥🟩🟩', '🟩🟥🟩🟩🟩', '🟨🟩🟩🟥🟩', '🟩🟩🟩🟥🟩']
  return Object.fromEntries(
    squares.map((row, i) => {
      const score = [...row].reduce((sum, square, round) => {
        if (square === '🟥') return sum
        return sum + (round === 0 ? { '🟩': 3, '🟨': 2, '🟧': 1 }[square]! : 1)
      }, 0)
      return [shiftDay(dayKey(today), -(i + 1)), { score, max: 7, squares: row }]
    }),
  )
}

/** Trips to come, from today: India in about six weeks, with the flights booked there and back, and Chile later */
function upcoming(today: Date) {
  const inDays = (n: number) => dayOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n))
  return {
    plans: { India: inDays(40), Chile: inDays(150) },
    // Over a month away, so in a month still to come
    flights: [
      { id: 'demo-DEL', from: 'CPH', to: 'DEL', date: monthOf(inDays(40)) },
      { id: 'demo-DEL-back', from: 'DEL', to: 'CPH', date: monthOf(inDays(54)) },
    ],
  }
}

/** Everything the demo saves, by storage key */
export function demoData(today = new Date()): Record<string, unknown> {
  const { plans, flights } = upcoming(today)
  return {
    [VISITED_STORAGE_KEY]: Object.keys(DEMO_VISITS),
    [VISIT_DATES_KEY]: Object.fromEntries(Object.entries(DEMO_VISITS).filter(([, dates]) => dates.length)),
    [VISIT_NOTES_KEY]: DEMO_NOTES,
    [VISITED_REGIONS_KEY]: DEMO_REGIONS,
    [VISITED_CITIES_KEY]: DEMO_CITIES,
    [FLIGHTS_KEY]: [...DEMO_FLIGHTS, ...flights],
    [PLANS_KEY]: plans,
    [TRIP_NAMES_KEY]: TRIP_NAMES,
    [WISHLIST_KEY]: DEMO_WISHLIST,
    [BEST_SCORES_KEY]: BEST_SCORES,
    [DAILY_KEY]: dailyResults(today),
  }
}

/** Puts the sample data in when nothing is saved yet, or always with `?reset`; says whether it did */
export function seedDemo(storage: Storage = localStorage, search = window.location.search, today = new Date()) {
  const reset = new URLSearchParams(search).has('reset')
  if (!reset && storage.getItem(VISITED_STORAGE_KEY) !== null) return false
  if (reset) storage.clear()
  for (const [key, value] of Object.entries(demoData(today))) storage.setItem(key, JSON.stringify(value))
  return true
}
