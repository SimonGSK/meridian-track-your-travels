import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { City } from '../data/cities'
import { CityLevelChoice, CityPlay, CityResults } from './CityPanel'
import { guessCity, newCityGame, nextCity, skipCity, type CityGameState } from './cityGame'

const city = (name: string, place: string, lat: number, lng: number): City => ({ id: lat * 1000 + lng, name, place, lat, lng, population: 1_000_000, capital: true })
const CITIES = [city('Canberra', 'AU', -35.28, 149.13), city('Ottawa', 'CA', 45.42, -75.7)]
const start = (): CityGameState => newCityGame('easy', CITIES, () => 0.99, 0)

function play(game: CityGameState) {
  const props = { onDontKnow: vi.fn(), onNext: vi.fn(), onQuit: vi.fn() }
  render(<CityPlay game={game} {...props} />)
  return props
}
const feedback = () => screen.getByRole('status')

describe('CityLevelChoice', () => {
  it('offers three levels, with the best scores and record times', async () => {
    const onStart = vi.fn()
    render(<CityLevelChoice best={{ 'city:medium': 640 }} bestTimes={{}} onStart={onStart} onBack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveTextContent('Capitals of big countries.')
    expect(screen.getByRole('button', { name: /^Medium/ })).toHaveTextContent('Best: 640 / 1000 points')
    await userEvent.click(screen.getByRole('button', { name: /^Hard/ }))
    expect(onStart).toHaveBeenCalledWith('hard')
  })
})

describe('CityPlay', () => {
  it('names the city and its country, and asks for a click', () => {
    const game = start()
    play(game)
    const { name } = game.rounds[0].city
    expect(screen.getByText('Click where this city is on the globe').nextElementSibling).toHaveTextContent(name)
    expect(screen.getByText(name === 'Canberra' ? 'Australia' : 'Canada')).toBeInTheDocument()
    expect(screen.getByText('Round 1 of 2')).toBeInTheDocument()
    expect(feedback()).toHaveTextContent('')
  })

  it('says how far off a click was, and the points', () => {
    const game = start()
    const { lat, lng } = game.rounds[0].city
    play(guessCity(game, { lat: lat + 5, lng }))
    expect(feedback()).toHaveTextContent(/^Off by 55\d km\. \+5\d points$/)
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
  })

  it('cheers a click spot on, in green', () => {
    const game = start()
    const { lat, lng } = game.rounds[0].city
    play(guessCity(game, { lat, lng: lng + 0.05 }))
    expect(feedback()).toHaveTextContent(/^Spot on! \d km away\. \+100 points$/)
    expect(feedback()).toHaveClass('correct')
  })

  it('cheers a click in a big city, farther from its center', () => {
    const game = newCityGame('easy', [{ ...CITIES[0], radiusKm: 30 }], () => 0, 0)
    const { lat, lng } = game.rounds[0].city
    play(guessCity(game, { lat: lat + 0.22, lng })) // about 24 km north
    expect(feedback()).toHaveTextContent(/^In Canberra! 2\d km from its center\. \+100 points$/)
    expect(feedback()).toHaveClass('correct')
  })

  it("shows where it is after \"I don't know\"", async () => {
    const game = start()
    const { onDontKnow } = play(game)
    await userEvent.click(screen.getByRole('button', { name: "I don't know" }))
    expect(onDontKnow).toHaveBeenCalled()
  })

  it('goes on to the results after the last city', () => {
    const last = skipCity(nextCity(skipCity(start())))
    play(last)
    expect(feedback()).toHaveTextContent(`${last.rounds[1].city.name} is marked on the globe`)
    expect(screen.getByRole('button', { name: 'See results' })).toBeInTheDocument()
  })
})

describe('CityResults', () => {
  it('shows the score, each city with its points, and a new best', async () => {
    const game = start()
    const { lat, lng } = game.rounds[0].city
    const done = nextCity(skipCity(nextCity(guessCity(game, { lat, lng }))))
    const onStart = vi.fn()
    render(<CityResults game={done} previousBest={50} previousTime={undefined} onStart={onStart} onAllGames={vi.fn()} />)
    expect(screen.getByText('100 / 200')).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Your cities' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringMatching(/100$/), expect.stringMatching(/0$/)])
    expect(screen.getByText('New best score!')).toBeInTheDocument()
    expect(screen.getByText(/Only perfect runs/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onStart).toHaveBeenCalledWith('easy')
  })
})
