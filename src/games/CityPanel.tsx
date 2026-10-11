import { flagUrl } from '../flags'
import {
  CITY_LEVELS,
  MAX_CITY_POINTS,
  SPOT_ON_KM,
  currentCity,
  formatKm,
  maxCityScore,
  spotOnKm,
  type CityGameState,
  type CityLevel,
} from './cityGame'
import { ROUNDS } from './games'
import { Elapsed, RecordTime, RunTime } from './timing'
import { cityKey, type BestScores } from './useGame'

const levelLabel = (level: CityLevel) => CITY_LEVELS.find((l) => l.id === level)!.label

/** "Find the city · Easy", with the clock */
function Header({ game }: { game: CityGameState }) {
  return (
    <p className="game-title">
      <span>Find the city · {levelLabel(game.level)}</span>
      {!game.finished && (
        <span className="game-clock" aria-label="Time">
          <Elapsed since={game.startedAt} until={game.endedAt} />
        </span>
      )}
    </p>
  )
}

type ChoiceProps = {
  best: BestScores
  bestTimes: BestScores
  onStart: (level: CityLevel) => void
  onBack: () => void
  /** Where back goes: the kind of games it's listed under */
  backTo?: string
}

/** Easy, medium or hard, each with its best score */
export function CityLevelChoice({ best, bestTimes, onStart, onBack, backTo = 'All games' }: ChoiceProps) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">Find the city</h3>
      <p className="muted">
        We name a city and its country; you click where it is on the globe. {MAX_CITY_POINTS} points within{' '}
        {SPOT_ON_KM} km, or anywhere in a big city, fewer the farther off. Zoom in to be precise.
      </p>
      <p className="game-prompt">Choose a difficulty</p>
      <ul className="game-list">
        {CITY_LEVELS.map((level) => {
          const score = best[cityKey(level.id)]
          return (
            <li key={level.id}>
              <button type="button" className="game-card" onClick={() => onStart(level.id)}>
                <strong>{level.label}</strong>
                <span className="muted">{level.cities}.</span>
                {score !== undefined && (
                  <span className="best-score">
                    Best: {score} / {ROUNDS * MAX_CITY_POINTS} points
                    <RecordTime time={bestTimes[cityKey(level.id)]} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** "Spot on! 8 km away. +100 points", "In Tokyo! 41 km from its center", or how far off */
function feedback(game: CityGameState) {
  const { guess } = game
  if (!guess) return ''
  const { city, country } = currentCity(game)
  if (guess.km === null) return `${city.name} is marked on the globe, in ${country.properties.name}.`
  const points = `+${guess.points} ${guess.points === 1 ? 'point' : 'points'}`
  if (guess.km <= SPOT_ON_KM) return `Spot on! ${formatKm(guess.km)} away. ${points}`
  if (guess.km <= spotOnKm(city)) return `In ${city.name}! ${formatKm(guess.km)} from its center. ${points}`
  return `Off by ${formatKm(guess.km)}. ${points}`
}

/** Green when close, red when far, by the points */
const toneOf = (points: number) => (points >= 70 ? ' correct' : points < 30 ? ' wrong' : '')

type PlayProps = {
  game: CityGameState
  onDontKnow: () => void
  onNext: () => void
  onQuit: () => void
}

export function CityPlay({ game, onDontKnow, onNext, onQuit }: PlayProps) {
  const { city, country } = currentCity(game)
  const { guess } = game
  const isLast = game.index === game.rounds.length - 1
  const done = game.index + (guess ? 1 : 0)
  const flag = flagUrl(country)
  return (
    <div className="game">
      <Header game={game} />
      <div className="game-status">
        <span>
          Round {game.index + 1} of {game.rounds.length}
        </span>
        <span>{game.score} points</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Game progress"
        aria-valuemin={0}
        aria-valuemax={game.rounds.length}
        aria-valuenow={done}
      >
        <div style={{ width: `${(done / game.rounds.length) * 100}%` }} />
      </div>

      <p className="game-prompt">Click where this city is on the globe</p>
      <p className="game-target">{city.name}</p>
      <p className="city-country">
        {flag && <img className="mini-flag" src={flag} alt="" />}
        {country.properties.name}
      </p>

      <p className={`feedback${guess ? toneOf(guess.points) : ''}`} role="status">
        {feedback(game)}
      </p>

      {!guess && (
        <button type="button" className="primary-button secondary" onClick={onDontKnow}>
          I don't know
        </button>
      )}
      {guess && (
        // Focus moves here so Enter goes on to the next city
        <button type="button" className="primary-button" onClick={onNext} autoFocus>
          {isLast ? 'See results' : 'Next'}
        </button>
      )}
      <button type="button" className="text-button" onClick={onQuit}>
        Quit game
      </button>
    </div>
  )
}

function verdict(share: number) {
  if (share >= 0.9) return 'Incredible aim! You know where everything is.'
  if (share >= 0.7) return 'Great job!'
  if (share >= 0.4) return 'Not bad. Keep practising!'
  return 'Keep exploring the globe and try again!'
}

type ResultsProps = {
  game: CityGameState
  previousBest: number | undefined
  previousTime: number | undefined
  onStart: (level: CityLevel) => void
  onAllGames: () => void
}

export function CityResults({ game, previousBest, previousTime, onStart, onAllGames }: ResultsProps) {
  const max = maxCityScore(game)
  const newBest = previousBest !== undefined && game.score > previousBest
  return (
    <div className="game game-results">
      <Header game={game} />
      <p className="big-score">
        {game.score} / {max}
      </p>
      <p className="muted">points</p>
      <ol className="city-results" aria-label="Your cities">
        {game.rounds.map(({ city, country }, i) => (
          <li key={city.id}>
            <span className="city-result-name">
              {city.name}
              <span className="muted">, {country.properties.name}</span>
            </span>
            <span className="city-result-points">{game.scores[i] ?? 0}</span>
          </li>
        ))}
      </ol>
      <p>{verdict(game.score / max)}</p>
      {newBest && <p className="new-best">New best score!</p>}
      <RunTime game={game} previousTime={previousTime} />
      <button type="button" className="primary-button" onClick={() => onStart(game.level)}>
        Play again
      </button>
      <button type="button" className="text-button" onClick={onAllGames}>
        All games
      </button>
    </div>
  )
}
