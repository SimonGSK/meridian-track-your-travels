import type { CountryFeature } from '../countries'
import { countryOfCity, type City } from '../data/cities'
import { gamePool, newRoundGame, type Difficulty, type RoundGameState } from './games'

/**
 * Whose city? A city is named, and you say which country it's in: picking
 * from four on easy, typing on medium and hard. Never a capital, as that's
 * "whose capital?", and only the biggest city of a name, the one people mean
 * (Barcelona in Spain, not Venezuela). Easy asks each big country's biggest
 * city, medium one of its three biggest, and hard any city, even the small
 * ones people know.
 */

type Random = () => number

/** How many of a country's biggest cities a difficulty asks about; hard asks about them all */
const BIGGEST: Partial<Record<Difficulty, number>> = { easy: 1, medium: 3 }

/** The biggest city of each name */
const biggestNamed = (cities: readonly City[]) => {
  const named = new Map<string, City>()
  for (const city of cities) if (city.population > (named.get(city.name)?.population ?? -1)) named.set(city.name, city)
  return new Set(named.values())
}

/** Each country's cities to ask about, the biggest first: not its capital, and only the biggest of a name */
function citiesByCountry(cities: readonly City[]) {
  const byCountry = new Map<CountryFeature, City[]>()
  const meant = biggestNamed(cities)
  for (const city of cities) {
    const country = countryOfCity(city)
    if (!country || city.capital || !meant.has(city)) continue
    byCountry.set(country, [...(byCountry.get(country) ?? []), city])
  }
  for (const list of byCountry.values()) list.sort((a, b) => b.population - a.population)
  return byCountry
}

export function newCityCountryGame(
  difficulty: Difficulty,
  cities: readonly City[],
  random: Random = Math.random,
  now = Date.now(),
): RoundGameState {
  const byCountry = citiesByCountry(cities)
  const asked = (country: CountryFeature) => (byCountry.get(country) ?? []).slice(0, BIGGEST[difficulty])
  // The countries with a city to ask about
  const pool = gamePool('city-country', difficulty).filter((country) => asked(country).length > 0)
  const game = newRoundGame('city-country', difficulty, random, pool, now)
  return {
    ...game,
    rounds: game.rounds.map((round) => {
      const choices = asked(round.target)
      return { ...round, city: choices[Math.floor(random() * choices.length)] }
    }),
  }
}
