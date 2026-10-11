import { useState, type ReactNode } from 'react'
import { flagUrl } from '../flags'
import type { CountryFeature } from '../countries'
import CountryInput from './CountryInput'
import CapitalInput from './CapitalInput'
import CountryShape from './CountryShape'
import { capitalOf } from '../data/capitals'
import { HigherLowerPlay, HigherLowerResults, MeasureChoice } from './HigherLowerPanel'
import { DailyChoice, DailyResultsView } from './DailyPanel'
import { CityLevelChoice, CityPlay, CityResults } from './CityPanel'
import type { CityLevel } from './cityGame'
import { NeighboursLevelChoice, NeighboursPlay, NeighboursResults } from './NeighboursPanel'
import type { NeighboursLevel } from './neighboursGame'
import { dayKey, streaksOf, type DailyResults } from './daily'
import type { Guess, Measure } from './higherLower'
import {
  DIFFICULTIES,
  GAMES,
  GAME_CATEGORIES,
  MAX_TRIES,
  answerMode,
  currentRound,
  difficultyDescription,
  gamesOf,
  listedUnder,
  maxScore,
  maxScoreFor,
  maxScorePlayed,
  kindOf,
  roundsPlayed,
  isCategory,
  type GameCategory,
  type GameChoice,
  type QuizKind,
  type Difficulty,
  type GameId,
  type RoundGameId,
  type RoundGameState,
} from './games'
import { countriesStartingWith, lettersOf, missing, randomLetter, type LetterGameState } from './letterGame'
import { bestKey, gameScore, letterKey, scopeKey, type BestScores, type GameState } from './useGame'
import { formatRunTime } from './records'
import { Elapsed, RecordTime, RunTime } from './timing'
import {
  SCOPES,
  countriesIn,
  missingAll,
  scopeLabel,
  type AllGameState,
  type Scope,
} from './allGame'
import { CONTINENTS } from '../data/continents'
import { ChevronIcon } from '../icons'

type Props = {
  game: GameState | null
  best: BestScores
  previousBest: number | undefined
  /** The fastest perfect run of each game, in milliseconds */
  bestTimes?: BestScores
  /** The record to beat when the current game started */
  previousTime?: number
  onStart: (id: RoundGameId, difficulty: Difficulty) => void
  onStartLetter: (letter: string) => void
  onStartAll: (scope: Scope) => void
  onStartHigher: (measure: Measure) => void
  /** Find the city, at a level */
  onStartCity?: (level: CityLevel) => void
  /** Neighbours, at a level */
  onStartNeighbours?: (level: NeighboursLevel) => void
  /** How each day's challenge went */
  daily?: DailyResults
  onStartDaily?: () => void
  onPick: (country: CountryFeature, alias?: string | null) => void
  /** Higher or lower: more, or fewer */
  onGuess: (guess: Guess) => void
  /** "I don't know" in a game played in rounds */
  onDontKnow: () => void
  onNext: () => void
  /** End a game played in rounds early */
  onStop: () => void
  onQuit: () => void
  /** The kind of games listed, or whose setup is open, when the caller keeps track (so it stays open across tabs) */
  chosen?: GameChoice | null
  onChoose?: (choice: GameChoice | null) => void
}

const titleOf = (id: GameId) => GAMES.find((g) => g.id === id)!.title
const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const difficultyLabel = (d: Difficulty) => DIFFICULTIES.find((x) => x.id === d)!.label
const formatScore = (id: RoundGameId, difficulty: Difficulty, score: number) =>
  `${score} / ${maxScoreFor(id, difficulty)}${id === 'find' ? ' points' : ''}`

type Chosen = { chosen: GameChoice | null; setChosen: (choice: GameChoice | null) => void }

