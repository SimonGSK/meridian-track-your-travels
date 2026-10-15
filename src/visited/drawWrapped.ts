import type { CountryFeature } from '../countries'
import { CARD_WIDTH, COLORS, MONO, SANS, SERIF, drawBackground, drawFlags, drawGlobe, formatKm, plural, text, type Ctx } from './cardDrawing'
import type { Wrapped } from './wrapped'

export { CARD_HEIGHT, CARD_WIDTH } from './cardDrawing'

/**
 * A year, wrapped, as a card to keep or share: the year, a globe of its
 * places, how many countries (and how many new) on how many continents, the
 * flags of its places, and its flights.
 */
export function drawWrapped(ctx: Ctx, w: Wrapped, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) {
  drawBackground(ctx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const middle = CARD_WIDTH / 2

  text(ctx, 'MERIDIAN', middle, 118, `500 28px ${MONO}`, COLORS.label, 10)
  text(ctx, 'Your', middle, 236, `400 60px ${SERIF}`, COLORS.muted)
  text(ctx, String(w.year), middle, 430, `700 220px ${SERIF}`, COLORS.cream)
  text(ctx, 'wrapped', middle, 510, `400 64px ${SERIF}`, COLORS.amber)
  if (w.mostTravelled) text(ctx, 'YOUR MOST TRAVELLED YEAR', middle, 570, `500 26px ${MONO}`, COLORS.amber, 6)

  drawGlobe(ctx, { places: w.places, view: w.view }, middle, 890, 280)

  const stats: [number, string][] = [
    [w.countries, plural(w.countries, 'COUNTRY', 'COUNTRIES')],
    [w.newPlaces, 'NEW'],
    [w.continents, plural(w.continents, 'CONTINENT', 'CONTINENTS')],
  ]
  stats.forEach(([value, label], i) => {
    const x = middle + (i - 1) * 330
    text(ctx, String(value), x, 1300, `700 112px ${SERIF}`, i === 1 ? COLORS.newPlace : COLORS.amber)
    text(ctx, label, x, 1350, `500 26px ${MONO}`, COLORS.muted, 5)
  })

  drawFlags(ctx, w.places, flags, 1400)
  ctx.textAlign = 'center'

  if (w.flights) {
    const laps = w.laps >= 0.1 ? ` · ${w.laps.toFixed(1)}× around the Earth` : ''
    text(ctx, `✈ ${w.flights} ${plural(w.flights, 'flight')} · ${formatKm(w.km)}${laps}`, middle, 1805, `500 36px ${SANS}`, COLORS.cream)
    if (w.longest) {
      text(ctx, `Longest: ${w.longest.from} → ${w.longest.to} · ${formatKm(w.longest.km)}`, middle, 1858, `400 30px ${SANS}`, COLORS.muted)
    }
  } else if (w.busiestMonth) {
    const n = w.busiestMonth.places
    text(ctx, `Busiest month: ${w.busiestMonth.name}, ${n} ${plural(n, 'place')}`, middle, 1830, `500 34px ${SANS}`, COLORS.cream)
  }
}
