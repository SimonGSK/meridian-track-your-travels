import { geoOrthographic, geoPath } from 'd3-geo'
import { countries, type CountryFeature } from '../countries'
import { MIDNIGHT } from '../globe/themes'

/**
 * Drawing the cards to keep or share, a year wrapped or a trip: their size,
 * fonts and colors, and the parts they share, a globe and rows of flags.
 */

/** A card's size: a phone's story, 9 by 16 */
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1920

export const SERIF = '"Fraunces Variable", Georgia, serif'
export const SANS = '"Inter Variable", system-ui, sans-serif'
export const MONO = '"JetBrains Mono Variable", ui-monospace, monospace'

/** The fonts the cards are drawn in, to have loaded before drawing them */
export const CARD_FONTS = [`700 220px ${SERIF}`, `400 60px ${SERIF}`, `500 36px ${SANS}`, `500 28px ${MONO}`]

/** In the app's own colors, Midnight's, whatever design the globe is in */
export const COLORS = {
  top: '#10243a',
  bottom: '#050b13',
  cream: '#efe7d8',
  muted: '#8296ab',
  label: '#7fa3c4',
  amber: '#e8a33d',
  ocean: MIDNIGHT.ocean,
  land: MIDNIGHT.land as string,
  border: MIDNIGHT.border,
  /** First visits green, as the "new" figure; the rest in the visited color, as on the globe */
  newPlace: MIDNIGHT.correct,
  again: MIDNIGHT.visited,
  glow: 'rgba(59, 130, 200, 0.45)',
}

export type Ctx = CanvasRenderingContext2D

/** A place on a card: new ones (first visited then) in green, the rest in the visited color */
export type CardPlace = { country: CountryFeature; isNew: boolean }

