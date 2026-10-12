import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GamesPanel from './GamesPanel'
import { answer, dontKnow, newRoundGame, next, stopEarly, type Difficulty, type RoundGameId, type RoundGameState } from './games'
import { giveUp, newLetterGame, pickCountry, type LetterGameState } from './letterGame'
import type { GameState } from './useGame'
import { giveUpAll, nameCountry, newAllGame } from './allGame'
import { guess, newHigherLower, type HigherLowerState } from './higherLower'
import { dayKey, newDailyGame, shiftDay } from './daily'
import { newBiggerCity, pickBigger, type BiggerCityState } from './biggerCity'
import { capitalOf } from '../data/capitals'
import { countries } from '../countries'
import { openGame } from '../test/openGame'

const byName = (name: string) => countries.find((c) => c.properties.name === name)!
const pool = ['Denmark', 'France', 'Brazil', 'Japan', 'Kenya'].map(byName)
const roundGame = (id: RoundGameId, difficulty: Difficulty = 'easy') => newRoundGame(id, difficulty, () => 0.5, pool)

function setup(overrides: Partial<Parameters<typeof GamesPanel>[0]> = {}) {
  const props = {
    game: null,
    best: {},
    previousBest: undefined,
    onStart: vi.fn(),
    onStartLetter: vi.fn(),
    onStartAll: vi.fn(),
    onStartHigher: vi.fn(),
    onStartDaily: vi.fn(),
    daily: {},
    onPick: vi.fn(),
    onGuess: vi.fn(),
    onDontKnow: vi.fn(),
    onNext: vi.fn(),
    onStop: vi.fn(),
    onQuit: vi.fn(),
    ...overrides,
  }
  render(<GamesPanel {...props} />)
  return props
}

