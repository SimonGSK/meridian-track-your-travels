import { countries, type CountryFeature } from '../countries'
import { capitalOf } from '../data/capitals'
import type { City } from '../data/cities'
import { flagUrl } from '../flags'

export type GameId =
  | 'daily'
  | 'find'
  | 'city'
  | 'city-country'
  | 'flags'
  | 'name'
  | 'shape'
  | 'capital'
  | 'capital-country'
  | 'letter'
  | 'all'
  | 'higher'
  | 'neighbours'
/** Games played in rounds, at a difficulty (the daily challenge mixes the others) */
export type RoundGameId = Exclude<GameId, 'letter' | 'all' | 'higher' | 'city' | 'neighbours'>
/** What a round asks: one of the quizzes */
export type QuizKind = Exclude<RoundGameId, 'daily'>
/** "all" goes through every country, instead of 10 rounds */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'all'

/** The kinds of games, in the order they're listed, after the daily challenge */
export const GAME_CATEGORIES = ['Countries', 'Flags', 'Capitals', 'Cities', 'Facts'] as const
export type GameCategory = (typeof GAME_CATEGORIES)[number]

/** Every game, by kind; the daily challenge, a mix of the others, has none and comes first */
export const GAMES: { id: GameId; title: string; description: string; category: GameCategory | null }[] = [
  {
    id: 'daily',
    title: 'Daily challenge',
    description: 'Five countries, one of each quiz, the same for everyone today.',
    category: null,
  },
  { id: 'find', title: 'Find the country', description: 'We name a country, you click it on the globe.', category: 'Countries' },
  {
    id: 'name',
    title: 'Name that country',
    description: 'A country lights up on the globe. Which one is it?',
    category: 'Countries',
  },
  { id: 'shape', title: 'Shape quiz', description: 'Name the country from its outline alone.', category: 'Countries' },
  {
    id: 'neighbours',
    title: 'Neighbours',
    description: 'Name every country bordering the one lit up on the globe.',
    category: 'Countries',
  },
  { id: 'letter', title: 'Letter hunt', description: 'Click every country that starts with a letter.', category: 'Countries' },
  { id: 'all', title: 'Name them all', description: 'Type every country you can think of, from memory.', category: 'Countries' },
  { id: 'flags', title: 'Flag quiz', description: 'Which country has this flag?', category: 'Flags' },
  {
    id: 'capital',
    title: 'Capital quiz',
    description: "What's the capital of the country lit up on the globe?",
    category: 'Capitals',
  },
  { id: 'capital-country', title: 'Whose capital?', description: 'Which country has this capital?', category: 'Capitals' },
  {
    id: 'city',
    title: 'Find the city',
    description: 'We name a city, you click where it is. The closer, the more points.',
    category: 'Cities',
  },
  { id: 'city-country', title: 'Whose city?', description: 'Which country is this city in?', category: 'Cities' },
  {
    id: 'higher',
    title: 'Higher or lower',
    description: 'More people, or fewer? Bigger, or smaller? Keep it going.',
    category: 'Facts',
  },
]

/** What's open in the Games tab: a kind of games, listed, or a game's setup */
export type GameChoice = GameId | GameCategory

export const isCategory = (choice: GameChoice): choice is GameCategory => (GAME_CATEGORIES as readonly string[]).includes(choice)

/** The games of a kind */
export const gamesOf = (category: GameCategory) => GAMES.filter((g) => g.category === category)

/**
 * The kind whose list a game is in, or null for one picked straight from all
 * games: the daily challenge, and the only game of its kind
 */
export function listedUnder(id: GameId) {
  const { category } = GAMES.find((g) => g.id === id)!
  return category && gamesOf(category).length > 1 ? category : null
}

export const DIFFICULTIES: { id: Difficulty; label: string; countries: string }[] = [
  { id: 'easy', label: 'Easy', countries: 'Big countries' },
  { id: 'medium', label: 'Medium', countries: 'All but the smallest countries' },
  { id: 'hard', label: 'Hard', countries: 'All 197 countries, even the tiniest' },
  { id: 'all', label: 'All countries', countries: 'Every one of the 197 countries, one after another' },
]

export const ROUNDS = 10
export const OPTION_COUNT = 4
/** In "find the country": tries per round, and points for getting it on the first, second or third */
export const MAX_TRIES = 3

