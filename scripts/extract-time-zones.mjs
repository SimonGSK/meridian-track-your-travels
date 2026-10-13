// Each place's time zones, for its local time in its panel: from the IANA
// time zone database's zone.tab (public domain), which lists every zone with
// its country and the place it's named for. The capital's zone comes first
// (the one nearest to it), as the panel shows the time there. A place with no
// zone of its own borrows the nearest one to its capital (Kosovo, Skopje's),
// listed as `borrowed`, as that zone isn't where it is.
//
//   npm run data:time-zones [path to zone.tab]
//
// Without a path it reads the system's copy (/usr/share/zoneinfo/zone.tab,
// on macOS and Linux).
import { readFile, writeFile } from 'node:fs/promises'

const SOURCE = process.argv[2] ?? '/usr/share/zoneinfo/zone.tab'
const OUTPUT = new URL('../src/data/time-zones.json', import.meta.url)
const facts = JSON.parse(await readFile(new URL('../src/data/country-facts.json', import.meta.url), 'utf8'))
const cities = JSON.parse(await readFile(new URL('../src/data/cities.json', import.meta.url), 'utf8'))

/** "+5546+01235" or "+404251-0740023": degrees and minutes (and seconds), signed */
function degrees(text, width) {
  const sign = text[0] === '-' ? -1 : 1
  const digits = text.slice(1)
  const whole = Number(digits.slice(0, width))
  const minutes = Number(digits.slice(width, width + 2))
  const seconds = Number(digits.slice(width + 2) || 0)
  return sign * (whole + minutes / 60 + seconds / 3600)
}

// Every zone: its country, where it's named for, and its name
const zones = (await readFile(SOURCE, 'utf8'))
  .split('\n')
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [code, coordinates, zone] = line.split('\t')
    const [, lat, lng] = coordinates.match(/^([+-]\d+)([+-]\d+)$/)
    return { code, zone, lat: degrees(lat, 2), lng: degrees(lng, 3) }
  })

const km = (a, b) => {
  const rad = Math.PI / 180
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Places whose zones are under other codes: on the map by name, or as one where the zones are two (Jersey and Guernsey) */
const ZONES_OF = { 'Indian Ocean Ter.': ['CX', 'CC'], JG: ['JE', 'GG'] }

const result = {}
const borrowed = []
const missing = []
for (const place of Object.keys(facts)) {
  const codes = ZONES_OF[place] ?? (place.length === 2 ? [place] : [])
  const own = zones.filter((z) => codes.includes(z.code))
  const capital = cities.find((city) => city.capital && city.place === place)
  // A place with no zone of its own (Kosovo) keeps the time of the nearest one to its capital
  const near = (list) => (capital ? [...list].sort((a, b) => km(a, capital) - km(b, capital)) : list)
  const ordered = own.length ? near(own) : capital ? near(zones).slice(0, 1) : []
  if (ordered.length) result[place] = ordered.map((z) => z.zone)
  else missing.push(place)
  if (ordered.length && !own.length) borrowed.push(place)
}

await writeFile(OUTPUT, JSON.stringify({ zones: result, borrowed }) + '\n')
console.log(`Wrote the time zones of ${Object.keys(result).length} places to ${OUTPUT.pathname}; none for ${missing.join(', ')}`)