export default function GamesPanel(props: Props) {
  const { game } = props
  // Which game's setup is open; kept while playing so "Another letter" can return to it
  const [ownChoice, setOwnChoice] = useState<GameChoice | null>(null)
  const choice = {
    chosen: props.chosen !== undefined ? props.chosen : ownChoice,
    setChosen: props.onChoose ?? setOwnChoice,
  }
  if (!game) return <GameList {...props} {...choice} />
  if (game.finished) return <Results {...props} {...choice} game={game} />
  if (game.kind === 'letter') return <LetterHunt {...props} game={game} />
  if (game.kind === 'all') return <NameThemAll {...props} game={game} />
  if (game.kind === 'higher') return <HigherLowerPlay {...props} game={game} />
  if (game.kind === 'city') return <CityPlay {...props} game={game} />
  if (game.kind === 'neighbours') return <NeighboursPlay {...props} game={game} />
  return <RoundPlay {...props} game={game} />
}

/** "Today: 6 / 7 · 3 days in a row", or the streak to keep going */
function DailyStatus({ results, today }: { results: DailyResults; today: string }) {
  const done = results[today]
  const { current } = streaksOf(results, today)
  const streak = current > 0 ? ` · ${current} ${current === 1 ? 'day' : 'days'} in a row` : ''
  return <span className="best-score">{done ? `Today: ${done.score} / ${done.max}${streak}` : `Not played today${streak}`}</span>
}

/**
 * The daily challenge, and the kinds of games; picking a kind lists its
 * games (or opens the only one), and picking one asks for the difficulty, or
 * for the letter hunt the letter. Back goes to where it was picked.
 */
