import { maxScore } from './games'
import { maxCityScore } from './cityGame'
import { neighboursPercent } from './neighboursGame'
import type { GameState } from './useGame'

/** The fastest perfect run of each game, in milliseconds, keyed like the best scores */
export const BEST_TIMES_KEY = 'countries-app.best-times'

/**
 * Every point, without a mistake, played to the end: only these runs set a
 * time record, so being fast but wrong doesn't count. "Find the country"
 * needs every country on the first try; "find the city" every city spot on;
 * the letter hunt no wrong letters.
 */
export function isPerfect(game: GameState) {
  // A streak game keeps its longest streak, not a time
  if (!game.finished || game.kind === 'higher' || game.kind === 'bigger') return false
  if (game.kind === 'rounds') return !game.stoppedEarly && game.score === maxScore(game)
  // Every city within spot on
  if (game.kind === 'city') return game.score === maxCityScore(game)
  // Every neighbour named, none shown, without naming a country that isn't one
  if (game.kind === 'neighbours') return !game.gaveUp && game.mistakes === 0 && neighboursPercent(game) === 100
  if (game.kind === 'letter') return !game.gaveUp && game.mistakes === 0
  return !game.gaveUp
}

/** How long a run took, in milliseconds: from the start to the last answer */
export const runTime = (game: GameState) => (game.endedAt ?? game.startedAt) - game.startedAt

/** "0:42.3", to the tenth of a second */
export function formatRunTime(ms: number) {
  const tenths = Math.floor(ms / 100)
  const seconds = Math.floor(tenths / 10)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.${tenths % 10}`
}