export function text(ctx: Ctx, words: string, x: number, y: number, font: string, color: string, spacing = 0) {
  ctx.font = font
  ctx.fillStyle = color
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`
  ctx.fillText(words, x, y)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'
}

/** Cut short with "…" to fit in `width`, in the font set: at a word, unless it's one, without what's left dangling, as "&" or "," */
function cutToFit(ctx: Ctx, words: string, width: number) {
  let shown = words
  const fits = () => ctx.measureText(shown).width <= width
  while (!fits() && shown.includes(' ')) shown = `${shown.slice(0, shown.lastIndexOf(' ')).replace(/[\s,&·–-]+$/, '')}…`
  while (!fits() && shown.length > 1) shown = `${shown.slice(0, -2).trimEnd()}…`
  return shown
}

type Sizes = { oneLine: [largest: number, smallest: number]; twoLines: [largest: number, smallest: number] }

/**
 * Text in `width`, on one line as big as it fits, in the sizes for one; else
 * on two, split where they're most even, as big as they fit. Still too long
 * at the smallest, the first line takes the words that fit, and the second
 * is cut short with "…". The lines, and their size, to draw.
 */
export function fitLines(ctx: Ctx, words: string, width: number, { oneLine, twoLines }: Sizes, font: (size: number) => string) {
  const fit = (lines: string[], size: number) => {
    ctx.font = font(size)
    return lines.every((line) => ctx.measureText(line).width <= width)
  }
  for (let size = oneLine[0]; size >= oneLine[1]; size -= 4) if (fit([words], size)) return { lines: [words], size }
  const [largest, smallest] = twoLines
  const parts = words.split(' ')
  ctx.font = font(smallest)
  const widest = (lines: string[]) => Math.max(...lines.map((line) => ctx.measureText(line).width))
  const splits = parts.slice(1).map((_, i) => [parts.slice(0, i + 1).join(' '), parts.slice(i + 1).join(' ')])
  const even = splits.reduce<string[]>((best, lines) => (widest(lines) < widest(best) ? lines : best), [words])
  for (let size = largest; size >= smallest; size -= 4) if (fit(even, size)) return { lines: even, size }
  // As many words as fit first, the rest cut short
  ctx.font = font(smallest)
  let first = 1
  while (first < parts.length && ctx.measureText(parts.slice(0, first + 1).join(' ')).width <= width) first++
  const lines = [cutToFit(ctx, parts.slice(0, first).join(' '), width), parts.slice(first).join(' ')].filter(Boolean)
  return { lines: lines.length > 1 ? [lines[0], cutToFit(ctx, lines[1], width)] : lines, size: smallest }
}

export function roundedRect(ctx: Ctx, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius)
  else ctx.rect(x, y, width, height)
}

/** The card's background, light at the top to dark */
export function drawBackground(ctx: Ctx) {
  const background = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  background.addColorStop(0, COLORS.top)
  background.addColorStop(1, COLORS.bottom)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
}

type LatLng = { lat: number; lng: number }

/**
 * The world from above `view`, its `places` colored, in a circle `radius`
 * wide, glowing: all of the globe, or for places close together, zoomed in
 * on them, as far as `reach` degrees out from the middle filling most of it.
 * Flights drawn over it as they go, along the great circle, with their ends.
 */
export function drawGlobe(
  ctx: Ctx,
  { places, view, reach = 90, flights = [] }: { places: readonly CardPlace[]; view: LatLng; reach?: number; flights?: readonly { from: LatLng; to: LatLng }[] },
  cx: number,
  cy: number,
  radius: number,
) {
  const glow = ctx.createRadialGradient(cx, cy, radius * 0.92, cx, cy, radius * 1.28)
  glow.addColorStop(0, COLORS.glow)
  glow.addColorStop(1, 'rgba(59, 130, 200, 0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(cx, cy, radius * 1.28, 0, Math.PI * 2)
  ctx.fill()

  // As near as shows the places, most of the way to the edge; never smaller than the whole globe
  const fill = Math.sin((Math.min(Math.max(reach, 1), 90) * Math.PI) / 180)
  const scale = Math.max(radius, (radius * 0.78) / fill)
  const projection = geoOrthographic().translate([cx, cy]).scale(scale).rotate([-view.lng, -view.lat]).clipAngle(90)
  const path = geoPath(projection, ctx)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()

  ctx.beginPath()
  path({ type: 'Sphere' })
  ctx.fillStyle = COLORS.ocean
  ctx.fill()

  const colors = new Map(places.map(({ country, isNew }) => [country, isNew ? COLORS.newPlace : COLORS.again]))
  for (const country of countries) {
    ctx.beginPath()
    path(country)
    ctx.fillStyle = colors.get(country) ?? COLORS.land
    ctx.fill()
  }
  ctx.beginPath()
  for (const country of countries) path(country)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 1.2
  ctx.stroke()

  if (flights.length > 0) {
    ctx.beginPath()
    for (const { from, to } of flights) path({ type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] })
    ctx.strokeStyle = COLORS.cream
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.fillStyle = COLORS.cream
    for (const point of flights.flatMap(({ from, to }) => [from, to])) {
      const at = projection([point.lng, point.lat])
      if (!at) continue
      ctx.beginPath()
      ctx.arc(at[0], at[1], 9, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Rows of flags: how many a row, and rows at most, how wide each is (and three quarters as high), and the gap between */
export type FlagRows = { aRow: number; rows: number; width: number; gap: number }

/** Up to 18 flags, big: the cards of a year or a trip */
const FLAG_ROWS: FlagRows = { aRow: 6, rows: 3, width: 132, gap: 20 }

/**
 * Rows for `count` flags in a room `width` by `height`: as big as all of
 * them fit, from `largest` wide down to `smallest`; at the smallest, as many
 * as fit, the rest as "+N".
 */
export function flagRowsFor(count: number, width: number, height: number, [largest, smallest]: [number, number]): FlagRows {
  let layout = FLAG_ROWS
  for (let flag = largest; flag >= smallest; flag -= 2) {
    const gap = Math.round(flag * 0.15)
    const aRow = Math.floor((width + gap) / (flag + gap))
    const rows = Math.floor((height + gap) / (flag * 0.75 + gap))
    layout = { aRow, rows, width: flag, gap }
    if (aRow * rows >= count) break
  }
  return layout
}

/** Places' flags, new ones ringed in green, in rows in the middle of the room below `area`; more than fit end in "+12" */
export function drawFlags(ctx: Ctx, places: readonly CardPlace[], flags: ReadonlyMap<CountryFeature, CanvasImageSource>, area: number, layout = FLAG_ROWS) {
  const { aRow, rows: rowsAtMost, width, gap } = layout
  const height = width * 0.75
  const corner = Math.round(width / 13)
  const room = aRow * rowsAtMost
  const shown = places.length > room ? places.slice(0, room - 1) : places
  const more = places.length - shown.length
  const tiles = shown.length + (more ? 1 : 0)
  const rows = Math.ceil(tiles / aRow)
  const roomHeight = rowsAtMost * height + (rowsAtMost - 1) * gap
  const top = area + (roomHeight - (rows * height + Math.max(rows - 1, 0) * gap)) / 2
  for (let i = 0; i < tiles; i++) {
    const row = Math.floor(i / aRow)
    const inRow = Math.min(aRow, tiles - row * aRow)
    const rowWidth = inRow * width + (inRow - 1) * gap
    const x = (CARD_WIDTH - rowWidth) / 2 + (i % aRow) * (width + gap)
    const y = top + row * (height + gap)
    const place = shown[i]
    if (!place) {
      roundedRect(ctx, x, y, width, height, corner)
      ctx.fillStyle = COLORS.land
      ctx.fill()
      ctx.textAlign = 'center'
      const size = Math.round(width * 0.3)
      text(ctx, `+${more}`, x + width / 2, y + height / 2 + size * 0.35, `600 ${size}px ${SANS}`, COLORS.cream)
      continue
    }
    const image = flags.get(place.country)
    ctx.save()
    roundedRect(ctx, x, y, width, height, corner)
    ctx.clip()
    if (image) ctx.drawImage(image, x, y, width, height)
    else {
      ctx.fillStyle = COLORS.land
      ctx.fillRect(x, y, width, height)
    }
    ctx.restore()
    roundedRect(ctx, x, y, width, height, corner)
    ctx.lineWidth = place.isNew ? 6 : 2
    ctx.strokeStyle = place.isNew ? COLORS.newPlace : 'rgba(255, 255, 255, 0.18)'
    ctx.stroke()
  }
}

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)
export const formatKm = (n: number) => `${Math.round(n).toLocaleString('en-US')} km`
