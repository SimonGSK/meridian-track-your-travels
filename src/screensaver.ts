import { fromBase64Url, toBase64Url } from './base64url'
import { THEME_STORAGE_KEY } from './design/useTheme'
import { SETTINGS_KEY } from './explore/useSettings'
import { FLIGHTS_KEY } from './visited/useFlights'
import { TRIPS_KEY } from './visited/useTrips'
import { VISITED_STORAGE_KEY } from './visited/useVisited'
import { VISITED_CITIES_KEY } from './visited/useVisitedCities'
import { VISITED_REGIONS_KEY } from './visited/useVisitedRegions'
import { WISHLIST_KEY } from './visited/useWishlist'

/**
 * The globe as a Mac screensaver: with `?screensaver` in the address the app
 * shows only the spinning globe. A screensaver keeps its own storage, so the
 * address carries your places and design along: `#places=…`.
 */

/** Where the screensaver file goes: screensavers can't read Documents, Desktop or Downloads */
export const SCREENSAVER_FILE = '/Users/Shared/Meridian/index.html'

/**
 * What the screensaver shows: your places, states, cities, flights, trips
 * (where your visits are, and those to come) and wishlist, the design and the
 * layers
 */
const KEYS = [
  VISITED_STORAGE_KEY,
  VISITED_REGIONS_KEY,
  VISITED_CITIES_KEY,
  FLIGHTS_KEY,
  TRIPS_KEY,
  WISHLIST_KEY,
  THEME_STORAGE_KEY,
  SETTINGS_KEY,
]

export const isScreensaver = (search = window.location.search) => new URLSearchParams(search).has('screensaver')

/** Your saved places, design and layers, packed for an address */
export function packPlaces(storage: Storage = localStorage) {
  const saved: Record<string, string> = {}
  for (const key of KEYS) {
    const value = storage.getItem(key)
    if (value !== null) saved[key] = value
  }
  return toBase64Url(JSON.stringify(saved))
}

/** Unpacks `#places=…` into storage, so the app shows them; ignores anything it doesn't recognize */
export function unpackPlaces(hash: string, storage: Storage = localStorage) {
  const data = new URLSearchParams(hash.replace(/^#/, '')).get('places')
  if (!data) return false
  try {
    const saved = JSON.parse(fromBase64Url(data)) as unknown
    if (typeof saved !== 'object' || saved === null) return false
    for (const [key, value] of Object.entries(saved)) {
      if (KEYS.includes(key) && typeof value === 'string') storage.setItem(key, value)
    }
    return true
  } catch {
    return false
  }
}

/** The address to give the screensaver */
export const screensaverAddress = (places: string) =>
  `file://${encodeURI(SCREENSAVER_FILE)}?screensaver#places=${places}`
