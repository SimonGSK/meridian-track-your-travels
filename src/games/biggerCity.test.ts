import { beforeAll, describe, expect, it } from 'vitest'
import { loadCities, type City } from '../data/cities'
import { MIN_PEOPLE, biggerCityPool, biggerOf, gapAfter, newBiggerCity, nextBigger, pickBigger } from './biggerCity'

let cities: City[]
beforeAll(async () => {
  cities = await loadCities()
}, 20_000)

const smallerOf = (game: ReturnType<typeof newBiggerCity>) => game.pair.find((city) => city !== biggerOf(game))!
const gapOf = (game: ReturnType<typeof newBiggerCity>) => biggerOf(game).population / smallerOf(game).population

describe('bigger city', () => {
  it('has every capital and every city of half a million people or more', () => {
    const pool = biggerCityPool(cities)
    expect(pool.every((city) => city.capital || city.population >= MIN_PEOPLE)).toBe(true)
    expect(pool.some((city) => city.name === 'Vatican City')).toBe(true)
    expect(pool.length).toBeGreaterThan(600)
  })

  it('starts with two cities, one with at least twice the people', () => {
    const game = newBiggerCity(cities)
    expect(game).toMatchObject({ kind: 'bigger', id: 'bigger-city', streak: 0, answer: null, finished: false })
    expect(game.seen).toEqual(game.pair)
    expect(gapOf(game)).toBeGreaterThanOrEqual(2)
  })

  it('goes on after a right pick, with two cities not shown yet, closer in size', () => {
    let game = newBiggerCity(cities)
    for (let streak = 1; streak <= 12; streak++) {
      game = pickBigger(game, biggerOf(game))
      expect(game.answer).toMatchObject({ correct: true })
      expect(game.streak).toBe(streak)
      const before = game.seen
      game = nextBigger(game)
      expect(game.pair.some((city) => before.includes(city))).toBe(false)
      expect(gapOf(game)).toBeGreaterThanOrEqual(gapAfter(streak))
    }
    expect(gapAfter(1)).toBeCloseTo(1.9)
    expect(gapAfter(20)).toBe(1.2)
  })

  it('ends the run at a wrong pick, and takes no other', () => {
    const game = newBiggerCity(cities, () => 0.4, 1_000)
    const wrong = pickBigger(game, smallerOf(game), 5_000)
    expect(wrong).toMatchObject({ streak: 0, finished: true, endedAt: 5_000, answer: { correct: false } })
    expect(nextBigger(wrong)).toBe(wrong)
    expect(pickBigger(wrong, biggerOf(wrong))).toBe(wrong)
    expect(pickBigger(game, cities.find((city) => !game.pair.includes(city))!)).toBe(game)
  })

  it('is a perfect run when no pair is left', () => {
    const [a, b] = biggerCityPool(cities).sort((x, y) => y.population - x.population)
    const game = { ...newBiggerCity(cities), pool: [a, b] as City[], pair: [a, b] as const, seen: [a, b] }
    const done = nextBigger(pickBigger(game, a), Math.random, 9_000)
    expect(done).toMatchObject({ finished: true, endedAt: 9_000, streak: 1 })
  })
})
