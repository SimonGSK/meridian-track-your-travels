import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CountryPanel from './CountryPanel'
import { countries } from './countries'

const byName = (name: string) => countries.find((c) => c.properties.name === name)!

describe('CountryPanel', () => {
  const show = (name: string) =>
    render(<CountryPanel country={byName(name)} visited={false} onToggleVisited={() => {}} onClose={() => {}} />)
  const fact = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling

  it('shows the name, its ISO code, whether it is a country or a territory, and where', () => {
    show('Denmark')
    expect(screen.getByRole('heading', { name: 'Denmark' })).toBeInTheDocument()
    expect(screen.getByText('Selected country')).toBeInTheDocument()
    expect(screen.getByText('ISO 208')).toBeInTheDocument()
    expect(screen.getByText('Europe')).toBeInTheDocument()
  })

  it('counts the states of countries that have them', () => {
    render(
      <CountryPanel
        country={byName('United States')}
        visited={false}
        onToggleVisited={() => {}}
        onClose={() => {}}
        regions={{ regions: [], label: 'States', visited: new Set(), onToggle: () => {} }}
      />,
    )
    expect(screen.getByText('North America · 0 states')).toBeInTheDocument()
  })

  it('shows the capital, inhabitants and area, with the source', () => {
    show('Denmark')
    expect(fact('Capital')).toHaveTextContent('Copenhagen')
    expect(fact('Inhabitants')).toHaveTextContent(/^\d\.\d+M$/)
    expect(fact('Inhabitants')).toHaveAttribute('title', expect.stringMatching(/^\d\.\d+ million$/))
    expect(fact('Area')).toHaveTextContent('42,920 km²')
    expect(screen.getByText(/^Source: World Bank \(CC BY 4\.0\) · 20\d\d$/)).toBeInTheDocument()
  })

  describe('local time and currency', () => {
    const RATES = { date: '2026-10-13', rates: { EUR: 1, DKK: 7.5, JPY: 175, USD: 1.1, PAB: 1.1 } }
    const showWith = (name: string, currency = 'DKK') =>
      render(
        <CountryPanel
          country={byName(name)}
          visited={false}
          onToggleVisited={() => {}}
          onClose={() => {}}
          money={{ currency, rates: RATES }}
        />,
      )
    const notes = (term: string) =>
      [...screen.getByText(term, { selector: 'dt' }).parentElement!.querySelectorAll('.fact-note')].map((dd) => dd.textContent)
    afterEach(() => vi.useRealTimers())

    it('shows the time at the capital under the figures, and how far ahead of yours it is', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-07-01T12:00:00Z') })
      const yours = -new Date().getTimezoneOffset()
      showWith('Japan')
      expect(fact('Local time')).toHaveTextContent('21:00')
      const ahead = 540 - yours
      expect(notes('Local time')[0]).toMatch(ahead === 0 ? /^Same time as you$/ : ahead > 0 ? /ahead of you$/ : /behind you$/)
      expect(notes('Local time')).toHaveLength(1)
    })

    it('says a place has several times, and that the one shown is the capital', () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-01-15T12:00:00Z') })
      showWith('United States')
      expect(fact('Local time')).toHaveTextContent('07:00')
      expect(notes('Local time')[1]).toBe('In the capital, of 6 time zones')
    })

    it("says what a round sum of the place's money is worth in yours", () => {
      showWith('Japan')
      expect(fact('Currency')).toHaveTextContent('100 JPY = 4.29 DKK')
      expect(notes('Currency')).toEqual(['Japanese Yen'])
      expect(screen.getByText(/rates of 13 Oct$/)).toBeInTheDocument()
    })

    it('says when the money is yours, and names every currency a place uses', () => {
      showWith('Denmark')
      expect(fact('Currency')).toHaveTextContent(/^DKK$/)
      expect(notes('Currency')).toEqual(['Danish Krone, as yours'])
      showWith('Panama', 'EUR')
      expect(screen.getAllByText('Panamanian Balboa, and US Dollar')).toHaveLength(1)
    })

    it('shows no currency without yours, the time all the same', () => {
      show('Japan')
      expect(screen.queryByText('Currency', { selector: 'dt' })).not.toBeInTheDocument()
      expect(screen.getByText('Local time', { selector: 'dt' })).toBeInTheDocument()
    })
  })

  it('shortens the biggest areas', () => {
    show('Argentina')
    expect(fact('Area')).toHaveTextContent('2.78M km²')
  })

  it('marks estimates and territories, and notes places without people', () => {
    show('Antarctica')
    expect(screen.getByText('Selected territory')).toBeInTheDocument()
    expect(fact('Capital')).toHaveTextContent('None')
    expect(fact('Inhabitants')).toHaveTextContent('None')
    expect(screen.getByText(/No permanent population/)).toBeInTheDocument()
    expect(screen.getByText('Estimate')).toBeInTheDocument()
  })

  it('falls back to the size on the map when no area is known', () => {
    show('Siachen Glacier')
    expect(fact('Area')).toHaveTextContent(/^≈ [\d,]+ km²$/)
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(<CountryPanel country={byName('Denmark')} visited={false} onToggleVisited={() => {}} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('adds a country to the visited atlas', async () => {
    const onToggleVisited = vi.fn()
    render(<CountryPanel country={byName('Denmark')} visited={false} onToggleVisited={onToggleVisited} onClose={() => {}} />)
    const button = screen.getByRole('button', { name: 'Add to visited atlas' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(onToggleVisited).toHaveBeenCalledOnce()
  })

  it('shows when a country is in the visited atlas', () => {
    render(<CountryPanel country={byName('Denmark')} visited onToggleVisited={() => {}} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'In visited atlas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('adds a place not visited yet to the wishlist, and shows when it is on it', async () => {
    const onToggleWish = vi.fn()
    const { rerender } = render(
      <CountryPanel country={byName('Peru')} visited={false} onToggleVisited={() => {}} onToggleWish={onToggleWish} onClose={() => {}} />,
    )
    const button = screen.getByRole('button', { name: 'Add to wishlist' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(onToggleWish).toHaveBeenCalledOnce()

    rerender(<CountryPanel country={byName('Peru')} visited={false} wished onToggleVisited={() => {}} onToggleWish={onToggleWish} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'On your wishlist' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no wishlist button once visited', () => {
    render(<CountryPanel country={byName('Peru')} visited onToggleVisited={() => {}} onToggleWish={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: /wishlist/ })).not.toBeInTheDocument()
  })

  it('lists the visited cities, when given cities', () => {
    const cities = [{ id: 1, name: 'Copenhagen', place: 'DK', lat: 55.68, lng: 12.57, population: 1153615, capital: true as const }]
    const { rerender } = render(
      <CountryPanel country={byName('Denmark')} visited onToggleVisited={() => {}} onClose={() => {}} />,
    )
    expect(screen.queryByRole('region', { name: 'Visited cities' })).not.toBeInTheDocument()
    rerender(
      <CountryPanel
        country={byName('Denmark')}
        visited
        onToggleVisited={() => {}}
        onClose={() => {}}
        cities={{ cities, visited: new Set([1]), onToggle: () => {} }}
      />,
    )
    expect(screen.getByRole('region', { name: 'Visited cities' })).toHaveTextContent('Copenhagen')
  })
})
