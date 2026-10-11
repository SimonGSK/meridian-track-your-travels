import { formatArea, formatPopulation } from '../data/facts'
import { MEASURES, isMore, valueOf, type Guess, type HigherLowerState, type Measure } from './higherLower'
import { measureKey, type BestScores } from './useGame'

const WORDS: Record<
  Measure,
  {
    label: string
    about: string
    more: string
    fewer: string
    format: (n: number) => string
    question: (next: string, known: string) => string
    /** What's true, for the results: "Brazil has more people than Japan." */
    truth: (next: string, known: string, more: boolean) => string
  }
> = {
  people: {
    label: 'Population',
    about: 'Which has more people?',
    more: 'More',
    fewer: 'Fewer',
    format: (n) => `${formatPopulation(n)} people`,
    question: (next, known) => `Does ${next} have more or fewer people than ${known}?`,
    truth: (next, known, more) => `${next} has ${more ? 'more' : 'fewer'} people than ${known}.`,
  },
  area: {
    label: 'Area',
    about: 'Which is bigger?',
    more: 'Bigger',
    fewer: 'Smaller',
    format: formatArea,
    question: (next, known) => `Is ${next} bigger or smaller than ${known}?`,
    truth: (next, known, more) => `${next} is ${more ? 'bigger' : 'smaller'} than ${known}.`,
  },
}

/** "Higher or lower · Population" */
function Header({ game }: { game: HigherLowerState }) {
  return (
    <p className="game-title">
      <span>Higher or lower · {WORDS[game.measure].label}</span>
    </p>
  )
}

/** People or area, each with its longest streak */
export function MeasureChoice({
  best,
  onStart,
  onBack,
  backTo = 'All games',
}: {
  best: BestScores
  onStart: (measure: Measure) => void
  onBack: () => void
  /** Where back goes: the kind of games it's listed under */
  backTo?: string
}) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">Higher or lower</h3>
      <p className="muted">
        You're shown a country's figure. Does the next one have more, or fewer? Each right guess makes that one the
        country to beat; the first wrong one ends the run.
      </p>
      <p className="game-prompt">What do you compare?</p>
      <ul className="game-list">
        {MEASURES.map((measure) => {
          const streak = best[measureKey(measure)]
          return (
            <li key={measure}>
              <button type="button" className="game-card" onClick={() => onStart(measure)}>
                <strong>{WORDS[measure].label}</strong>
                <span className="muted">{WORDS[measure].about}</span>
                {streak !== undefined && <span className="best-score">Best: {streak} in a row</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** The two countries, their figures, and what you said, once you have */
function Pair({ game }: { game: HigherLowerState }) {
  const words = WORDS[game.measure]
  return (
    <dl className="higher-pair">
      {[game.known, game.next].map((country, i) => {
        const shown = i === 0 || !!game.answer
        return (
          <div key={country.properties.name} className={`higher-country${i === 0 ? ' known' : ' next'}`}>
            <dt>{country.properties.name}</dt>
            <dd className="fact-number">{shown ? words.format(valueOf(country, game.measure)) : '?'}</dd>
          </div>
        )
      })}
    </dl>
  )
}

type PlayProps = {
  game: HigherLowerState
  best: BestScores
  onGuess: (guess: Guess) => void
  onNext: () => void
  onQuit: () => void
}

export function HigherLowerPlay({ game, best, onGuess, onNext, onQuit }: PlayProps) {
  const words = WORDS[game.measure]
  const record = best[measureKey(game.measure)]
  const next = game.next.properties.name
  return (
    <div className="game">
      <Header game={game} />
      <div className="game-status">
        <span>Streak {game.streak}</span>
        {record !== undefined && <span>Best {record}</span>}
      </div>
      <Pair game={game} />
      <p className="game-prompt">{words.question(next, game.known.properties.name)}</p>
      {!game.answer && (
        // Bigger on the right, under the country it's about
        <div className="options two">
          {(['fewer', 'more'] as const).map((guess) => (
            <button key={guess} type="button" className="option" onClick={() => onGuess(guess)}>
              {words[guess]}
            </button>
          ))}
        </div>
      )}
      <p className={`feedback${game.answer ? ' correct' : ''}`} role="status">
        {game.answer && `Right! ${next} has ${words.format(valueOf(game.next, game.measure))}.`}
      </p>
      {game.answer && (
        // Focus moves here so Enter goes on to the next country
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
  if (streak >= 15) return 'Incredible! You know your world.'
  if (streak >= 8) return 'Great streak!'
  if (streak >= 3) return 'Not bad. Keep practising!'
  return 'Keep exploring the globe and try again!'
}

type ResultsProps = {
  game: HigherLowerState
  previousBest: number | undefined
  onStart: (measure: Measure) => void
  onAllGames: () => void
}

export function HigherLowerResults({ game, previousBest, onStart, onAllGames }: ResultsProps) {
  const words = WORDS[game.measure]
  const newBest = previousBest !== undefined && game.streak > previousBest
  const wrong = game.answer && !game.answer.correct
  return (
    <div className="game game-results">
      <Header game={game} />
      <p className="big-score">{game.streak}</p>
      <p>in a row</p>
      {wrong ? (
        <>
          <Pair game={game} />
          <p className="muted">{words.truth(game.next.properties.name, game.known.properties.name, isMore(game))}</p>
        </>
      ) : (
        <p className="muted">Every country, without a mistake!</p>
      )}
      <p>{verdict(game.streak)}</p>
      {newBest && <p className="new-best">New best streak!</p>}
      <button type="button" className="primary-button" onClick={() => onStart(game.measure)}>
        Play again
      </button>
      <button type="button" className="text-button" onClick={onAllGames}>
        All games
      </button>
    </div>
  )
}
