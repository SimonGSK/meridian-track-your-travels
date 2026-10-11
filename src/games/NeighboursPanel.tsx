import CountryInput from './CountryInput'
import {
  NEIGHBOURS_LEVELS,
  currentNeighbours,
  missingNeighbours,
  namedNeighbours,
  neighboursPercent,
  totalNeighbours,
  type NeighboursLevel,
  type NeighboursState,
} from './neighboursGame'
import { Elapsed, RecordTime, RunTime } from './timing'
import { neighboursKey, type BestScores } from './useGame'
import type { CountryFeature } from '../countries'

const levelLabel = (level: NeighboursLevel) => NEIGHBOURS_LEVELS.find((l) => l.id === level)!.label
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "Neighbours · Easy", with the clock */
function Header({ game }: { game: NeighboursState }) {
  return (
    <p className="game-title">
      <span>Neighbours · {levelLabel(game.level)}</span>
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
  onStart: (level: NeighboursLevel) => void
  onBack: () => void
  /** Where back goes: the kind of games it's listed under */
  backTo?: string
}

/** Easy, medium or hard, each with its best share of neighbours named */
export function NeighboursLevelChoice({ best, bestTimes, onStart, onBack, backTo = 'All games' }: ChoiceProps) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">Neighbours</h3>
      <p className="muted">
        A country lights up on the globe: name every country it shares a land border with, from memory. Five countries
        a game. Territories don't count, and neither do borders at sea.
      </p>
      <p className="game-prompt">Choose a difficulty</p>
      <ul className="game-list">
        {NEIGHBOURS_LEVELS.map((level) => {
          const score = best[neighboursKey(level.id)]
          return (
            <li key={level.id}>
              <button type="button" className="game-card" onClick={() => onStart(level.id)}>
                <strong>{level.label}</strong>
                <span className="muted">{level.countries}.</span>
                {score !== undefined && (
                  <span className="best-score">
                    Best: {score}% named
                    <RecordTime time={bestTimes[neighboursKey(level.id)]} />
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

/** What became of the last name typed */
function feedback(game: NeighboursState) {
  const { country } = currentNeighbours(game)
  const target = country.properties.name
  if (game.roundOver) {
    const missed = missingNeighbours(game).length
    return missed === 0 ? `All of ${target}'s neighbours!` : `${plural(missed, 'neighbour')} missed, marked on the globe.`
  }
  if (!game.last) return ''
  const name = game.last.country.properties.name
  return {
    found: game.last.alias ? `${name} ✓ (you wrote ${game.last.alias})` : `${name} ✓`,
    again: `You already named ${name}.`,
    'not-neighbour': `${name} doesn't border ${target}.`,
    itself: `That's ${target} itself: name its neighbours.`,
    territory: `${name} is a territory, not a country.`,
  }[game.last.result]
}

function tone(game: NeighboursState) {
  if (game.roundOver) return missingNeighbours(game).length === 0 ? ' correct' : ' wrong'
  if (game.last?.result === 'found') return ' correct'
  return game.last?.result === 'not-neighbour' ? ' wrong' : ''
}

/** Neighbours as chips: named in green, missed in red */
function Chips({ label, countries, missed = false }: { label: string; countries: CountryFeature[]; missed?: boolean }) {
  if (countries.length === 0) return null
  return (
    <ul className={`found-list${missed ? ' missed' : ''}`} aria-label={label}>
      {countries.map((c) => (
        <li key={c.properties.name}>{c.properties.name}</li>
      ))}
    </ul>
  )
}

type PlayProps = {
  game: NeighboursState
  onPick: (country: CountryFeature, alias?: string | null) => void
  onDontKnow: () => void
  onNext: () => void
  onQuit: () => void
}

export function NeighboursPlay({ game, onPick, onDontKnow, onNext, onQuit }: PlayProps) {
  const { country, neighbours } = currentNeighbours(game)
  const isLast = game.index === game.rounds.length - 1
  return (
    <div className="game">
      <Header game={game} />
      <div className="game-status">
        <span>
          Country {game.index + 1} of {game.rounds.length}
        </span>
        <span>{plural(game.mistakes, 'mistake')}</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Neighbours named"
        aria-valuemin={0}
        aria-valuemax={neighbours.length}
        aria-valuenow={game.found.length}
      >
        <div style={{ width: `${(game.found.length / neighbours.length) * 100}%` }} />
      </div>

      <p className="game-prompt">Name every country bordering</p>
      <p className="game-target">{country.properties.name}</p>
      <p className="muted neighbour-count">
        {game.found.length} of {plural(neighbours.length, 'neighbour')}
      </p>

      {!game.roundOver && <CountryInput key={game.index} label="A neighbour" onAnswer={onPick} />}
      <p className={`feedback${tone(game)}`} role="status">
        {feedback(game)}
      </p>
      <Chips label="Named" countries={game.found} />
      {game.roundOver && <Chips label="Missed" countries={missingNeighbours(game)} missed />}

      {game.roundOver ? (
        // Focus moves here so Enter goes on to the next country
        <button type="button" className="primary-button" onClick={onNext} autoFocus>
          {isLast ? 'See results' : 'Next country'}
        </button>
      ) : (
        <button type="button" className="primary-button secondary" onClick={onDontKnow}>
          Show the rest
        </button>
      )}
      <button type="button" className="text-button" onClick={onQuit}>
        Quit game
      </button>
    </div>
  )
}

function verdict(percent: number) {
  if (percent === 100) return 'Perfect! You know every border.'
  if (percent >= 70) return 'Great job!'
  if (percent >= 40) return 'Not bad. Keep practising!'
  return 'Keep exploring the globe and try again!'
}

type ResultsProps = {
  game: NeighboursState
  previousBest: number | undefined
  previousTime: number | undefined
  onStart: (level: NeighboursLevel) => void
  onAllGames: () => void
}

export function NeighboursResults({ game, previousBest, previousTime, onStart, onAllGames }: ResultsProps) {
  const percent = neighboursPercent(game)
  const newBest = previousBest !== undefined && percent > previousBest
  return (
    <div className="game game-results">
      <Header game={game} />
      <p className="big-score">{percent}%</p>
      <p>
        {namedNeighbours(game)} of {totalNeighbours(game)} neighbours named, with {plural(game.mistakes, 'mistake')}
      </p>
      <ol className="city-results" aria-label="Your countries">
        {game.rounds.map(({ country, neighbours }, i) => (
          <li key={country.properties.name}>
            <span className="city-result-name">{country.properties.name}</span>
            <span className="city-result-points">
              {game.scores[i] ?? 0} / {neighbours.length}
            </span>
          </li>
        ))}
      </ol>
      <p>{verdict(percent)}</p>
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
