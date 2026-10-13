import type { CountryFeature } from '../countries'
import { placeKey } from './facts'
import zones from './time-zones.json'

/**
 * Each place's local time, from the IANA time zones it's in (time-zones.json,
 * by scripts/extract-time-zones.mjs), its capital's first.
 */

const { zones: zonesByPlace, borrowed } = zones as { zones: Record<string, string[]>; borrowed: string[] }

/** A place's time zones, its capital's first; none for a place nobody lives (Heard Island) */
export const timeZonesOf = (country: CountryFeature): readonly string[] => zonesByPlace[placeKey(country)] ?? []

/** Which place a time zone is in ("Europe/Copenhagen" → "DK"); not those it's borrowed by (Kosovo, Skopje's) */
export const placeOfZone = new Map(
  Object.entries(zonesByPlace).flatMap(([place, list]) => (borrowed.includes(place) ? [] : list.map((zone) => [zone, place]))),
)

const offsetFormats = new Map<string, Intl.DateTimeFormat>()
const clockFormats = new Map<string, Intl.DateTimeFormat>()
const formatOf = (formats: Map<string, Intl.DateTimeFormat>, zone: string, make: () => Intl.DateTimeFormat) => {
  if (!formats.has(zone)) formats.set(zone, make())
  return formats.get(zone)!
}

/** How many minutes ahead of UTC a zone is at a moment ("GMT+05:30" is 330) */
export function utcOffset(zone: string, at: Date) {
  const format = formatOf(offsetFormats, zone, () => new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }))
  const name = format.formatToParts(at).find((part) => part.type === 'timeZoneName')?.value ?? ''
  const match = name.match(/([+-])(\d{2}):(\d{2})/)
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0
}

/** The time in a zone, "06:42" */
export const clockIn = (zone: string, at: Date) =>
  formatOf(clockFormats, zone, () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone })).format(at)

/** How many different times a place has at a moment: its zones' offsets, each once (the USA's 29 zones are 6 times) */
export const timesIn = (zones: readonly string[], at: Date) => new Set(zones.map((zone) => utcOffset(zone, at))).size

/** "7 h ahead of you", "1 h 30 min behind you", "Same time as you": by how many minutes a place's time is ahead of yours */
export function comparedToYou(minutes: number) {
  if (minutes === 0) return 'Same time as you'
  const hours = Math.floor(Math.abs(minutes) / 60)
  const rest = Math.abs(minutes) % 60
  const span = [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ')
  return `${span} ${minutes > 0 ? 'ahead of' : 'behind'} you`
}
