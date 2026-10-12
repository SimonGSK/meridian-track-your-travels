import { countryOfCity, type City } from '../data/cities'
import { formatPopulation } from '../data/facts'
import { biggerOf, type BiggerCityState } from './biggerCity'

/** The country a city is in, by name */
const countryName = (city: City) => countryOfCity(city)?.properties.name ?? ''

/** "Bigger city", the title over the game */
function Header() {
  return (
    <p className="game-title">
      <span>Bigger city</span>
    </p>
  )
}

type ChoiceProps = {
  /** The longest streak */
  best: number | undefined
  onStart: () => void
  onBack: () => void
  /** Where back goes: the kind of games it's listed under */
  backTo?: string
}

/** What the game is, and a way to start it, with the longest streak */
export function BiggerCityChoice({ best, onStart, onBack, backTo = 'All games' }: ChoiceProps) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">Bigger city</h3>
      <p className="muted">
        Two cities: which has more people? Each right pick brings two more, a little closer in size; the first wrong
        one ends the run. Populations are for the city itself, not its metro area.
      </p>
      <button type="button" className="primary-button" onClick={onStart}>
        Play
      </button>
      {best !== undefined && <p className="best-score">Best: {best} in a row</p>}
    </div>
  )
}

/** The two cities, their populations once picked, the bigger green and a wrong pick red */
function Pair({ game, onPick }: { game: BiggerCityState; onPick?: (city: City) => void }) {
  const { answer } = game
  const bigger = biggerOf(game)
  const tone = (city: City) => (!answer ? '' : city === bigger ? ' correct' : city === answer.picked ? ' wrong' : ' dimmed')
  return (
    <div className="options two bigger-pair">
      {game.pair.map((city) => (
        <button
          key={city.id}
          type="button"
          className={`option${tone(city)}`}
          disabled={!!answer || !onPick}
          onClick={() => onPick?.(city)}
        >
          <span className="bigger-name">{city.name}</span>
          <span className="muted">{countryName(city)}</span>
          {answer && <span className="fact-number">{formatPopulation(city.population)}</span>}
        </button>
      ))}
    </div>
  )
}

type PlayProps = {
  game: BiggerCityState
  best: number | undefined
  onPick: (city: City) => void
  onNext: () => void
  onQuit: () => void
}

export function BiggerCityPlay({ game, best, onPick, onNext, onQuit }: PlayProps) {
  const bigger = biggerOf(game)
  const smaller = game.pair.find((city) => city !== bigger)!
  return (
    <div className="game">
      <Header />
      <div className="game-status">
        <span>Streak {game.streak}</span>
        {best !== undefined && <span>Best {best}</span>}
      </div>
      <p className="game-prompt">Which has more people?</p>
      <Pair game={game} onPick={onPick} />
      <p className={`feedback${game.answer ? ' correct' : ''}`} role="status">
        {game.answer &&
          `Right! ${bigger.name} has ${formatPopulation(bigger.population)} people, ${smaller.name} ${formatPopulation(smaller.population)}.`}
      </p>
      {game.answer && (
        // Focus moves here so Enter goes on to the next pair
        <button type="button" className="primary-button" onClick={onNext} autoFocus>
          Next
        </button>
      )}
      <button type="button" className="text-button" onClick={onQuit}>
        Quit game
      </button>
    </div>
  )
}

function verdict(streak: number) {
  if (streak >= 15) return 'Incredible! You know your cities.'
  if (streak >= 8) return 'Great streak!'
  if (streak >= 3) return 'Not bad. Keep practising!'
  return 'Keep exploring the globe and try again!'
}

type ResultsProps = {
  game: BiggerCityState
  previousBest: number | undefined
  onStart: () => void
  onAllGames: () => void
}

/** The streak, and the pair it ended on */
export function BiggerCityResults({ game, previousBest, onStart, onAllGames }: ResultsProps) {
  const newBest = previousBest !== undefined && game.streak > previousBest
  const wrong = game.answer && !game.answer.correct
  const bigger = biggerOf(game)
  const smaller = game.pair.find((city) => city !== bigger)!
  return (
    <div className="game game-results">
      <Header />
      <p className="big-score">{game.streak}</p>
      <p>in a row</p>
      {wrong ? (
        <>
          <Pair game={game} />
          <p className="muted">
            {bigger.name} has more people than {smaller.name}.
          </p>
        </>
      ) : (
        <p className="muted">Every pair, without a mistake!</p>
      )}
      <p>{verdict(game.streak)}</p>
      {newBest && <p className="new-best">New best streak!</p>}
      <button type="button" className="primary-button" onClick={onStart}>
        Play again
      </button>
      <button type="button" className="text-button" onClick={onAllGames}>
        All games
      </button>
    </div>
  )
}
