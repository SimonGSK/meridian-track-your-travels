import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DEFAULT_SETTINGS, SETTINGS_KEY, useSettings } from './useSettings'

describe('useSettings', () => {
  it('shows every layer but day and night by default', () => {
    const { result } = renderHook(() => useSettings())
    expect(result.current[0]).toEqual({
      showVisited: true,
      showVisitHeat: false,
      showWishlist: true,
      showMarkers: true,
      showRegions: true,
      showCities: true,
      showFlights: true,
      showFutureFlights: true,
      showFutureVisits: true,
      showDayNight: false,
      showCityLights: true,
    })
  })

  it('changes and remembers settings', () => {
    const first = renderHook(() => useSettings())
    act(() => first.result.current[1]({ showMarkers: false }))
    expect(first.result.current[0]).toEqual({ ...DEFAULT_SETTINGS, showMarkers: false })
    first.unmount()
    expect(renderHook(() => useSettings()).result.current[0].showMarkers).toBe(false)
  })

  it('fills in settings missing from what was saved', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showVisited: false }))
    expect(renderHook(() => useSettings()).result.current[0]).toEqual({ ...DEFAULT_SETTINGS, showVisited: false })
  })

  it('forgets settings that are gone, keeping the rest', () => {
    // Older versions could hide the Explore cards
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showGamesCard: false, showCities: false }))
    const { result } = renderHook(() => useSettings())
    expect(result.current[0]).toEqual({ ...DEFAULT_SETTINGS, showCities: false })
    act(() => result.current[1]({ showFlights: false }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ showCities: false, showFlights: false })
  })

  it('keeps future trips switched off as their flights and visits, from before those were apart', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showFutureTrips: false, showCities: false }))
    expect(renderHook(() => useSettings()).result.current[0]).toEqual({
      ...DEFAULT_SETTINGS,
      showFutureFlights: false,
      showFutureVisits: false,
      showCities: false,
    })
  })

  it('ignores corrupted settings', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showVisited: 'no', theme: 1 }))
    expect(renderHook(() => useSettings()).result.current[0]).toEqual(DEFAULT_SETTINGS)
  })
})
