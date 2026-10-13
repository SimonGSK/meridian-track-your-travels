import { describe, expect, it } from 'vitest'
import { findCountryByName } from '../countries'
import { clockIn, comparedToYou, placeOfZone, timeZonesOf, timesIn, utcOffset } from './localTime'

const country = (name: string) => findCountryByName(name)!
const SUMMER = new Date('2026-07-01T12:00:00Z')
const WINTER = new Date('2026-01-15T12:00:00Z')

describe('local time', () => {
  it("knows each place's time zones, its capital's first", () => {
    expect(timeZonesOf(country('Japan'))).toEqual(['Asia/Tokyo'])
    expect(timeZonesOf(country('United States'))[0]).toBe('America/New_York') // Washington's
    expect(timeZonesOf(country('Australia'))[0]).toBe('Australia/Sydney') // Canberra's
    expect(timeZonesOf(country('Kosovo'))).toEqual(['Europe/Skopje']) // none of its own: the nearest
  })

  it('tells a time zone apart from summer to winter, to the minute', () => {
    expect(utcOffset('Europe/Copenhagen', SUMMER)).toBe(120)
    expect(utcOffset('Europe/Copenhagen', WINTER)).toBe(60)
    expect(utcOffset('Asia/Kolkata', SUMMER)).toBe(330)
    expect(utcOffset('America/St_Johns', WINTER)).toBe(-210)
    expect(utcOffset('Europe/London', WINTER)).toBe(0)
  })

  it('shows the time there as a clock', () => {
    expect(clockIn('Asia/Tokyo', SUMMER)).toBe('21:00')
    expect(clockIn('America/New_York', WINTER)).toBe('07:00')
  })

  it('counts the different times a place has, not its zones', () => {
    const usa = timeZonesOf(country('United States'))
    expect(usa.length).toBeGreaterThan(20)
    expect(timesIn(usa, WINTER)).toBe(6) // Eastern to Hawaii
    expect(timesIn(timeZonesOf(country('China')), SUMMER)).toBe(2)
    expect(timesIn(timeZonesOf(country('Japan')), SUMMER)).toBe(1)
  })

  it('says how far ahead of yours it is', () => {
    expect(comparedToYou(420)).toBe('7 h ahead of you')
    expect(comparedToYou(-90)).toBe('1 h 30 min behind you')
    expect(comparedToYou(45)).toBe('45 min ahead of you')
    expect(comparedToYou(0)).toBe('Same time as you')
  })

  it("finds the place a time zone is in, not one that borrows it", () => {
    expect(placeOfZone.get('Europe/Copenhagen')).toBe('DK')
    expect(placeOfZone.get('Europe/Skopje')).toBe('MK')
  })
})
