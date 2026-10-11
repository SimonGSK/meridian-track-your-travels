// Measures how far each city reaches, for the city game to count a click
// anywhere in a big city as spot on, from Natural Earth's urban areas
// (public domain): the built-up land around the city, on a grid of square
// kilometers, as the radius of a circle as big.
//
// A city's land is what's built up around it without a gap of more than
// GAP_KM, so a river or a strait doesn't cut it in two (New York, Istanbul),
// but a town apart from it isn't part of it. Where cities grow into each
// other (Tokyo and Yokohama), each square goes to the one it's nearest to,
// for its size: the bigger city reaches farther.
//
//   npm run data:city-sizes [path to ne_10m_urban_areas.geojson]
//
// Run it again after `npm run data:cities`. Without a path it downloads the
// urban areas (28 MB).
import { readFile, writeFile } from 'node:fs/promises'

const SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_urban_areas.geojson'
const CITIES = new URL('../src/data/cities.json', import.meta.url)
/** How far around a city to look, in km: no city reaches farther */
const REACH_KM = 80
/** The widest gap in built-up land that's still the same city */
const GAP_KM = 2
/** A city this far from built-up land isn't in it */
const NEAR_KM = 3
const KM_PER_DEGREE = 111.32

const urban = JSON.parse(process.argv[2] ? await readFile(process.argv[2], 'utf8') : await (await fetch(SOURCE)).text())
const cities = JSON.parse(await readFile(CITIES, 'utf8'))

/** Each urban area's edges, as [lng1, lat1, lng2, lat2], and its bounds */
const areas = urban.features.map((feature) => {
  const rings = feature.geometry.coordinates
  const edges = rings.flatMap((ring) => ring.slice(1).map(([lng, lat], i) => [ring[i][0], ring[i][1], lng, lat]))
  const lngs = rings[0].map(([lng]) => lng)
  const lats = rings[0].map(([, lat]) => lat)
  return { edges, west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) }
})

/** The built-up squares around a point, on a grid of 1 km squares REACH_KM each way, row by row from the south */
function builtUp(lat, lng) {
  const size = 2 * REACH_KM
  const cos = Math.cos((lat * Math.PI) / 180)
  const dLat = 1 / KM_PER_DEGREE
  const dLng = 1 / (KM_PER_DEGREE * cos)
  const south = lat - REACH_KM * dLat
  const west = lng - REACH_KM * dLng
  const north = south + size * dLat
  const east = west + size * dLng
  const grid = new Uint8Array(size * size)
  for (const area of areas) {
    if (area.east < west || area.west > east || area.north < south || area.south > north) continue
    // Each row through the area, filled between its edges' crossings, in and out (holes left out)
    for (let row = 0; row < size; row++) {
      const y = south + (row + 0.5) * dLat
      if (y < area.south || y > area.north) continue
      const crossings = []
      for (const [x1, y1, x2, y2] of area.edges) {
        if (y1 > y !== y2 > y) crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1))
      }
      crossings.sort((a, b) => a - b)
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const from = Math.max(0, Math.ceil((crossings[i] - west) / dLng - 0.5))
        const to = Math.min(size - 1, Math.floor((crossings[i + 1] - west) / dLng - 0.5))
        for (let col = from; col <= to; col++) grid[row * size + col] = 1
      }
    }
  }
  return { grid, size, south, west, dLat, dLng }
}

/** How close a city is, for its size: the bigger, the farther it reaches into land shared with others */
const pull = (city, lat, lng) =>
  Math.hypot((city.lat - lat) * KM_PER_DEGREE, (city.lng - lng) * KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180)) /
  Math.sqrt(city.population)

const kmBetween = (a, b) =>
  Math.hypot((a.lat - b.lat) * KM_PER_DEGREE, (a.lng - b.lng) * KM_PER_DEGREE * Math.cos((a.lat * Math.PI) / 180))

/** A city's built-up land, in km², or 0 for one not in any */
function areaOf(city) {
  const { grid, size, south, west, dLat, dLng } = builtUp(city.lat, city.lng)
  const center = REACH_KM * size + REACH_KM
  // Its square, or the nearest built up within NEAR_KM
  let start = -1
  for (let d = 0; d <= NEAR_KM && start < 0; d++) {
    for (let dy = -d; dy <= d && start < 0; dy++) {
      for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === d && grid[center + dy * size + dx]) {
          start = center + dy * size + dx
          break
        }
      }
    }
  }
  if (start < 0) return 0
  const others = cities.filter((other) => other !== city && kmBetween(city, other) < 3 * REACH_KM)
  // The built-up land reached from there, across gaps up to GAP_KM, each square counted if it's this city's
  const seen = new Uint8Array(size * size)
  seen[start] = 1
  const queue = [start]
  let squares = 0
  while (queue.length) {
    const at = queue.pop()
    const row = Math.floor(at / size)
    const col = at % size
    const lat = south + (row + 0.5) * dLat
    const lng = west + (col + 0.5) * dLng
    const mine = pull(city, lat, lng)
    if (others.every((other) => pull(other, lat, lng) > mine)) squares++
    for (let dy = -GAP_KM - 1; dy <= GAP_KM + 1; dy++) {
      for (let dx = -GAP_KM - 1; dx <= GAP_KM + 1; dx++) {
        const r = row + dy
        const c = col + dx
        if (r < 0 || c < 0 || r >= size || c >= size) continue
        const next = r * size + c
        if (grid[next] && !seen[next]) {
          seen[next] = 1
          queue.push(next)
        }
      }
    }
  }
  return squares
}

const radiusOf = new Map()
for (const city of cities) {
  const km = Math.round(Math.sqrt(areaOf(city) / Math.PI))
  if (km > 0) radiusOf.set(city, km)
}

// Each city with its radius, or none for one not in built-up land (or less than half a kilometer)
const measured = cities.map((city) => {
  const { radiusKm: _, ...rest } = city
  return radiusOf.get(city) ? { ...rest, radiusKm: radiusOf.get(city) } : rest
})
await writeFile(CITIES, JSON.stringify(measured) + '\n')

const widest = [...radiusOf].sort(([, a], [, b]) => b - a).slice(0, 15)
console.log(`Measured ${radiusOf.size} of ${cities.length} cities. Widest: ${widest.map(([c, km]) => `${c.name} ${km} km`).join(', ')}`)
