import type { CountryFeature } from '../countries'
import { countryOfCity, type City } from '../data/cities'
import { distanceKm } from '../data/flights'
import type { LatLng } from '../globe/interaction'
import { ROUNDS, shuffle } from './games'

/**
 * Find the city: a city is named, with its country, and you click where it
 * is on the globe, land or sea. The closer, the more points: all of them
 * within SPOT_ON_KM, or anywhere in a big city that reaches farther, fewer
 * the farther off.
 */

export type CityLevel = 'easy' | 'medium' | 'hard'

export const CITY_LEVELS: { id: CityLevel; label: string; cities: string }[] = [
  { id: 'easy', label: 'Easy', cities: 'Capitals of big countries' },
  { id: 'medium', label: 'Medium', cities: "Every country's capital" },
  { id: 'hard', label: 'Hard', cities: 'Cities of a million people or more that are not capitals' },
]

/** The most points a city is worth, for a click this close or closer */
export const MAX_CITY_POINTS = 100
export const SPOT_ON_KM = 20
/** How fast the points fall off: about a third are left this far beyond spot on */
const FALL_OFF_KM = 800

/** How far from a city's point a click is spot on: within SPOT_ON_KM, or anywhere in a city that reaches farther */
export const spotOnKm = (city: City) => Math.max(SPOT_ON_KM, city.radiusKm ?? 0)

/** 100 points within 20 km (or as far as is spot on); 90 at 100 km, 55 at 500, 29 at 1,000, 8 at 2,000, beyond that */
export const pointsForDistance = (km: number, spotOn = SPOT_ON_KM) =>
  km <= spotOn ? MAX_CITY_POINTS : Math.round(MAX_CITY_POINTS * Math.exp(-(km - spotOn) / FALL_OFF_KM))

/** Countries at least this big (km²) have their capitals in the easy level */
const EASY_MIN_KM2 = 100_000
/** Hard is the big cities */
const HARD_MIN_PEOPLE = 1_000_000

export type CityRound = { city: City; country: CountryFeature }

export type CityGuess = {
  /** Where you clicked, or null when you didn't know */
  position: LatLng | null
  /** How far off, or null when you didn't know */
  km: number | null
  points: number
}

export type CityGameState = {
  kind: 'city'
  id: 'city'
  level: CityLevel
  rounds: CityRound[]
  index: number
  score: number
  /** The points won in each round, once it's over */
  scores: number[]
  /** Set once the current round is over */
  guess: CityGuess | null
  finished: boolean
  startedAt: number
  /** When the last city was answered: the run's time ends there */
  endedAt: number | null
}

/** The cities a level asks about, each with its country (territories aren't in the games) */
export function cityPool(level: CityLevel, cities: readonly City[]): CityRound[] {
  return cities.flatMap((city) => {
    const country = countryOfCity(city)
    if (!country || country.properties.kind !== 'country') return []
    const fits =
      level === 'easy'
        ? city.capital && country.properties.areaKm2 >= EASY_MIN_KM2
        : level === 'medium'
          ? city.capital
          : !city.capital && city.population >= HARD_MIN_PEOPLE
    return fits ? [{ city, country }] : []
  })
}

export function newCityGame(
  level: CityLevel,
  cities: readonly City[],
  random: () => number = Math.random,
  now = Date.now(),
): CityGameState {
  return {
    kind: 'city',
    id: 'city',
    level,
    rounds: shuffle(cityPool(level, cities), random).slice(0, ROUNDS),
    index: 0,
    score: 0,
    scores: [],
    guess: null,
    finished: false,
    startedAt: now,
    endedAt: null,
  }
}

export const currentCity = (game: CityGameState) => game.rounds[game.index]

/** The most points a game can score */
export const maxCityScore = (game: CityGameState) => game.rounds.length * MAX_CITY_POINTS

const isLast = (game: CityGameState) => game.index === game.rounds.length - 1

/** Clicked somewhere on the globe: how far off, and the points for it. Once a round. */
export function guessCity(game: CityGameState, position: LatLng, now = Date.now()): CityGameState {
  if (game.guess || game.finished) return game
  const { city } = currentCity(game)
  const km = distanceKm(position, city)
  const points = pointsForDistance(km, spotOnKm(city))
  return {
    ...game,
    guess: { position, km, points },
    score: game.score + points,
    scores: [...game.scores, points],
    endedAt: isLast(game) ? now : null,
  }
}

/** "I don't know": no points, and the city is shown */
export function skipCity(game: CityGameState, now = Date.now()): CityGameState {
  if (game.guess || game.finished) return game
  return { ...game, guess: { position: null, km: null, points: 0 }, scores: [...game.scores, 0], endedAt: isLast(game) ? now : null }
}

/** On to the next city once this one is answered, or to the results after the last */
export function nextCity(game: CityGameState): CityGameState {
  if (!game.guess) return game
  if (isLast(game)) return { ...game, finished: true }
  return { ...game, index: game.index + 1, guess: null }
}

const whole = new Intl.NumberFormat('en-US')

/** "420 km", "under 1 km" */
export const formatKm = (km: number) => (km < 1 ? 'under 1 km' : `${whole.format(Math.round(km))} km`)
