import { beforeAll, describe, expect, it } from 'vitest'
import { loadCities, type City } from '../data/cities'
import {
  MAX_CITY_POINTS,
  cityPool,
  currentCity,
  formatKm,
  guessCity,
  maxCityScore,
  newCityGame,
  nextCity,
  pointsForDistance,
  skipCity,
  spotOnKm,
  type CityGameState,
} from './cityGame'

let cities: City[]
beforeAll(async () => {
  cities = await loadCities()
}, 20_000)

const names = (rounds: { city: City }[]) => rounds.map((r) => r.city.name)
/** A random number generator that always picks the first */
const first = () => 0

describe('pointsForDistance', () => {
  it('gives every point within 20 km, and fewer the farther off', () => {
    expect(pointsForDistance(0)).toBe(100)
    expect(pointsForDistance(20)).toBe(100)
    expect(pointsForDistance(100)).toBe(90)
    expect(pointsForDistance(500)).toBe(55)
    expect(pointsForDistance(1000)).toBe(29)
    expect(pointsForDistance(2000)).toBe(8)
    expect(pointsForDistance(10_000)).toBe(0)
  })

  it('gives every point as far as a big city reaches, and fewer from there', () => {
    expect(pointsForDistance(60, 65)).toBe(100)
    expect(pointsForDistance(65, 65)).toBe(100)
    expect(pointsForDistance(145, 65)).toBe(pointsForDistance(100))
  })
})

describe('spotOnKm', () => {
  it('is 20 km, or as far as a big city reaches, by its built-up land', () => {
    const named = (name: string) => cities.find((c) => c.name === name)!
    expect(spotOnKm(named('Tokyo'))).toBeGreaterThan(50)
    expect(spotOnKm(named('New York City'))).toBeGreaterThan(40)
    expect(spotOnKm(named('Paris'))).toBeGreaterThan(25)
    // Next to Tokyo, Yokohama doesn't reach into it
    expect(spotOnKm(named('Yokohama'))).toBe(20)
    expect(spotOnKm(named('Reykjavík'))).toBe(20)
    expect(spotOnKm(named('Vatican City'))).toBe(20)
  })
})

describe('cityPool', () => {
  it('asks about the capitals of big countries on easy, with their countries', () => {
    const easy = cityPool('easy', cities)
    expect(names(easy)).toContain('Canberra')
    expect(names(easy)).not.toContain('Copenhagen') // Denmark is small
    expect(easy.find((r) => r.city.name === 'Canberra')!.country.properties.name).toBe('Australia')
    expect(easy.every((r) => r.city.capital)).toBe(true)
  })

  it("asks about every country's capital on medium, but not a territory's", () => {
    const medium = names(cityPool('medium', cities))
    expect(medium).toEqual(expect.arrayContaining(['Copenhagen', 'Canberra', 'Vaduz']))
    expect(medium).not.toContain('Nuuk') // Greenland is a territory
    expect(medium.length).toBeGreaterThan(180)
  })

  it('asks about big cities that are not capitals on hard', () => {
    const hard = cityPool('hard', cities)
    expect(names(hard)).toEqual(expect.arrayContaining(['Sydney', 'Chicago', 'Mumbai']))
    expect(names(hard)).not.toContain('Tokyo')
    expect(hard.every((r) => !r.city.capital && r.city.population >= 1_000_000)).toBe(true)
  })
})

describe('a game', () => {
  const start = (): CityGameState => newCityGame('medium', cities, Math.random, 1_000)

  it('has ten different cities from the level', () => {
    const game = start()
    expect(game.rounds).toHaveLength(10)
    expect(new Set(names(game.rounds)).size).toBe(10)
    expect(maxCityScore(game)).toBe(10 * MAX_CITY_POINTS)
    expect(game).toMatchObject({ kind: 'city', id: 'city', level: 'medium', index: 0, score: 0, guess: null })
  })

  it('scores a click by how far off it is, once a round', () => {
    const game = newCityGame('medium', cities, first)
    const { city } = currentCity(game)
    const near = guessCity(game, { lat: city.lat + 0.1, lng: city.lng }) // about 11 km north
    expect(near.guess).toMatchObject({ points: 100 })
    expect(near.guess!.km).toBeCloseTo(11.1, 0)
    expect(near.score).toBe(100)
    expect(near.scores).toEqual([100])
    expect(guessCity(near, { lat: 0, lng: 0 })).toBe(near)
  })

  it('counts a click anywhere in a big city as spot on', () => {
    const tokyo = cityPool('medium', cities).find((round) => round.city.name === 'Tokyo')!
    const game: CityGameState = { ...newCityGame('medium', cities, first), rounds: [tokyo] }
    const west = guessCity(game, { lat: tokyo.city.lat, lng: tokyo.city.lng - 0.45 }) // about 40 km west
    expect(west.guess!.km).toBeGreaterThan(35)
    expect(west.guess!.points).toBe(100)
  })

  it("gives no points for I don't know", () => {
    const skipped = skipCity(newCityGame('easy', cities, first))
    expect(skipped.guess).toEqual({ position: null, km: null, points: 0 })
    expect(skipped.scores).toEqual([0])
    expect(skipCity(skipped)).toBe(skipped)
  })

  it('moves on once answered, and ends after the last city, stopping the clock at the last answer', () => {
    let game = start()
    expect(nextCity(game)).toBe(game) // not answered yet
    for (let i = 0; i < 9; i++) game = nextCity(skipCity(game, 2_000))
    expect(game.index).toBe(9)
    expect(game.endedAt).toBeNull()
    game = skipCity(game, 5_000)
    expect(game.endedAt).toBe(5_000)
    game = nextCity(game)
    expect(game.finished).toBe(true)
    expect(guessCity(game, { lat: 0, lng: 0 })).toBe(game)
  })
})

describe('formatKm', () => {
  it('rounds to whole kilometres', () => {
    expect(formatKm(0.4)).toBe('under 1 km')
    expect(formatKm(419.6)).toBe('420 km')
    expect(formatKm(12_345.2)).toBe('12,345 km')
  })
})
