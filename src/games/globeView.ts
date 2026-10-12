import { countries, tinyPlaces, type CountryFeature } from '../countries'
import type { Theme } from '../globe/themes'
import { currentRound, kindOf } from './games'
import { missing } from './letterGame'
import { missingAll } from './allGame'
import { currentNeighbours, missingNeighbours } from './neighboursGame'
import type { GameState } from './useGame'

const NONE: ReadonlyMap<CountryFeature, string> = new Map()

/** A game is running (not yet on its results screen) */
export const isPlaying = (game: GameState | null): game is GameState & { finished: false } => !!game && !game.finished

/**
 * The globe shows the game: while playing, and for the letter hunt and
 * "name them all" also on the results (what was missed), and for higher or
 * lower and bigger city (the pair it ended on)
 */
export const showsGame = (game: GameState | null) =>
  isPlaying(game) || game?.kind === 'letter' || game?.kind === 'all' || game?.kind === 'higher' || game?.kind === 'bigger'

/** Island countries up to this size (km²) are hard to spot out in the ocean */
export const SMALL_ISLAND_KM2 = 30_000

/**
 * The letter hunt rings every tiny country and small island country, so
 * the ones out in the ocean can be found. All of them, not just the
 * answers, so the rings give nothing away.
 */
export const LETTER_HUNT_RINGS: readonly CountryFeature[] = countries.filter(
  ({ properties: p }) => p.kind === 'country' && (p.tiny || (p.island && p.areaKm2 < SMALL_ISLAND_KM2)),
)

/** The tiny countries, without the territories, which aren't part of the games */
export const TINY_COUNTRIES: readonly CountryFeature[] = tinyPlaces.filter((c) => c.properties.kind === 'country')
const NO_RINGS: readonly CountryFeature[] = []

/**
 * The rings a game wants on the globe: only around countries, if the rings
 * are on, and in the letter hunt around the small islands too, always. Null
 * without a game on the globe.
 */
export function gameRings(game: GameState | null, ringsOn: boolean) {
  if (!showsGame(game)) return null
  if (game?.kind === 'letter') return LETTER_HUNT_RINGS
  return ringsOn ? TINY_COUNTRIES : NO_RINGS
}

/** You answer by clicking the globe: finding a country or a city, or hunting for a letter */
export function globeAnswers(game: GameState | null) {
  if (!isPlaying(game)) return false
  if (game.kind === 'city') return !game.guess
  return game.kind === 'letter' || (game.kind === 'rounds' && kindOf(game) === 'find' && !game.answer)
}

/** Countries colored by the game: answers, the country asked about, letter-hunt finds and misses */
export function gameHighlights(game: GameState | null, theme: Theme): ReadonlyMap<CountryFeature, string> {
  if (!game || !showsGame(game)) return NONE
  const colors = new Map<CountryFeature, string>()
  if (game.kind === 'all') {
    for (const country of game.found) colors.set(country, theme.correct)
    if (game.finished) for (const country of missingAll(game)) colors.set(country, theme.selected)
    return colors
  }
  if (game.kind === 'letter') {
    for (const country of game.found) colors.set(country, theme.correct)
    if (game.finished) for (const country of missing(game)) colors.set(country, theme.selected)
    else if (game.last?.result === 'wrong-letter') colors.set(game.last.country, theme.wrong)
    return colors
  }
  // Finding a city marks it with a pin, not a country, as does bigger city its two
  if (game.kind === 'city' || game.kind === 'bigger') return NONE
  if (game.kind === 'neighbours') {
    // The country asked about, its neighbours named, and once the round is over those missed
    colors.set(currentNeighbours(game).country, theme.selected)
    for (const country of game.found) colors.set(country, theme.correct)
    if (game.roundOver) for (const country of missingNeighbours(game)) colors.set(country, theme.wrong)
    return colors
  }
  if (game.kind === 'higher') {
    // The one to beat, and the one to guess about, green or red once guessed
    colors.set(game.known, theme.selected)
    colors.set(game.next, game.answer ? (game.answer.correct ? theme.correct : theme.wrong) : theme.flight)
    return colors
  }
  const { target } = currentRound(game)
  for (const miss of game.misses) colors.set(miss, theme.wrong)
  if (game.answer) {
    if (!game.answer.correct && game.answer.picked) colors.set(game.answer.picked, theme.wrong)
    colors.set(target, theme.correct)
  } else if (kindOf(game) === 'name' || kindOf(game) === 'capital') {
    colors.set(target, theme.selected)
  }
  return colors
}

/**
 * Where the camera should go: the country asked about ("name that country",
 * the capital quiz), the answer once given, or in higher or lower the
 * country to guess about
 */
export function flightTarget(game: GameState | null): CountryFeature | null {
  if (!isPlaying(game)) return null
  if (game.kind === 'higher') return game.next
  if (game.kind !== 'rounds') return null
  return game.answer || kindOf(game) === 'name' || kindOf(game) === 'capital' ? currentRound(game).target : null
}

/** Changes whenever the view should zoom out to show the whole globe: each "find" round and each letter hunt */
export function overviewKey(game: GameState | null): string | null {
  if (!isPlaying(game)) return null
  if (game.kind === 'letter') return `letter-${game.letter}`
  if (game.kind === 'city') return game.guess ? null : `city-${game.index}`
  if (game.kind === 'all') return `all-${game.scope}`
  return game.kind === 'rounds' && kindOf(game) === 'find' && !game.answer ? `find-${game.index}` : null
}