/** In "whose city?", the cities each difficulty asks about */
const CITIES_ASKED: Partial<Record<Difficulty, string>> = {
  easy: 'The biggest city of big countries, but not the capital',
  medium: 'The big cities of all but the smallest countries',
  hard: 'Any city in any country, even the small ones people know',
}

/** The difficulties a game offers: "whose city?" has no "all countries", as not every country has a city to ask about */
export const difficultiesOf = (id: GameId) => DIFFICULTIES.filter((d) => id !== 'city-country' || d.id !== 'all')

/** What a difficulty means for a game, e.g. "Big countries. Pick from four answers." */
export function difficultyDescription(id: GameId, difficulty: Difficulty) {
  if (id === 'find' && difficulty === 'hard') return 'All but the biggest countries, even the tiniest.'
  if (id === 'city-country') {
    return `${CITIES_ASKED[difficulty]}. ${answerMode(id, difficulty) === 'choices' ? 'Pick from four answers.' : 'Type your answers.'}`
  }
  const { countries } = DIFFICULTIES.find((d) => d.id === difficulty)!
  const mode = answerMode(id, difficulty)
  if (mode === 'choices') return `${countries}. Pick from four answers.`
  if (mode === 'typing') return `${countries}. Type your answers.`
  return `${countries}.`
}

/** Smallest country (km²) in each difficulty; hard has them all */
const MIN_AREA_KM2: Record<Difficulty, number> = { easy: 100_000, medium: 5_000, hard: 0, all: 0 }
/** Hard "find the country" leaves out the biggest countries (km²), which are too easy to spot */
export const HARD_FIND_MAX_KM2 = 500_000

type Random = () => number

const allCountries = countries.filter((c) => c.properties.kind === 'country')

/** The countries a game can ask about at a difficulty. */
export function gamePool(id: GameId, difficulty: Difficulty): CountryFeature[] {
  const tooEasy = (c: CountryFeature) =>
    id === 'find' && difficulty === 'hard' && c.properties.areaKm2 >= HARD_FIND_MAX_KM2
  return allCountries.filter(
    (c) =>
      c.properties.areaKm2 >= MIN_AREA_KM2[difficulty] &&
      !tooEasy(c) &&
      (id !== 'flags' || flagUrl(c)) &&
      ((id !== 'capital' && id !== 'capital-country') || capitalOf(c)),
  )
}

/** Easy games pick from four answers; harder ones are typed. Finding is always done on the globe. */
export function answerMode(id: GameId, difficulty: Difficulty): 'globe' | 'choices' | 'typing' {
  if (id === 'find' || id === 'letter') return 'globe'
  if (id === 'all') return 'typing'
  return difficulty === 'easy' ? 'choices' : 'typing'
}

export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// ── Games played in rounds: find, flags, name, shape ─────────────────────────

export type Round = {
  /** Which quiz it is, when the game mixes them (the daily challenge); else the game's */
  kind?: QuizKind
  target: CountryFeature
  /** Answer choices, including the target. Empty unless answering by choosing. */
  options: CountryFeature[]
  /** In "whose city?": the city named, in the target country */
  city?: City
}

export type Answer = {
  /** Null when you said you didn't know */
  picked: CountryFeature | null
  correct: boolean
  /** The name typed, when it's an older or alternative name, e.g. "Swaziland" */
  alias: string | null
  /** Points won this round */
  points: number
}

export type RoundGameState = {
  kind: 'rounds'
  id: RoundGameId
  difficulty: Difficulty
  rounds: Round[]
  index: number
  score: number
  /** The points won in each round, once it's over */
  scores: number[]
  /** Set once the current round is over */
  answer: Answer | null
  /** Wrong tries so far this round ("find the country" allows MAX_TRIES) */
  misses: CountryFeature[]
  /** A territory just picked: it isn't a country, so it doesn't count either way */
  notACountry: CountryFeature | null
  finished: boolean
  /** Ended before the last round, scoring the rounds played */
  stoppedEarly: boolean
  startedAt: number
  /** When the last round was answered, or the game stopped: the run's time ends there, not at the results */
  endedAt: number | null
}

/** Rounds in a game: ten, or every country in the pool for "all" */
export const roundCount = (difficulty: Difficulty, pool: readonly CountryFeature[]) =>
  difficulty === 'all' ? pool.length : Math.min(ROUNDS, pool.length)