function GameList(props: Props & Chosen) {
  const { best, bestTimes = {}, onStart, onStartLetter, onStartAll, onStartHigher, chosen, setChosen } = props
  const [today] = useState(() => dayKey(new Date()))
  if (chosen === 'daily') return <DailyChoice results={props.daily ?? {}} onPlay={() => props.onStartDaily?.()} onBack={() => setChosen(null)} />
  // A game's setup goes back to its kind's list
  const category = chosen && !isCategory(chosen) ? listedUnder(chosen) : null
  const back = { onBack: () => setChosen(category), backTo: category ?? 'All games' }
  const bests = { best, bestTimes }
  if (chosen === 'letter') return <LetterChoice {...bests} onStartLetter={onStartLetter} {...back} />
  if (chosen === 'all') return <ScopeChoice {...bests} onStartAll={onStartAll} {...back} />
  if (chosen === 'higher') return <MeasureChoice best={best} onStart={onStartHigher} {...back} />
  if (chosen === 'city') return <CityLevelChoice {...bests} onStart={(level) => props.onStartCity?.(level)} {...back} />
  if (chosen === 'neighbours') {
    return <NeighboursLevelChoice {...bests} onStart={(level) => props.onStartNeighbours?.(level)} {...back} />
  }
  const card = (g: (typeof GAMES)[number]) => (
    <li key={g.id}>
      <button type="button" className={`game-card${g.id === 'daily' ? ' daily' : ''}`} onClick={() => setChosen(g.id)}>
        <strong>{g.title}</strong>
        <span className="muted">{g.description}</span>
        {g.id === 'daily' && <DailyStatus results={props.daily ?? {}} today={today} />}
      </button>
    </li>
  )
  if (chosen && isCategory(chosen)) return <CategoryGames category={chosen} card={card} onBack={() => setChosen(null)} />
  if (chosen) return <DifficultyChoice id={chosen} {...bests} onStart={onStart} {...back} />
  return (
    <>
      <p className="muted">Test your geography. Pick a kind of game, then a game and how hard you want it.</p>
      <ul className="game-list">
        {GAMES.filter((g) => !g.category).map(card)}
        {/* The others by what they ask about, each kind opening its games, or the only one */}
        {GAME_CATEGORIES.map((kind) => {
          const games = gamesOf(kind)
          return (
            <li key={kind}>
              <button
                type="button"
                className="game-card category-card"
                onClick={() => setChosen(games.length === 1 ? games[0].id : kind)}
              >
                <span className="category-title">
                  <strong>{kind}</strong>
                  {games.length > 1 && <span className="row-meta">{games.length} games</span>}
                  <ChevronIcon />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** The games of a kind: "Countries", "Flags"… */
function CategoryGames({
  category,
  card,
  onBack,
}: {
  category: GameCategory
  card: (game: (typeof GAMES)[number]) => ReactNode
  onBack: () => void
}) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← All games
      </button>
      <h3 className="game-heading">{category}</h3>
      <ul className="game-list" aria-label={category}>
        {gamesOf(category).map(card)}
      </ul>
    </div>
  )
}

function DifficultyChoice({ id, best, bestTimes, onStart, onBack, backTo }: {
  id: RoundGameId
  best: BestScores
  bestTimes: BestScores
  onStart: Props['onStart']
  onBack: () => void
  backTo: string
}) {
  const game = GAMES.find((g) => g.id === id)!
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">{game.title}</h3>
      <p className="muted">
        {game.description}
        {id === 'find' && ` ${MAX_TRIES} tries per country: ${MAX_TRIES} points on the first, 2 on the second, 1 on the third.`}
      </p>
      <p className="game-prompt">Choose a difficulty</p>
      <ul className="game-list">
        {DIFFICULTIES.map((d) => {
          const score = best[bestKey(id, d.id)]
          return (
            <li key={d.id}>
              <button type="button" className="game-card" onClick={() => onStart(id, d.id)}>
                <strong>{d.label}</strong>
                <span className="muted">{difficultyDescription(id, d.id)}</span>
                {score !== undefined && (
                  <span className="best-score">
                    Best: {formatScore(id, d.id, score)}
                    <RecordTime time={bestTimes[bestKey(id, d.id)]} />
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

const PROMPTS: Record<QuizKind, string> = {
  find: 'Find this country on the globe',
  flags: 'Which country has this flag?',
  name: 'Which country is highlighted on the globe?',
  shape: 'Which country has this shape?',
  capital: "What's the capital of",
  'capital-country': 'Which country has this capital?',
}

/** The game and its difficulty, with a clock running since it started ("name them all" shows its own) */
function GameHeader({ game }: { game: RoundGameState | LetterGameState | AllGameState }) {
  return (
    <p className="game-title">
      <span>
        {titleOf(game.id)} ·{' '}
        {game.kind === 'all'
          ? scopeLabel(game.scope)
          : game.id === 'daily'
            ? shortDay.format(game.startedAt)
            : difficultyLabel(game.difficulty)}
      </span>
      {game.kind !== 'all' && !game.finished && (
        <span className="game-clock" aria-label="Time">
          <Elapsed since={game.startedAt} until={game.endedAt} />
        </span>
      )}
    </p>
  )
}

function RoundPlay({ game, onPick, onDontKnow, onNext, onStop, onQuit }: Props & { game: RoundGameState }) {
  const { target, options } = currentRound(game)
  const { answer } = game
  const isLast = game.index === game.rounds.length - 1
  // In the daily challenge each round is its own quiz
  const kind = kindOf(game)
  const mode = answerMode(kind, game.difficulty)
  const done = game.index + (answer ? 1 : 0)

  const optionState = (option: CountryFeature) => {
    if (!answer) return ''
    if (option === target) return ' correct'
    return option === answer.picked ? ' wrong' : ' dimmed'
  }

  const isFind = kind === 'find'
  const isCapital = kind === 'capital'
  // The other way round: a capital, answered with its country
  const isCapitalCountry = kind === 'capital-country'
  const lastMiss = game.misses.at(-1)
  const triesLeft = MAX_TRIES - game.misses.length

  const feedback = () => {
    const name = target.properties.name
    if (!answer) {
      if (game.notACountry) return `${game.notACountry.properties.name} is a territory, not a country. Try again.`
      if (!lastMiss) return ''
      return `That's ${lastMiss.properties.name}. Try again: ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left.`
    }
    const points = isFind ? ` +${answer.points} ${answer.points === 1 ? 'point' : 'points'}` : ''
    if (isCapitalCountry) {
      const capital = capitalOf(target)
      if (answer.correct) return `Correct! ${capital} is the capital of ${name}.`
      if (!answer.picked || mode === 'choices') return `${capital} is the capital of ${name}.`
      return `${capital} is the capital of ${name}, not ${answer.picked.properties.name}.`
    }
    if (isCapital) {
      const capital = capitalOf(target)
      if (answer.correct) return `Correct! The capital of ${name} is ${capital}.`
      if (!answer.picked || mode === 'choices') return `The capital of ${name} is ${capital}.`
      return `${answer.alias ?? capitalOf(answer.picked)} is the capital of ${answer.picked.properties.name}. The capital of ${name} is ${capital}.`
    }
    if (answer.correct) return answer.alias ? `Correct: ${name} (you wrote ${answer.alias})${points}` : `Correct!${points}`
    if (!answer.picked || mode === 'choices') return `The answer is ${name}.`
    return `That's ${answer.picked.properties.name}. The answer is ${name}.`
  }
  // A territory is neither right nor wrong
  const tone = answer?.correct ? ' correct' : answer || (lastMiss && !game.notACountry) ? ' wrong' : ''

  return (
    <div className="game">
      <GameHeader game={game} />
      <div className="game-status">
        <span>
          Round {game.index + 1} of {game.rounds.length}
        </span>
        <span>{isFind ? `${game.score} points` : `Score ${game.score}`}</span>
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

      <p className="game-prompt">{PROMPTS[kind]}</p>
      {(isFind || isCapital) && <p className="game-target">{target.properties.name}</p>}
      {isCapitalCountry && <p className="game-target">{capitalOf(target)}</p>}
      {isFind && !answer && (
        <p className="tries" aria-label={`Try ${game.misses.length + 1} of ${MAX_TRIES}`}>
          {Array.from({ length: MAX_TRIES }, (_, i) => (
            <span key={i} className={i < game.misses.length ? 'used' : ''} />
          ))}
          <span className="muted">
            Worth {triesLeft} {triesLeft === 1 ? 'point' : 'points'}
          </span>
        </p>
      )}
      {kind === 'flags' && <img className="game-flag" src={flagUrl(target)!} alt="The flag to identify" />}
      {kind === 'shape' && <CountryShape country={target} />}

      {mode === 'choices' && (
        <div className="options">
          {options.map((option) => (
            <button
              key={option.properties.name}
              type="button"
              className={`option${optionState(option)}`}
              disabled={!!answer}
              onClick={() => onPick(option)}
            >
              {isCapital ? capitalOf(option) : option.properties.name}
            </button>
          ))}
        </div>
      )}
      {mode === 'typing' && !answer && isCapital && <CapitalInput key={game.index} onAnswer={onPick} />}
      {mode === 'typing' && !answer && !isCapital && <CountryInput key={game.index} onAnswer={onPick} />}

      <p className={`feedback${tone}`} role="status">
        {feedback()}
      </p>

      {!answer && (
        <button type="button" className="primary-button secondary" onClick={onDontKnow}>
          I don't know
        </button>
      )}

      {answer && (
        // Focus moves here so Enter continues to the next round
        <button type="button" className="primary-button" onClick={onNext} autoFocus>
          {isLast ? 'See results' : 'Next'}
        </button>
      )}
      {game.difficulty === 'all' && roundsPlayed(game) > 0 && (
        <button type="button" className="text-button" onClick={onStop}>
          Stop and see results
        </button>
      )}
      <button type="button" className="text-button" onClick={onQuit}>
        Quit game
      </button>
    </div>
  )
}

function LetterHunt({ game, onNext, onQuit }: Props & { game: LetterGameState }) {
  const { last } = game
  const lastName = last?.country.properties.name
  const feedback = {
    found: `${lastName} ✓`,
    again: `You already found ${lastName}.`,
    'wrong-letter': `${lastName} doesn't start with ${game.letter}.`,
    territory: `${lastName} is a territory, not a country.`,
  }

  return (
    <div className="game">
      <GameHeader game={game} />
      <p className="game-prompt">Click every country starting with</p>
      <p className="game-letter" aria-label={`the letter ${game.letter}`}>
        {game.letter}
      </p>
      <div className="game-status">
        <span>
          Found {game.found.length} of {game.targets.length}
        </span>
        <span>
          {game.mistakes} {game.mistakes === 1 ? 'mistake' : 'mistakes'}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Countries found"
        aria-valuemin={0}
        aria-valuemax={game.targets.length}
        aria-valuenow={game.found.length}
      >
        <div style={{ width: `${(game.found.length / game.targets.length) * 100}%` }} />
      </div>

      <p className={`feedback${last ? (last.result === 'found' ? ' correct' : ' wrong') : ''}`} role="status">
        {last && feedback[last.result]}
      </p>
      {game.found.length > 0 && (
        <ul className="found-list" aria-label="Found">
          {game.found.map((c) => (
            <li key={c.properties.name}>{c.properties.name}</li>
          ))}
        </ul>
      )}

      <button type="button" className="primary-button secondary" onClick={onNext}>
        Give up and show the rest
      </button>
      <button type="button" className="text-button" onClick={onQuit}>
        Quit game
      </button>
    </div>
  )
}

function verdict(share: number) {
  if (share === 1) return 'Perfect! A true geographer.'
  if (share >= 0.7) return 'Great job!'
  if (share >= 0.4) return 'Not bad. Keep practising!'
  return 'Keep exploring the globe and try again!'
}

function Results(props: Props & Chosen & { game: GameState }) {
  const { game, previousBest, setChosen, onQuit } = props
  if (game.kind === 'higher') {
    const allGames = () => {
      setChosen(null)
      onQuit()
    }
    return <HigherLowerResults game={game} previousBest={previousBest} onStart={props.onStartHigher} onAllGames={allGames} />
  }
  if (game.kind === 'city') {
    const allGames = () => {
      setChosen(null)
      onQuit()
    }
    return (
      <CityResults
        game={game}
        previousBest={previousBest}
        previousTime={props.previousTime}
        onStart={(level) => props.onStartCity?.(level)}
        onAllGames={allGames}
      />
    )
  }
  if (game.kind === 'neighbours') {
    const allGames = () => {
      setChosen(null)
      onQuit()
    }
    return (
      <NeighboursResults
        game={game}
        previousBest={previousBest}
        previousTime={props.previousTime}
        onStart={(level) => props.onStartNeighbours?.(level)}
        onAllGames={allGames}
      />
    )
  }
  if (game.kind === 'rounds' && game.id === 'daily') {
    const allGames = () => {
      setChosen(null)
      onQuit()
    }
    return <DailyResultsView game={game} results={props.daily ?? {}} onAllGames={allGames} />
  }
  return <ScoredResults {...props} game={game} />
}

function ScoredResults(props: Props & Chosen & { game: RoundGameState | LetterGameState | AllGameState }) {
  const { game, previousBest, previousTime, onStart, onStartLetter, onStartAll, onQuit, setChosen } = props
  const score = gameScore(game)
  const newBest = previousBest !== undefined && score > previousBest
  const share = game.kind === 'rounds' ? score / Math.max(1, maxScorePlayed(game)) : score / game.targets.length
  const playAgain = () => {
    if (game.kind === 'letter') onStartLetter(game.letter)
    else if (game.kind === 'all') onStartAll(game.scope)
    else onStart(game.id, game.difficulty)
  }
  const backTo = (id: GameId | null) => {
    setChosen(id)
    onQuit()
  }

  return (
    <div className="game game-results">
      <GameHeader game={game} />
      {game.kind === 'letter' ? (
        <>
          <p className="big-score">
            {game.found.length} / {game.targets.length}
          </p>
          <p>
            countries starting with {game.letter} found, with {game.mistakes}{' '}
            {game.mistakes === 1 ? 'mistake' : 'mistakes'}
          </p>
          {missing(game).length > 0 && (
            <p className="muted">Missed (highlighted on the globe): {missing(game).map((c) => c.properties.name).join(', ')}</p>
          )}
        </>
      ) : game.kind === 'all' ? (
        <AllResults game={game} />
      ) : (
        <>
          <p className="big-score">
            {game.score} / {game.stoppedEarly ? maxScorePlayed(game) : maxScore(game)}
          </p>
          {game.id === 'find' && <p className="muted">points</p>}
          {game.stoppedEarly && (
            <p className="muted">
              Stopped after {roundsPlayed(game)} of {game.rounds.length} countries
            </p>
          )}
        </>
      )}
      <p>{verdict(share)}</p>
      {newBest && <p className="new-best">New best score!</p>}
      <RunTime game={game} previousTime={previousTime} />
      <button
        type="button"
        className="primary-button"
        onClick={playAgain}
      >
        Play again
      </button>
      {game.kind === 'letter' && (
        <button type="button" className="primary-button secondary" onClick={() => backTo('letter')}>
          Another letter
        </button>
      )}
      <button type="button" className="text-button" onClick={() => backTo(null)}>
        All games
      </button>
    </div>
  )
}

/** Every letter, grouped by difficulty, with the best score for each. */
function LetterChoice({ best, bestTimes, onStartLetter, onBack, backTo }: {
  best: BestScores
  bestTimes: BestScores
  onStartLetter: (letter: string) => void
  onBack: () => void
  backTo: string
}) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">{titleOf('letter')}</h3>
      <p className="muted">
        Click every country starting with a letter. Letters are grouped by how many countries start with them, and
        how well known those are. Pick one, or a random one.
      </p>
      {DIFFICULTIES.filter((d) => d.id !== 'all').map((d) => (
        <section key={d.id} className="letter-group" aria-labelledby={`letters-${d.id}`}>
          <div className="letter-group-header">
            <h4 id={`letters-${d.id}`}>{d.label}</h4>
            <button type="button" className="text-button" onClick={() => onStartLetter(randomLetter(d.id))}>
              Random {d.label.toLowerCase()} letter
            </button>
          </div>
          <ul className="letter-grid">
            {lettersOf(d.id).map((letter) => {
              const total = countriesStartingWith(letter).length
              const score = best[letterKey(letter)]
              const time = bestTimes[letterKey(letter)]
              const complete = score === total
              const record = time === undefined ? '' : `, record ${formatRunTime(time)}`
              return (
                <li key={letter}>
                  <button
                    type="button"
                    className={`letter-tile${complete ? ' complete' : ''}`}
                    onClick={() => onStartLetter(letter)}
                    aria-label={`${letter}: ${total} countries${score === undefined ? '' : `, best ${score} of ${total}`}${record}`}
                    title={time === undefined ? undefined : `Record: ${formatRunTime(time)}`}
                  >
                    <span className="letter-tile-letter">{letter}</span>
                    <span className="letter-tile-best">{score === undefined ? `–/${total}` : `${score}/${total}`}</span>
                    {time !== undefined && <span className="letter-tile-time">{formatRunTime(time)}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Choose the whole world or a continent for "name them all", with the best for each. */
function ScopeChoice({ best, bestTimes, onStartAll, onBack, backTo }: {
  best: BestScores
  bestTimes: BestScores
  onStartAll: (scope: Scope) => void
  onBack: () => void
  backTo: string
}) {
  return (
    <div className="game">
      <button type="button" className="text-button" onClick={onBack}>
        ← {backTo}
      </button>
      <h3 className="game-heading">{titleOf('all')}</h3>
      <p className="muted">
        Type every country you can think of, from memory. Each one lights up on the globe. Give up when you're
        stuck to see what you missed.
      </p>
      <p className="game-prompt">Which countries?</p>
      <ul className="game-list">
        {SCOPES.map((scope) => {
          const total = countriesIn(scope).length
          const score = best[scopeKey(scope)]
          return (
            <li key={scope}>
              <button type="button" className="game-card" onClick={() => onStartAll(scope)}>
                <strong>{scopeLabel(scope)}</strong>
                <span className="muted">{total} countries</span>
                {score !== undefined && (
                  <span className="best-score">
                    Best: {score} / {total}
                    <RecordTime time={bestTimes[scopeKey(scope)]} />
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

function NameThemAll({ game, onPick, onNext, onQuit }: Props & { game: AllGameState }) {
  const { last } = game
  const name = last?.country.properties.name
  const outside = game.scope === 'world' ? '' : game.scope
  const feedback = last && {
    found: last.alias ? `${name} ✓ (you wrote ${last.alias})` : `${name} ✓`,
    again: `You already named ${name}.`,
    elsewhere: `${name} isn't in ${outside}.`,
    territory: `${name} is a territory, not a country.`,
  }[last.result]

  return (
    <div className="game">
      <GameHeader game={game} />
      <div className="all-score">
        <span className="big-score">
          {game.found.length} / {game.targets.length}
        </span>
        <Elapsed since={game.startedAt} until={game.endedAt} />
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Countries named"
        aria-valuemin={0}
        aria-valuemax={game.targets.length}
        aria-valuenow={game.found.length}
      >
        <div style={{ width: `${(game.found.length / game.targets.length) * 100}%` }} />
      </div>

      <CountryInput label="Name a country" onAnswer={onPick} />
      <p className={`feedback${last ? (last.result === 'found' ? ' correct' : ' wrong') : ''}`} role="status">
        {feedback}
      </p>

      {game.scope === 'world' && <ContinentProgress game={game} />}
      {game.found.length > 0 && (
        <ul className="found-list" aria-label="Named">
          {[...game.found].reverse().map((c) => (
            <li key={c.properties.name}>{c.properties.name}</li>
          ))}
        </ul>
      )}

      <button type="button" className="primary-button secondary" onClick={onNext}>
        Give up and show the rest
      </button>
      <button type="button" className="text-button" onClick={onQuit}>
        Quit game
      </button>
    </div>
  )
}

/** How many of each continent's countries have been named */
function ContinentProgress({ game }: { game: AllGameState }) {
  return (
    <ul className="continent-stats" aria-label="Named by continent">
      {CONTINENTS.filter((c) => countriesIn(c).length > 0).map((continent) => {
        const total = countriesIn(continent).length
        const count = game.found.filter((c) => c.properties.continent === continent).length
        return (
          <li key={continent}>
            <span className="continent-name">{continent}</span>
            <span className="continent-count">
              {count} / {total}
            </span>
            <span />
            <div className="progress small" aria-hidden="true">
              <div style={{ width: `${(count / total) * 100}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function AllResults({ game }: { game: AllGameState }) {
  const missed = missingAll(game)
  const byContinent = CONTINENTS.map((continent) => ({
    continent,
    names: missed.filter((c) => c.properties.continent === continent).map((c) => c.properties.name),
  })).filter((group) => group.names.length > 0)

  return (
    <>
      <p className="big-score">
        {game.found.length} / {game.targets.length}
      </p>
      <p>countries named</p>
      {missed.length > 0 && (
        <div className="missed">
          <p className="muted">Missed, highlighted on the globe:</p>
          {byContinent.map(({ continent, names }) => (
            <p key={continent} className="muted">
              {game.scope === 'world' && <strong>{continent}: </strong>}
              {names.join(', ')}
            </p>
          ))}
        </div>
      )}
    </>
  )
}