describe('GamesPanel: choosing a game', () => {
  it('lists the daily challenge, then the kinds of games, with how many there are, without asking for a difficulty yet', () => {
    setup()
    expect(screen.getAllByRole('button').map((b) => b.querySelector('strong')?.textContent)).toEqual([
      'Daily challenge',
      'Countries',
      'Flags',
      'Capitals',
      'Cities',
      'Facts',
    ])
    expect(screen.getByRole('button', { name: /^Countries/ })).toHaveTextContent(/^Countries6 games$/)
    expect(screen.getByRole('button', { name: /^Capitals/ })).toHaveTextContent(/^Capitals2 games$/)
    expect(screen.getByRole('button', { name: /^Flags/ })).toHaveTextContent(/^Flags$/)
    expect(screen.queryByRole('button', { name: /^Easy/ })).not.toBeInTheDocument()
  })

  it("opens a kind's games, or the only one, and goes back to all of them", async () => {
    setup()
    const titles = async (category: string) => {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${category}`) }))
      expect(screen.getByRole('heading', { name: category })).toBeInTheDocument()
      const shown = within(screen.getByRole('list', { name: category }))
        .getAllByRole('button')
        .map((b) => b.querySelector('strong')!.textContent)
      await userEvent.click(screen.getByRole('button', { name: '← All games' }))
      return shown
    }
    expect(await titles('Countries')).toEqual([
      'Find the country',
      'Name that country',
      'Shape quiz',
      'Neighbours',
      'Letter hunt',
      'Name them all',
    ])
    expect(await titles('Capitals')).toEqual(['Capital quiz', 'Whose capital?'])
    expect(await titles('Cities')).toEqual(['Find the city', 'Whose city?', 'Bigger city'])
    // A kind with one game opens it, and goes back to all games
    for (const [kind, game] of [
      ['Flags', 'Flag quiz'],
      ['Facts', 'Higher or lower'],
    ]) {
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${kind}`) }))
      expect(screen.getByRole('heading', { name: game })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: '← All games' }))
    }
    expect(screen.getByRole('button', { name: /^Facts/ })).toBeInTheDocument()
  })

  it('asks for the difficulty after choosing a game, then starts it', async () => {
    const { onStart } = setup()
    await openGame('Shape quiz')
    expect(screen.getByRole('heading', { name: 'Shape quiz' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveTextContent('Pick from four answers')
    expect(screen.getByRole('button', { name: /^Hard/ })).toHaveTextContent('Type your answers')
    await userEvent.click(screen.getByRole('button', { name: /^Medium/ }))
    expect(onStart).toHaveBeenCalledWith('shape', 'medium')
  })

  it('offers an "All countries" level after hard, with its best out of every country', async () => {
    const { onStart } = setup({ best: { 'shape:all': 120 } })
    await openGame('Shape quiz')
    const all = screen.getByRole('button', { name: /^All countries/ })
    expect(all).toHaveTextContent('Every one of the 197 countries, one after another')
    expect(all).toHaveTextContent('Best: 120 / 197')
    await userEvent.click(all)
    expect(onStart).toHaveBeenCalledWith('shape', 'all')
  })

  it('has no "All countries" level in the letter hunt', async () => {
    setup()
    await openGame('Letter hunt')
    expect(screen.queryByRole('region', { name: 'All countries' })).not.toBeInTheDocument()
  })

  it('explains the tries in "find the country"', async () => {
    setup()
    await openGame('Find the country')
    expect(screen.getByText(/3 tries per country/)).toBeInTheDocument()
  })

  it('shows the best score for each difficulty', async () => {
    setup({ best: { 'flags:hard': 7, 'find-points:easy': 24 } })
    await openGame('Flag quiz')
    expect(screen.getByRole('button', { name: /^Hard/ })).toHaveTextContent('Best: 7 / 10')
    expect(screen.getByRole('button', { name: /^Easy/ })).not.toHaveTextContent('Best')
    // The only flags game, straight back to all games
    await userEvent.click(screen.getByRole('button', { name: '← All games' }))
    await openGame('Find the country')
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveTextContent('Best: 24 / 30 points')
  })

  it('lists the letters for the letter hunt by difficulty, each with its best score', async () => {
    setup({ best: { 'letter:K': 4, 'letter:Z': 2 } })
    await openGame('Letter hunt')
    const easy = within(screen.getByRole('region', { name: 'Easy' }))
    expect(easy.getByRole('button', { name: 'K: 6 countries, best 4 of 6' })).toHaveTextContent('K4/6')
    expect(easy.getByRole('button', { name: 'Z: 2 countries, best 2 of 2' })).toHaveClass('complete')
    expect(easy.getByRole('button', { name: 'D: 5 countries' })).toHaveTextContent('D–/5')
    const hard = within(screen.getByRole('region', { name: 'Hard' }))
    expect(hard.getAllByRole('button', { name: /countries/ }).map((b) => b.textContent![0])).toEqual(['B', 'C', 'M', 'S'])
  })

  it('starts the letter hunt with any letter, or a random one', async () => {
    const onStartLetter = vi.fn()
    setup({ onStartLetter })
    await openGame('Letter hunt')
    await userEvent.click(screen.getByRole('button', { name: /^K:/ }))
    expect(onStartLetter).toHaveBeenLastCalledWith('K')
    await userEvent.click(screen.getByRole('button', { name: 'Random hard letter' }))
    expect(['B', 'C', 'M', 'S']).toContain(onStartLetter.mock.lastCall![0])
  })
})

describe('GamesPanel: rounds', () => {
  it('asks you to find a named country, with no answer buttons', () => {
    const g = roundGame('find')
    setup({ game: g })
    expect(screen.getByText('Find this country on the globe')).toBeInTheDocument()
    expect(screen.getByText(g.rounds[0].target.properties.name)).toBeInTheDocument()
    expect(screen.getByText('Round 1 of 5')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows the flag to identify, with four choices on easy', async () => {
    const g = roundGame('flags')
    const { onPick } = setup({ game: g })
    expect(screen.getByRole('img', { name: 'The flag to identify' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: g.rounds[0].options[2].properties.name }))
    expect(onPick).toHaveBeenCalledWith(g.rounds[0].options[2])
  })

  it("has an \"I don't know\" button while a round is open", async () => {
    const g = roundGame('find')
    const { onDontKnow } = setup({ game: g })
    await userEvent.click(screen.getByRole('button', { name: "I don't know" }))
    expect(onDontKnow).toHaveBeenCalled()
  })

  it("shows the answer after \"I don't know\", as a wrong round", () => {
    const g = roundGame('shape')
    setup({ game: dontKnow(g) })
    expect(screen.getByRole('status')).toHaveTextContent(`The answer is ${g.rounds[0].target.properties.name}.`)
    expect(screen.getByRole('status')).toHaveClass('wrong')
    expect(screen.queryByRole('button', { name: "I don't know" })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('says a territory is not a country, without counting it wrong', () => {
    const g = roundGame('find')
    setup({ game: answer(g, countries.find((c) => c.properties.name === 'Greenland')!) })
    expect(screen.getByRole('status')).toHaveTextContent('Greenland is a territory, not a country. Try again.')
    expect(screen.getByRole('status')).not.toHaveClass('wrong')
    expect(screen.getByLabelText(/^Try 1 of/)).toBeInTheDocument() // still on the first try
  })

  it('shows only the outline in the shape quiz', () => {
    setup({ game: roundGame('shape') })
    expect(screen.getByRole('img', { name: 'The outline to identify' })).toBeInTheDocument()
  })

  it('does not reveal the country in "name that country"', () => {
    setup({ game: roundGame('name') })
    expect(screen.getByText('Which country is highlighted on the globe?')).toBeInTheDocument()
  })

  it('asks for typed answers on medium and hard', async () => {
    const { onPick } = setup({ game: roundGame('shape', 'medium') })
    expect(screen.queryAllByRole('button', { name: /^(Denmark|France|Brazil|Japan|Kenya)$/ })).toHaveLength(0)
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Swaziland{Enter}')
    expect(onPick).toHaveBeenCalledWith(byName('Eswatini'), 'Swaziland')
  })

  it('shows the new name when an old one was typed', () => {
    const g = newRoundGame('shape', 'hard', () => 0.5, [byName('Eswatini')])
    setup({ game: answer(g, byName('Eswatini'), 'Swaziland') })
    expect(screen.getByRole('status')).toHaveTextContent('Correct: Eswatini (you wrote Swaziland)')
  })

  it('says what was picked and what was right after a wrong answer, and lets you continue', async () => {
    const g = roundGame('shape', 'medium')
    const { target } = g.rounds[0]
    const wrong = pool.find((c) => c !== target)!
    const { onNext } = setup({ game: answer(g, wrong) })
    expect(screen.getByRole('status')).toHaveTextContent(
      `That's ${wrong.properties.name}. The answer is ${target.properties.name}.`,
    )
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(onNext).toHaveBeenCalled()
  })

  it('lets you try again after a miss in "find the country", for fewer points', () => {
    const g = roundGame('find')
    const [wrong] = pool.filter((c) => c !== g.rounds[0].target)
    setup({ game: answer(g, wrong) })
    expect(screen.getByRole('status')).toHaveTextContent(`That's ${wrong.properties.name}. Try again: 2 tries left.`)
    expect(screen.getByLabelText('Try 2 of 3')).toHaveTextContent('Worth 2 points')
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  })

  it('shows the points won in "find the country"', () => {
    const g = roundGame('find')
    const [wrong] = pool.filter((c) => c !== g.rounds[0].target)
    setup({ game: answer(answer(g, wrong), g.rounds[0].target) })
    expect(screen.getByRole('status')).toHaveTextContent('Correct! +2 points')
    expect(screen.getByText('2 points')).toBeInTheDocument()
  })

  it('gives the answer after three misses', () => {
    let g = roundGame('find')
    for (const wrong of pool.filter((c) => c !== g.rounds[0].target).slice(0, 3)) g = answer(g, wrong)
    setup({ game: g })
    expect(screen.getByRole('status')).toHaveTextContent(`The answer is ${g.rounds[0].target.properties.name}.`)
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('marks the right and wrong choices', () => {
    const g = roundGame('flags')
    const { target, options } = g.rounds[0]
    const wrong = options.find((o) => o !== target)!
    setup({ game: answer(g, wrong) })
    expect(screen.getByRole('button', { name: target.properties.name })).toHaveClass('correct')
    expect(screen.getByRole('button', { name: wrong.properties.name })).toHaveClass('wrong')
    for (const option of options) expect(screen.getByRole('button', { name: option.properties.name })).toBeDisabled()
  })

  it('says "See results" on the last round', () => {
    let g: RoundGameState = roundGame('find')
    for (let i = 0; i < g.rounds.length - 1; i++) g = next(answer(g, g.rounds[g.index].target))
    setup({ game: answer(g, g.rounds[g.index].target) })
    expect(screen.getByRole('button', { name: 'See results' })).toBeInTheDocument()
  })

  it('shows the result and celebrates a new best score', async () => {
    let g: RoundGameState = roundGame('find')
    while (!g.finished) g = next(answer(g, g.rounds[g.index].target))
    const { onStart, onQuit } = setup({ game: g, previousBest: 3 })
    expect(screen.getByText('15 / 15')).toBeInTheDocument()
    expect(screen.getByText('points')).toBeInTheDocument()
    expect(screen.getByText('Perfect! A true geographer.')).toBeInTheDocument()
    expect(screen.getByText('New best score!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onStart).toHaveBeenCalledWith('find', 'easy')
    await userEvent.click(screen.getByRole('button', { name: 'All games' }))
    expect(onQuit).toHaveBeenCalled()
  })

  it('lets you stop an "all countries" game once you have played a round', async () => {
    const fresh = newRoundGame('shape', 'all')
    const { rerender } = render(<GamesPanel game={fresh} best={{}} previousBest={undefined} onStart={vi.fn()} onStartLetter={vi.fn()} onStartAll={vi.fn()} onStartHigher={vi.fn()} onPick={vi.fn()} onGuess={vi.fn()} onDontKnow={vi.fn()} onNext={vi.fn()} onStop={vi.fn()} onQuit={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Stop and see results' })).not.toBeInTheDocument()
    const onStop = vi.fn()
    rerender(<GamesPanel game={answer(fresh, fresh.rounds[0].target)} best={{}} previousBest={undefined} onStart={vi.fn()} onStartLetter={vi.fn()} onStartAll={vi.fn()} onStartHigher={vi.fn()} onPick={vi.fn()} onGuess={vi.fn()} onDontKnow={vi.fn()} onNext={vi.fn()} onStop={onStop} onQuit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Stop and see results' }))
    expect(onStop).toHaveBeenCalled()
  })

  it('scores a stopped game against the rounds played', () => {
    let g: RoundGameState = newRoundGame('shape', 'all')
    for (let i = 0; i < 4; i++) g = next(answer(g, g.rounds[g.index].target))
    setup({ game: stopEarly(g) })
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
    expect(screen.getByText('Stopped after 4 of 197 countries')).toBeInTheDocument()
    expect(screen.getByText('Perfect! A true geographer.')).toBeInTheDocument()
  })

  it('lets you quit mid-game', async () => {
    const { onQuit } = setup({ game: roundGame('name') })
    await userEvent.click(screen.getByRole('button', { name: 'Quit game' }))
    expect(onQuit).toHaveBeenCalled()
  })
})

describe('GamesPanel: letter hunt', () => {
  const kGame = (): LetterGameState => newLetterGame('K')

  it('shows the letter and how many are left', () => {
    const game = kGame()
    setup({ game })
    expect(screen.getByLabelText('the letter K')).toHaveTextContent('K')
    expect(screen.getByText('Found 0 of 6')).toBeInTheDocument()
    expect(screen.getByText(/Letter hunt · Easy/)).toBeInTheDocument()
  })

  it('lists what was found and explains mistakes', () => {
    const game = pickCountry(pickCountry(kGame(), byName('Kenya')), byName('Denmark'))
    setup({ game })
    expect(screen.getByRole('list', { name: 'Found' })).toHaveTextContent('Kenya')
    expect(screen.getByRole('status')).toHaveTextContent("Denmark doesn't start with K.")
    expect(screen.getByText('1 mistake')).toBeInTheDocument()
  })

  it('says when a territory is clicked', () => {
    setup({ game: pickCountry(newLetterGame('G'), byName('Greenland')) })
    expect(screen.getByRole('status')).toHaveTextContent('Greenland is a territory, not a country')
  })

  it('can be given up', async () => {
    const { onNext } = setup({ game: kGame() })
    await userEvent.click(screen.getByRole('button', { name: 'Give up and show the rest' }))
    expect(onNext).toHaveBeenCalled()
  })

  it('shows what was missed on the results, and offers the same or another letter', async () => {
    const game = giveUp(pickCountry(kGame(), byName('Kenya')))
    const { onStartLetter, onQuit } = setup({ game, previousBest: 0 })
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
    expect(screen.getByText(/Missed/)).toHaveTextContent('Kazakhstan, Kiribati, Kosovo, Kuwait, Kyrgyzstan')
    expect(screen.getByText('New best score!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onStartLetter).toHaveBeenCalledWith('K')
    await userEvent.click(screen.getByRole('button', { name: 'Another letter' }))
    expect(onQuit).toHaveBeenCalled()
  })

  it('goes back to the letters after "Another letter", and to all games after "All games"', async () => {
    const props = {
      game: giveUp(kGame()) as GameState | null,
      best: {},
      previousBest: undefined,
      onStart: vi.fn(),
      onStartLetter: vi.fn(),
      onStartAll: vi.fn(),
      onStartHigher: vi.fn(),
      onPick: vi.fn(),
      onGuess: vi.fn(),
      onDontKnow: vi.fn(),
      onNext: vi.fn(),
      onStop: vi.fn(),
      onQuit: vi.fn(),
    }
    const { rerender } = render(<GamesPanel {...props} />)
    await userEvent.click(screen.getByRole('button', { name: 'Another letter' }))
    // The app then clears the game
    rerender(<GamesPanel {...props} game={null} />)
    expect(screen.getByRole('heading', { name: 'Letter hunt' })).toBeInTheDocument()

    rerender(<GamesPanel {...props} game={giveUp(kGame())} />)
    await userEvent.click(screen.getByRole('button', { name: 'All games' }))
    rerender(<GamesPanel {...props} game={null} />)
    expect(screen.queryByRole('heading', { name: 'Letter hunt' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Countries/ })).toBeInTheDocument()
  })
})

describe('GamesPanel: name them all', () => {
  it('offers the whole world or a continent, with the best for each', async () => {
    const onStartAll = vi.fn()
    setup({ onStartAll, best: { 'all:Europe': 31 } })
    await openGame('Name them all')
    expect(screen.getByRole('button', { name: /^The whole world/ })).toHaveTextContent('197 countries')
    expect(screen.getByRole('button', { name: /^Europe/ })).toHaveTextContent('Best: 31 / 46')
    await userEvent.click(screen.getByRole('button', { name: /^Oceania/ }))
    expect(onStartAll).toHaveBeenCalledWith('Oceania')
  })

  it('takes typed names, without suggestions', async () => {
    const { onPick } = setup({ game: newAllGame('world') })
    await userEvent.type(screen.getByRole('textbox', { name: 'Name a country' }), 'Burma{Enter}')
    expect(onPick).toHaveBeenCalledWith(byName('Myanmar'), 'Burma')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('shows progress, by continent for the whole world, and a clock', () => {
    const game = nameCountry(nameCountry(newAllGame('world'), byName('Kenya')), byName('Peru'))
    setup({ game })
    expect(screen.getByText('2 / 197')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Peru ✓')
    expect(screen.getByRole('list', { name: 'Named' })).toHaveTextContent('PeruKenya') // newest first
    expect(screen.getByRole('list', { name: 'Named by continent' })).toHaveTextContent('Africa1 / 54')
    expect(screen.getByText(/^\d+:\d\d$/)).toBeInTheDocument()
  })

  it('explains names that do not count', () => {
    setup({ game: nameCountry(nameCountry(newAllGame('Europe'), byName('France')), byName('Japan')) })
    expect(screen.getByRole('status')).toHaveTextContent("Japan isn't in Europe.")
  })

  it('shows the time and what was missed on the results', async () => {
    const game = giveUpAll(nameCountry(newAllGame('South America', 0), byName('Peru'), null, 0), 65_000)
    const { onStartAll } = setup({ game })
    expect(screen.getByText('1 / 12')).toBeInTheDocument()
    expect(screen.getByText('countries named')).toBeInTheDocument()
    expect(screen.getByText(/^Time 1:05\.0\. Only perfect runs/)).toBeInTheDocument()
    expect(screen.getByText(/^Argentina, Bolivia/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onStartAll).toHaveBeenCalledWith('South America')
  })
})

describe('GamesPanel: time records', () => {
  /** Every round right, the last answered `seconds` after the start */
  function perfectRun(seconds: number, wrongRound = -1) {
    let game = newRoundGame('flags', 'easy', () => 0.5, pool, 0)
    for (let i = 0; i < game.rounds.length; i++) {
      const { target } = game.rounds[game.index]
      game = answer(game, i === wrongRound ? pool.find((c) => c !== target)! : target, null, seconds * 1000)
      game = next(game)
    }
    return game
  }

  it('runs a clock while playing', () => {
    setup({ game: newRoundGame('flags', 'easy', () => 0.5, pool, Date.now() - 65_000) })
    expect(screen.getByLabelText('Time')).toHaveTextContent('1:05')
  })

  it('shows the time of a perfect run, the first being a record', () => {
    setup({ game: perfectRun(42.3) })
    expect(screen.getByText('Perfect run in')).toHaveTextContent('Perfect run in 0:42.3')
    expect(screen.getByText('Your first time record!')).toBeInTheDocument()
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument()
  })

  it('celebrates beating the record', () => {
    setup({ game: perfectRun(42.3), previousTime: 50_000 })
    expect(screen.getByText('New time record!')).toBeInTheDocument()
  })

  it('shows the record to beat after a slower perfect run', () => {
    setup({ game: perfectRun(42.3), previousTime: 30_000 })
    expect(screen.getByText('Your record is 0:30.0')).toBeInTheDocument()
    expect(screen.queryByText(/time record!/)).not.toBeInTheDocument()
  })

  it('says why a run with a mistake sets no record', () => {
    setup({ game: perfectRun(10, 2), previousTime: 30_000 })
    expect(screen.getByText(/^Time 0:10\.0\. Only perfect runs/)).toBeInTheDocument()
    expect(screen.queryByText(/Perfect run in/)).not.toBeInTheDocument()
  })

  it('shows the record times next to the best scores', async () => {
    setup({
      best: { 'flags:easy': 10, 'letter:Z': 2, 'all:Oceania': 14 },
      bestTimes: { 'flags:easy': 42_300, 'letter:Z': 8_100, 'all:Oceania': 95_000 },
    })
    await openGame('Flag quiz')
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveTextContent('Best: 10 / 10 · record 0:42.3')
    expect(screen.getByRole('button', { name: /^Medium/ })).not.toHaveTextContent('record')
    await userEvent.click(screen.getByRole('button', { name: '← All games' }))
    await openGame('Letter hunt')
    expect(screen.getByRole('button', { name: /^Z:/ })).toHaveAccessibleName('Z: 2 countries, best 2 of 2, record 0:08.1')
    // Back to the other countries games
    await userEvent.click(screen.getByRole('button', { name: '← Countries' }))
    await userEvent.click(screen.getByRole('button', { name: /^Name them all/ }))
    expect(screen.getByRole('button', { name: /^Oceania/ })).toHaveTextContent('record 1:35.0')
  })
})

describe('GamesPanel: whose city?', () => {
  /** Each round names a city, here one made up in the country to answer */
  const cityGame = (difficulty: Difficulty = 'easy') => {
    const game = roundGame('city-country', difficulty)
    return {
      ...game,
      rounds: game.rounds.map((round) => ({
        ...round,
        city: { id: 1, name: `Town of ${round.target.properties.name}`, place: 'XX', lat: 0, lng: 0, population: 1 },
      })),
    }
  }

  it('names a city, to pick its country from four on easy', async () => {
    const game = cityGame()
    const { target } = game.rounds[0]
    setup({ game })
    expect(screen.getByText('Which country is this city in?')).toBeInTheDocument()
    expect(screen.getByText(`Town of ${target.properties.name}`)).toHaveClass('game-target')
    expect(screen.getAllByRole('button', { name: target.properties.name })).toHaveLength(1)
    cleanup()
    setup({ game: answer(game, target) })
    expect(screen.getByRole('status')).toHaveTextContent(`Correct! Town of ${target.properties.name} is in ${target.properties.name}.`)
  })

  it('takes a typed country on medium, saying where the city is when wrong', () => {
    const game = cityGame('medium')
    const { target } = game.rounds[0]
    const wrong = pool.find((c) => c !== target)!
    setup({ game: answer(game, wrong) })
    expect(screen.getByRole('status')).toHaveTextContent(
      `Town of ${target.properties.name} is in ${target.properties.name}, not ${wrong.properties.name}.`,
    )
  })

  it('offers no "All countries" level', async () => {
    setup()
    await openGame('Whose city?')
    expect(screen.getByRole('button', { name: /^Easy/ })).toHaveTextContent('The biggest city of big countries, but not the capital')
    expect(screen.queryByRole('button', { name: /^All countries/ })).not.toBeInTheDocument()
  })
})

describe('GamesPanel: bigger city', () => {
  const town = (id: number, name: string, place: string, population: number) => ({ id, name, place, lat: 0, lng: 0, population })
  const TOKYO = town(1, 'Tokyo', 'JP', 8_336_599)
  const OSAKA = town(2, 'Osaka', 'JP', 2_592_413)
  const LYON = town(3, 'Lyon', 'FR', 472_317)
  const game = (): BiggerCityState => ({ ...newBiggerCity([TOKYO, OSAKA, LYON], () => 0), pair: [OSAKA, TOKYO], seen: [OSAKA, TOKYO] })

  it('explains the game, with the longest streak, and starts it', async () => {
    const onStartBigger = vi.fn()
    setup({ onStartBigger, best: { 'bigger-city': 7 } })
    await openGame('Bigger city')
    expect(screen.getByRole('heading', { name: 'Bigger city' })).toBeInTheDocument()
    expect(screen.getByText('Best: 7 in a row')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onStartBigger).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '← Cities' }))
    expect(screen.getByRole('heading', { name: 'Cities' })).toBeInTheDocument()
  })

  it('asks which of two cities has more people, and shows both once picked', async () => {
    const onPickCity = vi.fn()
    setup({ game: game(), onPickCity, best: { 'bigger-city': 3 } })
    expect(screen.getByText('Which has more people?')).toBeInTheDocument()
    expect(screen.getByText('Best 3')).toBeInTheDocument()
    const osaka = screen.getByRole('button', { name: /^Osaka/ })
    expect(osaka).toHaveTextContent(/^OsakaJapan$/)
    await userEvent.click(screen.getByRole('button', { name: /^Tokyo/ }))
    expect(onPickCity).toHaveBeenCalledWith(TOKYO)
    cleanup()
    setup({ game: pickBigger(game(), TOKYO) })
    expect(screen.getByRole('status')).toHaveTextContent('Right! Tokyo has 8.34 million people, Osaka 2.59 million.')
    expect(screen.getByRole('button', { name: /^Tokyo/ })).toHaveClass('correct')
    expect(screen.getByRole('button', { name: /^Osaka/ })).toHaveTextContent('OsakaJapan2.59 million')
    expect(screen.getByText('Streak 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus()
  })

  it('ends at a wrong pick with the streak, and what was right', async () => {
    const onStartBigger = vi.fn()
    setup({ game: pickBigger(game(), OSAKA), previousBest: 0, onStartBigger })
    expect(screen.getByText('0', { selector: '.big-score' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Osaka/ })).toHaveClass('wrong')
    expect(screen.getByText('Tokyo has more people than Osaka.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onStartBigger).toHaveBeenCalled()
  })
})

describe('GamesPanel: capital quiz', () => {
  const capitalGame = (difficulty: Difficulty = 'easy') => newRoundGame('capital', difficulty, () => 0.5, pool)

  it('asks for the capital of a country, picking from four capitals on easy', async () => {
    const game = capitalGame()
    const { onPick } = setup({ game })
    const { target, options } = game.rounds[0]
    expect(screen.getByText("What's the capital of")).toBeInTheDocument()
    expect(screen.getByText(target.properties.name, { selector: '.game-target' })).toBeInTheDocument()
    const capitals = options.map((o) => capitalOf(o)!)
    expect(screen.getAllByRole('button', { name: new RegExp(`^(${capitals.join('|')})$`) })).toHaveLength(4)
    await userEvent.click(screen.getByRole('button', { name: capitalOf(target)! }))
    expect(onPick).toHaveBeenCalledWith(target)
  })

  it('says the capital once answered', () => {
    const game = capitalGame()
    const { target, options } = game.rounds[0]
    const wrong = options.find((o) => o !== target)!
    setup({ game: answer(game, wrong) })
    expect(screen.getByRole('status')).toHaveTextContent(`The capital of ${target.properties.name} is ${capitalOf(target)}.`)
  })

  it('takes a typed capital on harder levels, saying whose capital a wrong one is', async () => {
    const game = capitalGame('medium')
    const { onPick } = setup({ game })
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'kiev{Enter}')
    expect(onPick).toHaveBeenCalledWith(byName('Ukraine'), 'kiev')
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'Gotham{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('No capital called “Gotham”.')
  })

  it('explains a wrong typed capital', () => {
    const game = capitalGame('medium')
    const { target } = game.rounds[0]
    const other = byName(target.properties.name === 'Peru' ? 'Chile' : 'Peru')
    setup({ game: answer(game, other, 'lima') })
    expect(screen.getByRole('status')).toHaveTextContent(
      `lima is the capital of ${other.properties.name}. The capital of ${target.properties.name} is ${capitalOf(target)}.`,
    )
  })
})

describe('GamesPanel: higher or lower', () => {
  const pair = (known: string, next: string, measure: 'people' | 'area' = 'people'): HigherLowerState => ({
    ...newHigherLower(measure, () => 0.5),
    known: byName(known),
    next: byName(next),
  })

  it('offers population or area, each with its best streak', async () => {
    const { onStartHigher } = setup({ best: { 'higher:area': 7 } })
    await openGame('Higher or lower')
    expect(screen.getByRole('button', { name: /^Area/ })).toHaveTextContent('Best: 7 in a row')
    expect(screen.getByRole('button', { name: /^Population/ })).not.toHaveTextContent('Best')
    await userEvent.click(screen.getByRole('button', { name: /^Population/ }))
    expect(onStartHigher).toHaveBeenCalledWith('people')
  })

  it("shows the known country's figure, hides the other's, and takes a guess", async () => {
    const { onGuess } = setup({ game: pair('Japan', 'Brazil'), best: { 'higher:people': 5 } })
    const [known, next] = [...document.querySelectorAll('.higher-country')]
    expect(known).toHaveTextContent(/^Japan.+million people$/)
    expect(next).toHaveTextContent(/^Brazil\?$/)
    expect(screen.getByText('Does Brazil have more or fewer people than Japan?')).toBeInTheDocument()
    expect(screen.getByText('Best 5')).toBeInTheDocument()
    // More on the right, under the country it's about
    expect([...document.querySelectorAll('.options .option')].map((b) => b.textContent)).toEqual(['Fewer', 'More'])
    await userEvent.click(screen.getByRole('button', { name: 'Fewer' }))
    expect(onGuess).toHaveBeenCalledWith('fewer')
  })

  it('asks about size for area, and goes on after a right guess', async () => {
    const game = guess(pair('Denmark', 'Brazil', 'area'), 'more')
    const { onNext } = setup({ game })
    expect(screen.getByText('Is Brazil bigger or smaller than Denmark?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bigger' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/^Right! Brazil has [\d,.]+ (million )?km²\.$/)
    expect(screen.getByText('Streak 1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalled()
  })

  it('ends with the streak, what was true, and a new best', async () => {
    const game = guess({ ...pair('China', 'Iceland'), streak: 6 }, 'more')
    const { onStartHigher, onQuit } = setup({ game, previousBest: 4 })
    expect(screen.getByText('6', { selector: '.big-score' })).toBeInTheDocument()
    expect(screen.getByText('Iceland has fewer people than China.')).toBeInTheDocument()
    expect(screen.getByText('New best streak!')).toBeInTheDocument()
    expect(screen.queryByText(/Only perfect runs/)).not.toBeInTheDocument() // no time records here
    await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onStartHigher).toHaveBeenCalledWith('people')
    await userEvent.click(screen.getByRole('button', { name: 'All games' }))
    expect(onQuit).toHaveBeenCalled()
  })
})

describe('GamesPanel: whose capital?', () => {
  const game = (difficulty: Difficulty = 'easy') => newRoundGame('capital-country', difficulty, () => 0.5, pool)

  it('shows a capital and asks whose it is, picking from four countries on easy', async () => {
    const start = game()
    const { onPick } = setup({ game: start })
    const { target, options } = start.rounds[0]
    expect(screen.getByText('Which country has this capital?')).toBeInTheDocument()
    expect(screen.getByText(capitalOf(target)!, { selector: '.game-target' })).toBeInTheDocument()
    expect(screen.queryByText(target.properties.name, { selector: '.game-target' })).not.toBeInTheDocument()
    for (const option of options) expect(screen.getByRole('button', { name: option.properties.name })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: target.properties.name }))
    expect(onPick).toHaveBeenCalledWith(target)
  })

  it('says whose capital it is once answered', () => {
    const start = game('medium')
    const { target } = start.rounds[0]
    const other = byName(target.properties.name === 'Peru' ? 'Chile' : 'Peru')
    setup({ game: answer(start, target) })
    expect(screen.getByRole('status')).toHaveTextContent(`Correct! ${capitalOf(target)} is the capital of ${target.properties.name}.`)
    cleanup()
    setup({ game: answer(start, other) })
    expect(screen.getByRole('status')).toHaveTextContent(
      `${capitalOf(target)} is the capital of ${target.properties.name}, not ${other.properties.name}.`,
    )
  })

  it('takes a typed country on harder levels', async () => {
    const { onPick } = setup({ game: game('hard') })
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), 'holland{Enter}')
    expect(onPick).toHaveBeenCalledWith(byName('Netherlands'), 'holland')
  })
})

describe('GamesPanel: daily challenge', () => {
  afterEach(() => vi.useRealTimers())
  const today = () => dayKey(new Date())
  const result = { score: 6, max: 7, squares: '🟩🟩🟨🟩🟥' }

  it('comes first in the list, saying if today is played and the streak', async () => {
    const { onStartDaily } = setup({ daily: { [shiftDay(today(), -1)]: result } })
    const card = screen.getAllByRole('button')[0]
    expect(card).toHaveTextContent(/^Daily challenge/)
    expect(card).toHaveTextContent('Not played today · 1 day in a row')
    await userEvent.click(card)
    expect(screen.getByRole('heading', { name: 'Daily challenge' })).toBeInTheDocument()
    expect(screen.getByText('Streak', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: "Play today's challenge" }))
    expect(onStartDaily).toHaveBeenCalled()
  })

  it("shows today's result once played, to copy, and when the next one comes", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 5, 21, 30) })
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    setup({ daily: { '2026-10-05': result } })
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Today: 6 / 7 · 1 day in a row')
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(screen.queryByRole('button', { name: "Play today's challenge" })).not.toBeInTheDocument()
    expect(screen.getByText('6 / 7')).toBeInTheDocument()
    expect(screen.getByLabelText('Rounds: 🟩🟩🟨🟩🟥')).toBeInTheDocument()
    expect(screen.getByText(/^Next challenge in/)).toHaveTextContent('Next challenge in 2h 30m')
    await userEvent.click(screen.getByRole('button', { name: 'Copy result' }))
    expect(writeText).toHaveBeenCalledWith('Meridian daily · 5 Oct 2026 · 6/7\n🟩🟩🟨🟩🟥')
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('plays each round as its own quiz, with the day in the header', () => {
    const game = newDailyGame('2026-10-05', new Date(2026, 9, 5, 9).getTime())
    setup({ game })
    expect(screen.getByText(/^Daily challenge · 5 Oct$/)).toBeInTheDocument()
    expect(screen.getByText('Find this country on the globe')).toBeInTheDocument()
    expect(screen.getByText('Round 1 of 5')).toBeInTheDocument()
    cleanup()
    setup({ game: next(dontKnow(game)) })
    expect(screen.getByText('Which country has this flag?')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /./ }).filter((b) => b.classList.contains('option'))).toHaveLength(4)
  })

  it('ends with the result and the streaks', async () => {
    let game = newDailyGame(today())
    for (let i = 0; i < 5; i++) game = next(dontKnow(game))
    const { onQuit } = setup({ game, daily: { [today()]: { score: 0, max: 7, squares: '🟥🟥🟥🟥🟥' } } })
    expect(screen.getByText('0 / 7')).toBeInTheDocument()
    expect(screen.getByText('Played', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: 'All games' }))
    expect(onQuit).toHaveBeenCalled()
  })
})
