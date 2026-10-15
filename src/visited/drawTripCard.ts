import type { CountryFeature } from '../countries'
import { CARD_WIDTH, COLORS, MONO, SANS, SERIF, drawBackground, drawFlags, drawGlobe, fitLines, formatKm, plural, text, type Ctx } from './cardDrawing'
import type { TripCard } from './tripCard'

/**
 * A trip, as a card to keep or share: its name (or where it went) and when,
 * a globe of its places and flights, zoomed in on them, how many countries
 * (and how many new) and flights, its places' flags in the order it went,
 * and how far it flew.
 */
export function drawTripCard(ctx: Ctx, card: TripCard, flags: ReadonlyMap<CountryFeature, CanvasImageSource>) {
  drawBackground(ctx)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const middle = CARD_WIDTH / 2

  text(ctx, 'MERIDIAN', middle, 118, `500 28px ${MONO}`, COLORS.label, 10)
  // Its name on one line, or two for a long one, the rest of the top made room for
  const title = (size: number) => `700 ${size}px ${SERIF}`
  const { lines, size } = fitLines(ctx, card.title, 960, { oneLine: [120, 72], twoLines: [96, 64] }, title)
  const [label, top] = lines.length > 1 ? [200, 300] : [220, 350]
  const lineHeight = Math.round(size * 1.05)
  text(ctx, card.toCome ? 'Coming up' : 'A trip', middle, label, `400 56px ${SERIF}`, COLORS.muted)
  lines.forEach((line, i) => text(ctx, line, middle, top + i * lineHeight, title(size), COLORS.cream))
  const when = top + (lines.length - 1) * lineHeight + 90
  if (card.when) text(ctx, [card.when, card.toCome].filter(Boolean).join(' · '), middle, when, `400 60px ${SERIF}`, COLORS.amber)

  drawGlobe(ctx, card, middle, 830, 310)

  const stats: [number, string, string][] = [
    [card.countries, plural(card.countries, 'COUNTRY', 'COUNTRIES'), COLORS.amber],
    [card.newPlaces, 'NEW', COLORS.newPlace],
    [card.flights.length, plural(card.flights.length, 'FLIGHT', 'FLIGHTS'), COLORS.amber],
  ]
  stats.forEach(([value, label, color], i) => {
    const x = middle + (i - 1) * 330
    text(ctx, String(value), x, 1300, `700 112px ${SERIF}`, color)
    text(ctx, label, x, 1350, `500 26px ${MONO}`, COLORS.muted, 5)
  })

  drawFlags(ctx, card.places, flags, 1400)
  ctx.textAlign = 'center'

  if (card.flights.length) {
    const laps = card.laps >= 0.1 ? ` · ${card.laps.toFixed(1)}× around the Earth` : ''
    text(ctx, `✈ ${formatKm(card.km)} flown${laps}`, middle, 1805, `500 36px ${SANS}`, COLORS.cream)
    if (card.longest && card.flights.length > 1) {
      text(ctx, `Longest: ${card.longest.from} → ${card.longest.to} · ${formatKm(card.longest.km)}`, middle, 1858, `400 30px ${SANS}`, COLORS.muted)
    }
  }
}
