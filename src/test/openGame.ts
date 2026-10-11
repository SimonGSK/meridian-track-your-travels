import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GAMES, gamesOf } from '../games/games'

/** A card in the Games list: a game, or a kind of games, by the name it starts with */
const card = (name: string) =>
  screen.getAllByRole('button').find((button) => button.classList.contains('game-card') && button.textContent!.startsWith(name))!

/** Opens a game's setup from the Games list: its kind, then it (or just its kind, when it's the only one) */
export async function openGame(title: string) {
  const { category } = GAMES.find((game) => game.title === title)!
  if (category) await userEvent.click(card(category))
  if (!category || gamesOf(category).length > 1) await userEvent.click(card(title))
}
