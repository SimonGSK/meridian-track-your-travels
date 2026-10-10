import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Airport } from '../data/airports'
import type { Route } from '../data/flights'
import { looseOf, tripViewsOf, type SavedTrip, type TripItem, type Visit } from '../data/savedTrips'
import type { VisitDate } from '../data/visitDates'
import TripsPanel, { type TripActions } from './TripsPanel'

const airport = (code: string, city: string, country: string, lat: number, lng: number): Airport => ({ code, name: `${city} Airport`, city, country, lat, lng })
const CPH = airport('CPH', 'Copenhagen', 'DK', 55.6, 12.6)
const NRT = airport('NRT', 'Tokyo', 'JP', 35.8, 140.4)
const ICN = airport('ICN', 'Seoul', 'KR', 37.5, 126.4)
const LIM = airport('LIM', 'Lima', 'PE', -12, -77.1)
const AIRPORTS = [CPH, NRT, ICN, LIM]
const route = (id: string, from: Airport, to: Airport, date?: VisitDate, km = 1000): Route => ({
  flight: { id, from: from.code, to: to.code, ...(date ? { date } : {}) },
  from,
  to,
  km,
})
const ROUTES = [route('a', CPH, NRT, '2024-04', 8700), route('b', NRT, ICN, '2024-04', 1200), route('l', CPH, LIM, '2019-11', 10_000)]
const DATES: Record<string, VisitDate[]> = { Japan: ['2024-04'], 'South Korea': ['2024-04'], Peru: ['2019-11'] }
const VISITS: Visit[] = [
  { place: 'Japan', date: '2024-04' },
  { place: 'South Korea', date: '2024-04' },
  { place: 'Peru', date: '2019-11' },
  { place: 'Denmark', date: null },
]
const TRIPS: SavedTrip[] = [
  {
    id: 'asia',
    name: 'Spring in Asia',
    note: 'Cherry blossoms',
    items: [
      { kind: 'flight', flight: 'a' },
      { kind: 'visit', place: 'Japan', date: '2024-04' },
      { kind: 'flight', flight: 'b' },
      { kind: 'visit', place: 'South Korea', date: '2024-04' },
    ],
  },
  { id: 'empty', name: '', items: [] },
]

function setup() {
  const actions: { [K in keyof TripActions]: ReturnType<typeof vi.fn> } = {
    create: vi.fn(() => 'new'),
    rename: vi.fn(),
    remove: vi.fn(),
    add: vi.fn(),
    takeOut: vi.fn(),
    move: vi.fn(),
    addPlace: vi.fn(),
    addFlight: vi.fn(),
    redateVisit: vi.fn(),
    redateFlight: vi.fn(),
    removeFlight: vi.fn(),
  }
  const views = tripViewsOf(TRIPS, VISITS, ROUTES)
  const props = {
    trips: views,
    loose: looseOf(views, VISITS, ROUTES),
    routes: ROUTES,
    flown: ROUTES,
    airports: AIRPORTS,
    datesOf: (place: string) => DATES[place] ?? [],
    actions: actions as unknown as TripActions,
    onShowTrip: vi.fn(),
    onShowRoute: vi.fn(),
    onShowPlace: vi.fn(),
    onFollowTrip: vi.fn(),
  }
  render(<TripsPanel {...props} />)
  return { ...props, actions }
}

/** The trips' headers, which open them */
const headers = () => [...document.querySelectorAll<HTMLElement>('.trip-header')]
/** A trip's header, by what's read out for it: when, its name, and where it went */
const header = (name: RegExp) => screen.getAllByRole('button', { name }).find((b) => b.classList.contains('trip-header'))!
const open = (name: RegExp) => userEvent.click(header(name))
const items = () => within(screen.getByRole('list', { name: /^What the trip/ })).getAllByRole('listitem')