/** The most points a full game can score */
export const maxScoreFor = (id: RoundGameId, difficulty: Difficulty) =>
  roundCount(difficulty, gamePool(id, difficulty)) * (id === 'find' ? MAX_TRIES : 1)

export function newRoundGame(
  id: RoundGameId,
  difficulty: Difficulty,
  random: Random = Math.random,
  pool = gamePool(id, difficulty),
  now = Date.now(),
): RoundGameState {
  const targets = shuffle(pool, random).slice(0, roundCount(difficulty, pool))
  const withChoices = answerMode(id, difficulty) === 'choices'
  const rounds = targets.map((target) => ({
    target,
    options: withChoices
      ? shuffle([target, ...shuffle(pool.filter((c) => c !== target), random).slice(0, OPTION_COUNT - 1)], random)
      : [],
  }))
  return {
    kind: 'rounds',
    id,
    difficulty,
    rounds,
    index: 0,
    score: 0,
    scores: [],
    answer: null,
    misses: [],
    notACountry: null,
    finished: false,
    stoppedEarly: false,
    startedAt: now,
    endedAt: null,
  }
}

/** Rounds answered so far */
export const roundsPlayed = (game: RoundGameState) => game.index + (game.answer ? 1 : 0)

/** Which quiz a round is: its own kind in a mix, else the game's */
export const kindOf = (game: RoundGameState, index = game.index): QuizKind =>
  game.rounds[index]?.kind ?? (game.id as QuizKind)

/** "Find the country" scores 3, 2 or 1 points by try; the others 1 point a round */
export const pointsFor = (kind: QuizKind) => (kind === 'find' ? MAX_TRIES : 1)
const pointsOf = (game: RoundGameState, rounds: number) =>
  game.rounds.slice(0, rounds).reduce((sum, _, i) => sum + pointsFor(kindOf(game, i)), 0)

/** End the game now, scoring the rounds played (an unanswered round doesn't count) */
export function stopEarly(game: RoundGameState, now = Date.now()): RoundGameState {
  return game.finished ? game : { ...game, finished: true, stoppedEarly: true, endedAt: game.endedAt ?? now }
}

/** "Find the country" scores 3, 2 or 1 points by try; the other games 1 point per round. */
export const maxScore = (game: RoundGameState) => pointsOf(game, game.rounds.length)
/** The most points the rounds played could have scored */
export const maxScorePlayed = (game: RoundGameState) => pointsOf(game, roundsPlayed(game))

export const currentRound = (game: RoundGameState) => game.rounds[game.index]

/** Answering the last round ends the run */
const endedAt = (game: RoundGameState, now: number) => (game.index === game.rounds.length - 1 ? now : null)

/**
 * Answer the current round. In "find the country" a wrong country is a
 * miss and you try again, up to MAX_TRIES, for fewer points each time.
 * Territories aren't countries, so picking one doesn't count either way.
 * Answers after the round is over are ignored.
 */
export function answer(
  game: RoundGameState,
  picked: CountryFeature,
  alias: string | null = null,
  now = Date.now(),
): RoundGameState {
  if (game.answer || game.finished || game.misses.includes(picked)) return game
  if (picked.properties.kind !== 'country') return { ...game, notACountry: picked }
  const correct = picked === currentRound(game).target
  const tries = pointsFor(kindOf(game))
  if (!correct && game.misses.length + 1 < tries) return { ...game, misses: [...game.misses, picked], notACountry: null }
  const points = correct ? tries - game.misses.length : 0
  const misses = correct ? game.misses : [...game.misses, picked]
  return {
    ...game,
    answer: { picked, correct, alias, points },
    misses,
    notACountry: null,
    score: game.score + points,
    scores: [...game.scores, points],
    endedAt: endedAt(game, now),
  }
}

/** "I don't know": the round is over and lost, showing the answer. Misses so far stay. */
export function dontKnow(game: RoundGameState, now = Date.now()): RoundGameState {
  if (game.answer || game.finished) return game
  return {
    ...game,
    answer: { picked: null, correct: false, alias: null, points: 0 },
    notACountry: null,
    scores: [...game.scores, 0],
    endedAt: endedAt(game, now),
  }
}

/** Move on to the next round once the current one is answered. */
export function next(game: RoundGameState): RoundGameState {
  if (!game.answer) return game
  if (game.index + 1 >= game.rounds.length) return { ...game, finished: true }
  return { ...game, index: game.index + 1, answer: null, misses: [], notACountry: null }
}
