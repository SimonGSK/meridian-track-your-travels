import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VisitedPanel from './VisitedPanel'
import { percentLabel } from './percentLabel'
import { countries } from '../countries'

function setup(visited: string[] = []) {
  const props = { visited: new Set(visited), onAdd: vi.fn(), onRemove: vi.fn(), onShow: vi.fn() }
  render(<VisitedPanel {...props} />)
  return props
}

const search = () => screen.getByRole('searchbox', { name: 'Add a country' })
/** A figure in the stats box */
const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling
const results = () => screen.queryByRole('list', { name: 'Search results' })
/** Opens a continent's places, over the rest */
const toggle = (continent: string) => userEvent.click(screen.getByRole('button', { name: continent }))
/** The places listed under a continent's bar */
const listed = (continent: string) =>
  within(screen.getByRole('list', { name: `Visited in ${continent}` }))
    .getAllByRole('button', { name: /^(?!Remove)/ })
    .map((b) => b.textContent)

describe('VisitedPanel', () => {
  it("shows how many of the world's countries have been visited", () => {
    setup(['Denmark', 'Japan'])
    expect(stat('Countries')).toHaveTextContent('2 / 197')
    expect(screen.getByRole('progressbar', { name: "Share of the world's countries visited" })).toHaveAttribute(
      'aria-valuenow',
      '2',
    )
  })

  it('counts the cities visited', () => {
    render(<VisitedPanel visited={new Set(['Denmark'])} onAdd={() => {}} onRemove={() => {}} onShow={() => {}} cityCount={3} />)
    expect(stat('Cities')).toHaveTextContent('3')
  })

  it('counts territories separately', () => {
    setup(['Denmark', 'Greenland', 'Faroe Islands'])
    expect(screen.getByRole('progressbar', { name: "Share of the world's countries visited" })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    expect(stat('Territories')).toHaveTextContent(/^2 \/ \d+$/)
  })

  it('counts the country a territory visited belongs to, as being there', () => {
    setup(['Iceland', 'Greenland'])
    expect(stat('Countries')).toHaveTextContent('2 / 197') // Iceland, and Denmark in Greenland
    expect(stat('Territories')).toHaveTextContent(/^1 \/ \d+$/)
    expect(screen.getByRole('progressbar', { name: 'Europe: 2 of 46 countries' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'North America: 0 of 23 countries' })).toBeInTheDocument()
  })

  it("lists a country been to only in a territory under its continent, saying where, with nothing to remove", async () => {
    const { onShow } = setup(['Iceland', 'Greenland', 'Faroe Islands'])
    await toggle('Europe')
    expect(listed('Europe')).toEqual(['DenmarkIn Faroe Islands and Greenland', 'Faroe IslandsTerritory', 'Iceland'])
    expect(screen.queryByRole('button', { name: 'Remove Denmark' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Faroe Islands' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^Denmark/ }))
    expect(onShow).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ name: 'Denmark' }) }))
  })

  it('invites you to add countries when none are visited', () => {
    setup()
    expect(screen.getByText(/None yet/)).toBeInTheDocument()
  })

  it("opens a continent's places over the rest: those visited, then its countries not yet; closed again", async () => {
    setup(['Japan', 'Denmark', 'Brazil', 'Sweden', 'Argentina'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await toggle('Europe')
    expect(screen.getByRole('dialog', { name: 'Europe' })).toHaveTextContent('2 / 46')
    expect(listed('Europe')).toEqual(['Denmark', 'Sweden'])
    const notYet = within(screen.getByRole('list', { name: 'Not yet in Europe' })).getAllByRole('listitem')
    expect(notYet).toHaveLength(44)
    expect(notYet.map((li) => li.textContent)).toContain('Norway')
    expect(screen.getByRole('button', { name: 'Europe' })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // The bar itself opens it too, and Escape closes it
    await userEvent.click(screen.getByRole('progressbar', { name: 'Asia: 1 of 48 countries' }))
    expect(listed('Asia')).toEqual(['Japan'])
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await toggle('Africa')
    expect(screen.getByText('None yet in Africa.')).toBeInTheDocument()
  })

  it('has nothing to remove for a place a trip has been to', async () => {
    render(
      <VisitedPanel visited={new Set(['Denmark', 'Sweden'])} inTrips={new Set(['Sweden'])} onAdd={vi.fn()} onRemove={vi.fn()} onShow={vi.fn()} />,
    )
    await toggle('Europe')
    expect(screen.getByRole('button', { name: 'Remove Denmark' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Sweden' })).not.toBeInTheDocument()
  })

  it("shows Antarctica, which has no countries, once you've been to one of its territories", async () => {
    const antarctic = countries.find((c) => c.properties.continent === 'Antarctica')!
    setup(['Denmark'])
    expect(screen.queryByRole('button', { name: 'Antarctica' })).not.toBeInTheDocument()
    cleanup()
    setup([antarctic.properties.name])
    expect(screen.getByRole('button', { name: 'Antarctica' }).closest('.continent-row')).toHaveTextContent('1 place')
    await toggle('Antarctica')
    expect(listed('Antarctica')).toEqual([expect.stringContaining(antarctic.properties.name)])
  })

  it('adds the place found', async () => {
    const { onAdd } = setup(['Denmark'])
    await userEvent.type(search(), 'peru{Enter}')
    expect(onAdd).toHaveBeenCalledWith('Peru')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('notes how many states and cities of a country are visited', async () => {
    render(
      <VisitedPanel
        visited={new Set(['United States', 'Denmark'])}
        onAdd={() => {}}
        onRemove={() => {}}
        onShow={() => {}}
        note={(c) => (c.properties.name === 'United States' ? '3 of 51 states' : null)}
      />,
    )
    await toggle('North America')
    expect(screen.getByRole('button', { name: /^United States/ })).toHaveTextContent('3 of 51 states')
    await toggle('Europe')
    expect(screen.getByRole('button', { name: /^Denmark/ })).toHaveTextContent(/^Denmark$/)
  })

  it('marks territories in the list', async () => {
    setup(['Denmark', 'Greenland'])
    await toggle('North America')
    const northAmerica = screen.getByRole('list', { name: 'Visited in North America' })
    expect(within(northAmerica).getByRole('button', { name: /^Greenland/ })).toHaveTextContent('Territory')
  })

  it('shows how much of each continent has been visited', () => {
    setup(['Denmark', 'Sweden', 'Norway', 'Japan', 'Greenland'])
    const europe = screen.getByRole('progressbar', { name: 'Europe: 3 of 46 countries' })
    expect(europe).toHaveAttribute('aria-valuenow', '3')
    expect(europe).toHaveAttribute('aria-valuetext', '7%')
    expect(screen.getByRole('progressbar', { name: 'Asia: 1 of 48 countries' })).toBeInTheDocument()
    // Greenland is a territory, so North America stays at 0
    expect(screen.getByRole('progressbar', { name: 'North America: 0 of 23 countries' })).toBeInTheDocument()
  })

  it('shows every inhabited continent, even with nothing visited', () => {
    setup()
    const stats = screen.getByRole('list', { name: 'Countries visited by continent' })
    expect(within(stats).getAllByRole('listitem').map((li) => li.querySelector('.continent-name')!.textContent)).toEqual([
      'Africa',
      'Asia',
      'Europe',
      'North America',
      'Oceania',
      'South America',
    ])
  })

  it('searches countries that are not visited yet', async () => {
    setup(['Denmark'])
    await userEvent.type(search(), 'de')
    const names = within(results()!).getAllByRole('button').map((b) => b.textContent)
    expect(names).not.toContain('DenmarkAdd')
    expect(names).toContain('Democratic Republic of the CongoAdd')
  })

  it('finds countries by their former names', async () => {
    const { onAdd } = setup()
    await userEvent.type(search(), 'Swaziland')
    expect(within(results()!).getByRole('button')).toHaveTextContent('Eswatini (Swaziland)')
    await userEvent.keyboard('{Enter}')
    expect(onAdd).toHaveBeenCalledWith('Eswatini')
  })

  it('says when nothing matches', async () => {
    setup()
    await userEvent.type(search(), 'atlantis')
    expect(results()).not.toBeInTheDocument()
    expect(screen.getByText('No matching countries.')).toBeInTheDocument()
  })

  it('adds a country by clicking a result, then clears the search', async () => {
    const { onAdd } = setup()
    await userEvent.type(search(), 'japa')
    await userEvent.click(within(results()!).getByRole('button', { name: /Japan/ }))
    expect(onAdd).toHaveBeenCalledWith('Japan')
    expect(search()).toHaveValue('')
  })

  it('adds the first result when pressing Enter', async () => {
    const { onAdd } = setup()
    await userEvent.type(search(), 'denm{Enter}')
    expect(onAdd).toHaveBeenCalledWith('Denmark')
  })

  it('removes a country', async () => {
    const { onRemove } = setup(['Denmark'])
    await toggle('Europe')
    await userEvent.click(screen.getByRole('button', { name: 'Remove Denmark' }))
    expect(onRemove).toHaveBeenCalledWith('Denmark')
  })

  it('shows a country on the globe when clicked, visited or not yet, closing the list', async () => {
    const { onShow } = setup(['Denmark'])
    await toggle('Europe')
    await userEvent.click(screen.getByRole('button', { name: 'Denmark' }))
    expect(onShow).toHaveBeenCalledWith(countries.find((c) => c.properties.name === 'Denmark'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await toggle('Europe')
    await userEvent.click(screen.getByRole('button', { name: 'Norway' }))
    expect(onShow).toHaveBeenLastCalledWith(countries.find((c) => c.properties.name === 'Norway'))
  })
})

describe('percentLabel', () => {
  describe('the wishlist', () => {
    function withWishlist(wishlist: string[], visited: string[] = []) {
      const props = {
        visited: new Set(visited),
        wishlist: new Set(wishlist),
        onAdd: vi.fn(),
        onRemove: vi.fn(),
        onShow: vi.fn(),
        onWish: vi.fn(),
        onUnwish: vi.fn(),
      }
      render(<VisitedPanel {...props} />)
      return props
    }
    const wishlist = () => screen.queryByRole('list', { name: 'Wishlist' })

    it('says how to add to it while it is empty', () => {
      withWishlist([])
      expect(screen.getByText(/Where do you want to go\? Star a country/)).toBeInTheDocument()
      expect(wishlist()).not.toBeInTheDocument()
    })

    it('lists its places by name, with their continent', () => {
      withWishlist(['Peru', 'Iceland'])
      const rows = within(wishlist()!).getAllByRole('listitem')
      expect(rows.map((row) => row.querySelector('.row-text')!.textContent)).toEqual(['IcelandEurope', 'PeruSouth America'])
    })

    it('stars a search result for the wishlist, or takes it off', async () => {
      const { onWish, onUnwish, onAdd } = withWishlist(['Peru'])
      await userEvent.type(search(), 'pe')
      await userEvent.click(within(results()!).getByRole('button', { name: 'Take Peru off your wishlist' }))
      expect(onUnwish).toHaveBeenCalledWith('Peru')
      await userEvent.clear(search())
      await userEvent.type(search(), 'japan')
      await userEvent.click(within(results()!).getByRole('button', { name: 'Add Japan to your wishlist' }))
      expect(onWish).toHaveBeenCalledWith('Japan')
      expect(onAdd).not.toHaveBeenCalled()
    })

    it('marks a place as visited, takes one off, or shows it', async () => {
      const { onAdd, onUnwish, onShow } = withWishlist(['Peru', 'Iceland'])
      await userEvent.click(screen.getByRole('button', { name: 'Been to Peru: add it to your visited atlas' }))
      expect(onAdd).toHaveBeenCalledWith('Peru')
      await userEvent.click(within(wishlist()!).getByRole('button', { name: 'Take Iceland off your wishlist' }))
      expect(onUnwish).toHaveBeenCalledWith('Iceland')
      await userEvent.click(within(wishlist()!).getByRole('button', { name: /^Iceland/ }))
      expect(onShow).toHaveBeenCalledWith(countries.find((c) => c.properties.name === 'Iceland'))
    })
  })

  it('rounds to whole percents', () => {
    expect(percentLabel(0, 240)).toBe('0%')
    expect(percentLabel(12, 240)).toBe('5%')
    expect(percentLabel(240, 240)).toBe('100%')
  })

  it('shows <1% rather than 0% once something is visited', () => {
    expect(percentLabel(1, 240)).toBe('<1%')
  })
})
