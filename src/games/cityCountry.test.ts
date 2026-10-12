import { beforeAll, describe, expect, it } from 'vitest'
import { countryOfCity, loadCities, type City } from '../data/cities'
import { answer, difficultiesOf, difficultyDescription } from './games'
import { newCityCountryGame } from './cityCountry'

let cities: City[]
beforeAll(async () => {
  cities = await loadCities()
}, 20_000)

/** The biggest city of a name, the one people mean */
const meant = (city: City) => cities.filter((c) => c.name === city.name).every((c) => c.population <= city.population)
/** A country's cities to ask about, the biggest first: not its capital, and the biggest of their names */
const othersIn = (city: City) =>
  cities
    .filter((c) => !c.capital && meant(c) && countryOfCity(c) === countryOfCity(city))
    .sort((a, b) => b.population - a.population)

describe('whose city?', () => {
  it('names a city in each round, never a capital, in the country to answer', () => {
    const game = newCityCountryGame('hard', cities)
    expect(game).toMatchObject({ kind: 'rounds', id: 'city-country', difficulty: 'hard' })
    expect(game.rounds).toHaveLength(10)
    for (const { city, target } of game.rounds) {
      expect(city!.capital).toBeUndefined()
      expect(countryOfCity(city!)).toBe(target)
    }
  })

  it("asks about each big country's biggest city on easy, with four countries to pick from", () => {
    const game = newCityCountryGame('easy', cities)
    for (const { city, target, options } of game.rounds) {
      expect(othersIn(city!)[0]).toBe(city)
      expect(target.properties.areaKm2).toBeGreaterThanOrEqual(100_000)
      expect(options).toHaveLength(4)
      expect(options).toContain(target)
    }
    expect(difficultyDescription('city-country', 'easy')).toBe('The biggest city of big countries, but not the capital. Pick from four answers.')
  })

  it('asks about one of the three biggest on medium, typed', () => {
    const game = newCityCountryGame('medium', cities)
    for (const { city, options } of game.rounds) {
      expect(othersIn(city!).slice(0, 3)).toContain(city)
      expect(options).toEqual([])
    }
    expect(difficultyDescription('city-country', 'medium')).toMatch(/Type your answers\.$/)
  })

  it('only asks about the biggest city of a name, the one people mean', () => {
    const names = (game: ReturnType<typeof newCityCountryGame>) => game.rounds.map(({ city }) => `${city!.name} ${city!.place}`)
    const asked = Array.from({ length: 40 }, () => names(newCityCountryGame('hard', cities))).flat()
    expect(asked).not.toContain('Barcelona VE')
    for (const round of newCityCountryGame('hard', cities).rounds) expect(meant(round.city!)).toBe(true)
  })

  it('is answered with the country', () => {
    const game = newCityCountryGame('easy', cities, () => 0.3)
    const { target } = game.rounds[0]
    expect(answer(game, target).answer).toMatchObject({ correct: true, points: 1 })
  })

  it('has no "all countries", as not every country has a city to ask about', () => {
    expect(difficultiesOf('city-country').map((d) => d.id)).toEqual(['easy', 'medium', 'hard'])
    expect(difficultiesOf('flags').map((d) => d.id)).toEqual(['easy', 'medium', 'hard', 'all'])
  })
})
