import { geoEqualEarth, geoPath } from 'd3-geo'
import { countries, type CountryFeature } from '../countries'
import { shareLine, type AtlasPoster } from './atlasPoster'
import {
  CARD_WIDTH,
  COLORS,
  MONO,
  SANS,
  SERIF,
  drawBackground,
  drawFlags,
  flagRowsFor,
  formatKm,
  plural,
  text,
  type CardPlace,
  type Ctx,
} from './cardDrawing'
import { percentLabel } from './percentLabel'

/** The map's room on the card */
const MAP = { left: 40, top: 630, right: CARD_WIDTH - 40, bottom: 1150 }
/** The flags' room: as many as there are, as big as they fit */
const FLAGS = { top: 1470, width: 1000, height: 280 }

/**
 * The whole world, flat, its edge in the Bering Strait so Russia and Fiji
 * stay whole: the places been to colored, and each route flown drawn over
 * it, along the great circle
 */
function drawMap(ctx: Ctx, places: readonly CardPlace[], routes: AtlasPoster['routes']) {
  const projection = geoEqualEarth()
    .rotate([-11, 0])
    .fitExtent(
      [
        [MAP.left, MAP.top],
        [MAP.right, MAP.bottom],
      ],
      { type: 'Sphere' },
    )
  const path = geoPath(projection, ctx)

  ctx.save()
  ctx.shadowColor = COLORS.glow
  ctx.shadowBlur = 48
  ctx.beginPath()
  path({ type: 'Sphere' })
  ctx.fillStyle = COLORS.ocean
  ctx.fill()
  ctx.restore()

  const been = new Set(places.map(({ country }) => country))
  for (const country of countries) {
    ctx.beginPath()
    path(country)
    ctx.fillStyle = been.has(country) ? COLORS.again : COLORS.land
    ctx.fill()
  }
  ctx.beginPath()
  for (const country of countries) path(country)
  ctx.strokeStyle = COLORS.border
  ctx.lineWidth = 0.8
  ctx.stroke()

  if (routes.length > 0) {
    ctx.beginPath()
    for (const { from, to } of routes) path({ type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] })
    ctx.strokeStyle = 'rgba(239, 231, 216, 0.7)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.stroke()
  }
}

/**
 * Your atlas, all of it, as a poster to keep or share: how many of the
 * world's countries, a map of the world with every place been to and every
 * route flown, how many territories, continents and cities, how much of the
 * world's people and land the places are, their flags, and the flights.
 */
export function drawAtlasPoster(ctx: Ctx, poster: AtlasPoster, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) {
  drawBackground(ctx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const middle = CARD_WIDTH / 2

  text(ctx, 'MERIDIAN', middle, 118, `500 28px ${MONO}`, COLORS.label, 10)
  text(ctx, 'Your atlas', middle, 218, `400 60px ${SERIF}`, COLORS.muted)
  text(ctx, String(poster.countries), middle, 440, `700 220px ${SERIF}`, COLORS.cream)
  text(ctx, `${plural(poster.countries, 'country', 'countries')} of ${poster.countryTotal}`, middle, 518, `400 64px ${SERIF}`, COLORS.amber)
  text(ctx, `${percentLabel(poster.countries, poster.countryTotal)} OF THE WORLD'S COUNTRIES`, middle, 578, `500 26px ${MONO}`, COLORS.amber, 6)

  drawMap(ctx, poster.places, poster.routes)

  const stats: [number, string][] = [
    [poster.territories, plural(poster.territories, 'TERRITORY', 'TERRITORIES')],
    [poster.continents, plural(poster.continents, 'CONTINENT', 'CONTINENTS')],
    [poster.cities, plural(poster.cities, 'CITY', 'CITIES')],
  ]
  stats.forEach(([value, label], i) => {
    const x = middle + (i - 1) * 330
    text(ctx, String(value), x, 1290, `700 112px ${SERIF}`, COLORS.amber)
    text(ctx, label, x, 1340, `500 26px ${MONO}`, COLORS.muted, 5)
  })
  if (poster.places.length) text(ctx, shareLine(poster.share), middle, 1425, `500 34px ${SANS}`, COLORS.cream)

  drawFlags(ctx, poster.places, flags, FLAGS.top, flagRowsFor(poster.places.length, FLAGS.width, FLAGS.height, [120, 56]))
  ctx.textAlign = 'center'

  // "38 trips since 2016"
  const trips = poster.trips ? `${poster.trips} ${plural(poster.trips, 'trip')}` : null
  const travels = [trips, poster.since && `${trips ? 'since' : 'Since'} ${poster.since}`].filter(Boolean).join(' ')
  if (poster.flights) {
    const laps = poster.laps >= 0.1 ? ` · ${poster.laps.toFixed(1)}× around the Earth` : ''
    text(ctx, `✈ ${poster.flights} ${plural(poster.flights, 'flight')} · ${formatKm(poster.km)}${laps}`, middle, 1810, `500 36px ${SANS}`, COLORS.cream)
    if (travels) text(ctx, travels, middle, 1862, `400 30px ${SANS}`, COLORS.muted)
  } else if (travels) text(ctx, travels, middle, 1830, `500 34px ${SANS}`, COLORS.cream)
}
