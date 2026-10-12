import type { City } from '../data/cities'
import { shuffle } from './games'

/**
 * Bigger city: two cities, and you pick the one with more people. Right,
 * and two more; wrong, and the run is over. The score is how many in a row.
 * The pairs get closer in size as the streak grows: at first one has at
 * least twice the people of the other, later only a fifth more. Populations
 * are GeoNames', for the city itself rather than its metro area.
 */

export type BiggerCityState = {
  kind: 'bigger'
  id: 'bigger-city'
  /** The two cities, in the order shown */
  pair: readonly [City, City]
  /** Right picks in a row */
  streak: number
  /** The city picked, once it is */
  answer: { picked: City; correct: boolean } | null
  /** Every city shown so far, so none comes twice in a run */
  seen: readonly City[]
  /** The cities in the game */
  pool: readonly City[]
  /** Over at the first wrong pick, or when no pair is left */
  finished: boolean
  startedAt: number
  endedAt: number | null
}

type Random = () => number

/** Cities of at least this many people are in the game, and every capital */
export const MIN_PEOPLE = 500_000
/** How many times the people of the smaller city the bigger has, at least, at first */
const FIRST_GAP = 2
/** How much closer each right pick brings them, down to the closest */
const CLOSER_BY = 0.1
const CLOSEST_GAP = 1.2

/** How much bigger one of the pair is, at least, after this many right picks */
export const gapAfter = (streak: number) => Math.max(CLOSEST_GAP, FIRST_GAP - streak * CLOSER_BY)

/** The cities in the game */
export const biggerCityPool = (cities: readonly City[]) => cities.filter((city) => city.capital || city.population >= MIN_PEOPLE)

/** Two cities not shown yet, one at least `gap` times the other, or null when no such pair is left */
function pickPair(pool: readonly City[], seen: readonly City[], gap: number, random: Random): [City, City] | null {
  const fresh = pool.filter((city) => !seen.includes(city))
  for (const first of shuffle(fresh, random)) {
    const others = fresh.filter(
      (other) =>
        other !== first &&
        Math.max(first.population, other.population) >= gap * Math.min(first.population, other.population),
    )
    if (others.length) return [first, others[Math.floor(random() * others.length)]]
  }
  return null
}

export function newBiggerCity(cities: readonly City[], random: Random = Math.random, now = Date.now()): BiggerCityState {
  const pool = biggerCityPool(cities)
  const pair = pickPair(pool, [], gapAfter(0), random)!
  return {
    kind: 'bigger',
    id: 'bigger-city',
    pair,
    streak: 0,
    answer: null,
    seen: pair,
    pool,
    finished: false,
    startedAt: now,
    endedAt: null,
  }
}

/** The one of the pair with more people */
export const biggerOf = ({ pair: [a, b] }: Pick<BiggerCityState, 'pair'>) => (a.population >= b.population ? a : b)

/** Pick a city: a wrong pick ends the run */
export function pickBigger(game: BiggerCityState, picked: City, now = Date.now()): BiggerCityState {
  if (game.answer || game.finished || !game.pair.includes(picked)) return game
  const correct = picked === biggerOf(game)
  return {
    ...game,
    answer: { picked, correct },
    streak: correct ? game.streak + 1 : game.streak,
    finished: !correct,
    endedAt: correct ? null : now,
  }
}

/** After a right pick: two more cities, a little closer in size */
export function nextBigger(game: BiggerCityState, random: Random = Math.random, now = Date.now()): BiggerCityState {
  if (!game.answer?.correct || game.finished) return game
  const pair = pickPair(game.pool, game.seen, gapAfter(game.streak), random)
  // No pair left: a perfect run
  if (!pair) return { ...game, finished: true, endedAt: now }
  return { ...game, pair, answer: null, seen: [...game.seen, ...pair] }
}
