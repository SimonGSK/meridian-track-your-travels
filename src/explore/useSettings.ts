import { useCallback } from 'react'
import { usePersistentState } from '../storage'

export type Settings = {
  /** Color the countries you've visited on the globe */
  showVisited: boolean
  /** Shade visited countries by how many times you've been, instead of one color */
  showVisitHeat: boolean
  /** Color the countries on your wishlist */
  showWishlist: boolean
  /** Rings around tiny places (islands, microstates) */
  showMarkers: boolean
  /** Color the states and provinces you've visited, over their country */
  showRegions: boolean
  /** Pins on the cities you've visited */
  showCities: boolean
  /** Lines for the flights you've taken */
  showFlights: boolean
  /** The places and flights of trips to come, tinted and dashed */
  showFutureTrips: boolean
  /** Night where the sun has set, as it is now */
  showDayNight: boolean
  /** The cities lit up at night, while day and night is shown */
  showCityLights: boolean
}

export const SETTINGS_KEY = 'countries-app.settings'
export const DEFAULT_SETTINGS: Settings = {
  showVisited: true,
  showVisitHeat: false,
  showWishlist: true,
  showMarkers: true,
  showRegions: true,
  showCities: true,
  showFlights: true,
  showFutureTrips: true,
  showDayNight: false,
  showCityLights: true,
}

export const isSettings = (value: unknown): value is Partial<Settings> =>
  typeof value === 'object' && value !== null && Object.values(value).every((v) => typeof v === 'boolean')

/** Only the settings there are now: older versions saved some that are gone (which Explore cards to show) */
const known = (saved: Partial<Settings>) =>
  Object.fromEntries(Object.entries(saved).filter(([key]) => key in DEFAULT_SETTINGS)) as Partial<Settings>

/** Map settings, saved in this browser. */
export function useSettings() {
  const [saved, setSaved] = usePersistentState<Partial<Settings>>(SETTINGS_KEY, {}, isSettings)
  // Settings added later get their default
  const settings: Settings = { ...DEFAULT_SETTINGS, ...known(saved) }
  const change = useCallback(
    (changes: Partial<Settings>) => setSaved((prev) => ({ ...known(prev), ...changes })),
    [setSaved],
  )
  return [settings, change] as const
}
