import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Airport } from '../data/airports'
import type { Route } from '../data/flights'
import type { VisitDate } from '../data/visitDates'
import YearsPanel from './YearsPanel'
import { reviewOf, yearsOf, type Travels } from './yearInReview'

const airport = (code: string, city: string): Airport => ({ code, name: city, city, country: 'DK', lat: 0, lng: 0 })
const CPH = airport('CPH', 'Copenhagen')
const route = (to: Airport, km: number, date: VisitDate): Route => ({
  flight: { id: to.code, from: 'CPH', to: to.code, date },
  from: CPH,
  to,
  km,
})

function travels(dates: Record<string, VisitDate[]>, routes: Route[] = []): Travels {
  return { visited: new Set(Object.keys(dates)), datesOf: (name) => dates[name] ?? [], routes }
}

const TRAVELS = travels(
  { Japan: ['2024-04'], 'South Korea': ['2024-04'], France: ['2024-07', '2019'], Kenya: ['2024'], Peru: ['2019-11'] },
  [route(airport('NRT', 'Tokyo'), 8700, '2024-04'), route(airport('CDG', 'Paris'), 1030, '2024-07')],
)

function show(year: number, t = TRAVELS) {
  const props = { onYearChange: vi.fn(), onShow: vi.fn(), onShowRoute: vi.fn() }
  render(<YearsPanel years={yearsOf(t)} review={reviewOf(year, t)} {...props} />)
  return props
}

describe('YearsPanel', () => {
  it('sums up the year', () => {
    show(2024)
    expect(screen.getByRole('heading', { name: '2024' })).toBeInTheDocument()
    expect(screen.getByText('Your most travelled year')).toBeInTheDocument()
    expect(screen.getByText('4 countries on 3 continents, 3 new places.')).toBeInTheDocument()
    expect(screen.getByText('2 flights, 9,730 km.')).toBeInTheDocument()
    expect(screen.getByLabelText('Places in 2024')).toHaveTextContent(/Countries\s*4\s*First visits\s*3\s*Continents\s*3/)
    expect(screen.getByLabelText('Flights in 2024')).toHaveTextContent(/Flights\s*2\s*Distance\s*9,730 km\s*Longest\s*8,700 km/)
  })

  it('goes month by month, marking first visits', () => {
    show(2024)
    const months = screen.getByRole('list', { name: 'Month by month' })
    expect(within(months).getAllByRole('heading').map((h) => h.textContent)).toEqual(['April', 'July', 'Sometime in 2024'])
    const april = within(months).getByRole('list', { name: 'April' })
    expect(within(april).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'JapanFirst visit',
      'South KoreaFirst visit',
    ])
    // France was visited before
    expect(within(months).getByRole('list', { name: 'July' })).toHaveTextContent(/^France$/)
  })

  it("adds each visit's note, after a first visit", () => {
    const notes: Record<string, string> = { 'Japan 2024-04': 'Cherry blossom', 'Kenya 2024': 'Safari' }
    const props = { onYearChange: vi.fn(), onShow: vi.fn(), onShowRoute: vi.fn() }
    render(
      <YearsPanel
        years={yearsOf(TRAVELS)}
        review={reviewOf(2024, TRAVELS)}
        noteOf={(name, date) => notes[`${name} ${date}`]}
        {...props}
      />,
    )
    expect(screen.getByRole('button', { name: /^Japan/ })).toHaveTextContent('JapanFirst visit · Cherry blossom')
    expect(screen.getByRole('button', { name: /^Kenya/ })).toHaveTextContent('KenyaFirst visit · Safari')
  })

  it('shows a country, or the longest flight, on the globe', async () => {
    const { onShow, onShowRoute } = show(2024)
    await userEvent.click(screen.getByRole('button', { name: /^Kenya/ }))
    expect(onShow).toHaveBeenCalledWith(expect.objectContaining({ properties: expect.objectContaining({ name: 'Kenya' }) }))
    await userEvent.click(screen.getByRole('button', { name: /^Copenhagen → Tokyo/ }))
    expect(onShowRoute).toHaveBeenCalledWith(TRAVELS.routes[0])
  })

  it('steps between the years with dates', async () => {
    const { onYearChange } = show(2024)
    expect(screen.getByRole('button', { name: 'Later year' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Earlier year' }))
    expect(onYearChange).toHaveBeenCalledWith(2019)
  })

  it('has nothing earlier than the first year', () => {
    show(2019)
    expect(screen.getByRole('button', { name: 'Earlier year' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Later year' })).toBeEnabled()
    expect(screen.getByText('2 countries on 2 continents, 2 new places.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Flights in 2019')).not.toBeInTheDocument()
    expect(screen.queryByText('Your most travelled year')).not.toBeInTheDocument()
  })

  it('says when a year has only flights', () => {
    show(2023, travels({}, [route(airport('LHR', 'London'), 950, '2023-02')]))
    expect(screen.getByText('1 flight, 950 km.')).toBeInTheDocument()
    expect(screen.getByText(/No visits dated 2023, only flights/)).toBeInTheDocument()
  })

  it('counts a territory as the country it belongs to', () => {
    show(2022, travels({ Greenland: ['2022-08'] }))
    expect(screen.getByText('1 country on 1 continent, 1 new place.')).toBeInTheDocument() // Denmark, in Greenland
  })

  it("counts a territory's country once, and the territory as a new place the first time there", () => {
    // Iceland, and Denmark in Greenland and the Faroe Islands, though Denmark had been visited before
    show(2026, travels({ Iceland: ['2026-06'], Greenland: ['2026-06'], 'Faroe Islands': ['2026-06'], Denmark: ['2019'] }))
    expect(screen.getByText('2 countries on 2 continents, 3 new places.')).toBeInTheDocument()
  })

  it('counts places that are no country\'s apart, as territories', () => {
    show(2026, travels({ Iceland: ['2026-06'], Antarctica: ['2026-01'], Norway: ['2026-07', '2019'] }))
    expect(screen.getByText('2 countries and 1 territory on 2 continents, 2 new places.')).toBeInTheDocument()
  })

  it('says how to get a review when nothing has a date', () => {
    render(<YearsPanel years={[]} review={null} onYearChange={vi.fn()} onShow={vi.fn()} onShowRoute={vi.fn()} />)
    expect(screen.getByText(/No dates yet\. Open a country you've been to and add when you went/)).toBeInTheDocument()
  })

  it('wraps the year shown, as a card to keep or share', async () => {
    const onWrap = vi.fn()
    render(
      <YearsPanel years={yearsOf(TRAVELS)} review={reviewOf(2024, TRAVELS)} onYearChange={vi.fn()} onShow={vi.fn()} onShowRoute={vi.fn()} onWrap={onWrap} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '✨ Your 2024, wrapped' }))
    expect(onWrap).toHaveBeenCalledOnce()
  })

  it("offers to replay the year's trips, when there's any to", async () => {
    const onReplay = vi.fn()
    render(
      <YearsPanel years={yearsOf(TRAVELS)} review={reviewOf(2024, TRAVELS)} onYearChange={vi.fn()} onShow={vi.fn()} onShowRoute={vi.fn()} onReplay={onReplay} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '▶ Replay 2024' }))
    expect(onReplay).toHaveBeenCalledOnce()
    cleanup()
    render(<YearsPanel years={yearsOf(TRAVELS)} review={reviewOf(2024, TRAVELS)} onYearChange={vi.fn()} onShow={vi.fn()} onShowRoute={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /^▶ Replay/ })).not.toBeInTheDocument()
  })
})