describe('TripsPanel', () => {
  it('adds up the trips, the flights and how far', () => {
    setup()
    expect(screen.getByLabelText('Your trips')).toHaveTextContent(/Trips\s*2\s*Flights\s*3\s*Distance\s*19.9K km/)
  })

  it('lists the trips newest first, with when, their name if they have one, and the flags of where they went', () => {
    setup()
    expect(headers().map((h) => h.textContent)).toEqual(['Apr 2024Spring in Asia Cherry blossoms', 'Nothing in it yet'])
    expect(within(headers()[0]).getAllByRole('img').map((flag) => flag.getAttribute('alt'))).toEqual(['Japan', 'South Korea'])
    expect(headers()[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows just the flags and when for a trip without a name', () => {
    const views = tripViewsOf([{ id: 'x', name: '', items: [{ kind: 'flight', flight: 'l' }, { kind: 'visit', place: 'Peru', date: '2019-11' }] }], VISITS, ROUTES)
    render(
      <TripsPanel
        trips={views}
        loose={{ visits: [], flights: [] }}
        routes={ROUTES}
        flown={ROUTES}
        airports={AIRPORTS}
        datesOf={() => []}
        actions={{} as TripActions}
        onShowTrip={vi.fn()}
        onShowRoute={vi.fn()}
        onShowPlace={vi.fn()}
      />,
    )
    expect(header(/Peru/)).toHaveTextContent(/^Nov 2019$/)
    expect(within(header(/Peru/)).getByRole('img', { name: 'Peru' })).toBeInTheDocument()
  })

  it('opens a trip to its places and flights, in order', async () => {
    setup()
    await open(/Spring in Asia/)
    expect(items().map((li) => li.querySelector('.row-name')!.textContent)).toEqual([
      'Copenhagen → Tokyo',
      'Japan',
      'Tokyo → Seoul',
      'South Korea',
    ])
  })

  it('moves a place or flight with the arrow keys on its grip', async () => {
    const { actions, trips: views } = setup()
    await open(/Spring in Asia/)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move South Korea, now 4 of 4' }), { key: 'ArrowUp' })
    expect(actions.move).toHaveBeenCalledWith('asia', views[0].items, 3, 2)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move South Korea, now 4 of 4' }), { key: 'ArrowDown' })
    expect(actions.move).toHaveBeenCalledTimes(1) // already last
  })

  it('takes a place out of a trip, which keeps it visited', async () => {
    const { actions } = setup()
    await open(/Spring in Asia/)
    await userEvent.click(screen.getByRole('button', { name: 'Take Japan out of the trip' }))
    expect(actions.takeOut).toHaveBeenCalledWith('visit:Japan|2024-04')
  })

  it('changes when a place was visited, once done', async () => {
    const { actions } = setup()
    await open(/Spring in Asia/)
    await userEvent.click(screen.getByRole('button', { name: 'Change when you went to Japan, Apr 2024' }))
    await userEvent.selectOptions(within(screen.getByRole('group', { name: 'When you went to Japan' })).getByRole('combobox', { name: 'Month' }), 'May')
    expect(actions.redateVisit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(actions.redateVisit).toHaveBeenCalledWith('Japan', '2024-04', '2024-05')
  })

  it('names a trip and notes it', async () => {
    const { actions } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Name the trip Unnamed trip' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name of the trip Unnamed trip' }), 'X')
    expect(actions.rename).toHaveBeenLastCalledWith('empty', { name: 'X', note: undefined })
  })

  it('makes a new trip, opened to put things in', async () => {
    const { actions } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'New trip' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Name of the new trip' }), 'Peru{Enter}')
    expect(actions.create).toHaveBeenCalledWith('Peru', [])
  })

  it('adds a place to a trip, with when, after the flight that landed there', async () => {
    const { actions } = setup()
    await open(/Nothing in it yet/)
    await userEvent.click(screen.getByRole('button', { name: 'Place' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Place to add' }), 'per')
    await userEvent.click(within(screen.getByRole('list', { name: 'Places found' })).getByRole('button', { name: /^Peru/ }))
    // Peru has a visit already, so it needs a date
    expect(screen.getByRole('button', { name: 'Add place' })).toBeDisabled()
    await userEvent.selectOptions(within(screen.getByRole('group', { name: 'When you went to Peru' })).getByRole('combobox', { name: 'Year' }), '2019')
    await userEvent.click(screen.getByRole('button', { name: 'Add place' }))
    expect(actions.addPlace).toHaveBeenCalledWith('empty', 'Peru', '2019', 0)
  })

  it('adds a flight to a trip, from where its last one landed', async () => {
    const { actions, trips: views } = setup()
    await open(/Spring in Asia/)
    await userEvent.click(screen.getByRole('button', { name: 'Flight' }))
    expect(screen.getByText('ICN')).toBeInTheDocument() // From Seoul
    await userEvent.type(screen.getByRole('searchbox', { name: 'To' }), 'cph')
    await userEvent.click(within(screen.getByRole('list', { name: 'To airports' })).getByRole('button', { name: /CPH/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Add flight' }))
    expect(actions.addFlight).toHaveBeenCalledWith('asia', ICN, CPH, '2024-04', views[0].items)
  })

  it('lists what is in no trip yet, newest first, and puts it in a trip, or a new one', async () => {
    const { actions } = setup()
    const loose = within(screen.getByRole('list', { name: 'Not in a trip yet' }))
    expect(loose.getAllByRole('listitem').map((li) => li.querySelector('.row-name')!.textContent)).toEqual([
      'Peru',
      'Denmark',
      'Copenhagen → Lima',
    ])
    await userEvent.selectOptions(loose.getByRole('combobox', { name: 'Put Peru in a trip' }), 'asia')
    expect(actions.add).toHaveBeenCalledWith('asia', { kind: 'visit', place: 'Peru', date: '2019-11' }, 4)
    await userEvent.selectOptions(loose.getByRole('combobox', { name: 'Put the flight to Lima in a trip' }), 'new')
    expect(actions.create).toHaveBeenCalledWith('', [{ kind: 'flight', flight: 'l' } satisfies TripItem])
  })

  it('removes a trip, and follows or shows one on the globe', async () => {
    const { actions, onFollowTrip, onShowTrip, trips: views } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Follow the trip Spring in Asia' }))
    expect(onFollowTrip).toHaveBeenCalledWith(views[0].routes)
    await open(/Spring in Asia/)
    await userEvent.click(screen.getByRole('button', { name: 'Show on globe' }))
    expect(onShowTrip).toHaveBeenCalledWith(views[0])
    await userEvent.click(screen.getByRole('button', { name: 'Remove trip' }))
    expect(actions.remove).toHaveBeenCalledWith('asia')
  })
})
