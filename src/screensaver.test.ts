import { describe, expect, it } from 'vitest'
import { isScreensaver, packPlaces, screensaverAddress, unpackPlaces } from './screensaver'

describe('screensaver', () => {
  it('is on with ?screensaver in the address', () => {
    expect(isScreensaver('?screensaver')).toBe(true)
    expect(isScreensaver('?a=1&screensaver=1')).toBe(true)
    expect(isScreensaver('')).toBe(false)
  })

  it('carries places, trips, the wishlist, design and layers to another storage through the address', () => {
    localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark', 'Côte d’Ivoire']))
    localStorage.setItem('countries-app.visited-cities', JSON.stringify([2618425]))
    localStorage.setItem('countries-app.design', JSON.stringify('vintage'))
    localStorage.setItem('countries-app.flights', JSON.stringify([{ id: 'a', from: 2618425, to: 1609350 }]))
    localStorage.setItem('countries-app.wishlist', JSON.stringify(['Peru']))
    const trips = [{ id: 't', name: '', items: [{ kind: 'visit', place: 'Japan', date: '2099-03' }] }]
    localStorage.setItem('countries-app.trips', JSON.stringify(trips))
    localStorage.setItem('countries-app.settings', JSON.stringify({ showCities: false, showMarkers: false }))
    localStorage.setItem('countries-app.best-scores', JSON.stringify({ 'flags:easy': 9 })) // not needed there
    const packed = packPlaces()
    expect(packed).toMatch(/^[\w-]+$/) // safe in an address as it is

    localStorage.clear()
    expect(unpackPlaces(`#places=${packed}`)).toBe(true)
    expect(JSON.parse(localStorage.getItem('countries-app.visited')!)).toEqual(['Denmark', 'Côte d’Ivoire'])
    expect(localStorage.getItem('countries-app.visited-cities')).toBe('[2618425]')
    expect(localStorage.getItem('countries-app.design')).toBe('"vintage"')
    expect(JSON.parse(localStorage.getItem('countries-app.flights')!)).toEqual([{ id: 'a', from: 2618425, to: 1609350 }])
    expect(localStorage.getItem('countries-app.wishlist')).toBe('["Peru"]')
    expect(JSON.parse(localStorage.getItem('countries-app.trips')!)).toEqual(trips)
    expect(JSON.parse(localStorage.getItem('countries-app.settings')!)).toEqual({ showCities: false, showMarkers: false })
    expect(localStorage.getItem('countries-app.best-scores')).toBeNull()
  })

  it('ignores addresses without places, broken data and unknown keys', () => {
    expect(unpackPlaces('')).toBe(false)
    expect(unpackPlaces('#places=%%%')).toBe(false)
    const sneaky = btoa(JSON.stringify({ 'something-else': 'x' }))
    expect(unpackPlaces(`#places=${sneaky}`)).toBe(true)
    expect(localStorage.getItem('something-else')).toBeNull()
  })

  it('points the screensaver at the shared folder, where it is allowed to read', () => {
    expect(screensaverAddress('abc')).toBe('file:///Users/Shared/Meridian/index.html?screensaver#places=abc')
  })
})
