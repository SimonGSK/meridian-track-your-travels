import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { countries, searchCountries, type CountryFeature } from '../countries'
import { cityOf, type Airport } from '../data/airports'
import { flightStats, formatDistance, type Route } from '../data/flights'
import { countdown, isToCome } from '../data/plans'
import { countriesOfTrip, itemKey, placeFor, titleOf, visitItem, type TripItem, type TripView, type Visit } from '../data/savedTrips'
import { formatVisitDate, partsOf, type VisitDate } from '../data/visitDates'
import { CloseIcon, GripIcon, PencilIcon, PlaneIcon, PlayIcon, PlusIcon } from '../icons'
import StatsBox from '../ui/StatsBox'
import { noAutofill } from '../ui/noAutofill'
import { useReorder } from '../ui/useReorder'
import AirportSearch from './AirportSearch'
import MonthYearSelect from './MonthYearSelect'
import { TRIP_NAME_MAX, TRIP_NOTE_MAX, type TripName } from './useTripNames'
import { Flag } from './VisitedPanel'

/** What can be done to trips, and to the visits and flights in them */
export type TripActions = {
  /** A new trip, with what's to go in it; gives its id */
  create: (name: string, items?: TripItem[]) => string
  rename: (id: string, name: TripName) => void
  /** Removes a trip; what was in it stays, in no trip */
  remove: (id: string) => void
  /** Puts a visit or flight there is in a trip, at `index`, taking it out of any other */
  add: (id: string, item: TripItem, index?: number) => void
  /** Takes a visit or flight out of its trip, by its key */
  takeOut: (key: string) => void
  /** Moves a trip's item from one place to another, of those shown */
  move: (id: string, shown: TripItem[], from: number, to: number) => void
  /** A place, and when you went, into a trip: in your atlas if it wasn't, with the visit */
  addPlace: (id: string, place: string, date: VisitDate | null, index: number) => void
  /** A new flight into a trip */
  addFlight: (id: string, from: Airport, to: Airport, date: VisitDate | null, items: TripItem[]) => void
  /** When a visit was, changed; null for none, for a place's only visit */
  redateVisit: (place: string, from: VisitDate | null, to: VisitDate | null) => void
  redateFlight: (id: string, date: VisitDate | null) => void
  removeFlight: (id: string) => void
}

type Props = {
  /** The trips, newest first */
  trips: TripView[]
  /** Visits and flights in no trip */
  loose: { visits: Visit[]; flights: Route[] }
  /** Every flight, those to come too */
  routes: Route[]
  /** The flights flown, which count */
  flown: Route[]
  airports: Airport[] | null
  /** When each place was visited, newest first */
  datesOf: (place: string) => readonly VisitDate[]
  actions: TripActions
  onShowTrip: (trip: TripView) => void
  onShowRoute: (route: Route) => void
  onShowPlace: (country: CountryFeature) => void
  /** Follows a trip on the globe, flight by flight */
  onFollowTrip?: (routes: Route[]) => void
}

const placeNamed = new Map(countries.map((c) => [c.properties.name, c]))
const oneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

/** "Apr 2024", "Apr – May 2024", or "Dec 2024 – Jan 2025" */
function whenOf(date: VisitDate | null, end: VisitDate | null) {
  if (!date) return null
  if (!end || end === date) return formatVisitDate(date)
  const [from, to] = [partsOf(date), partsOf(end)]
  const start = from.year === to.year && from.month && to.month ? formatVisitDate(date).split(' ')[0] : formatVisitDate(date)
  return `${start} – ${formatVisitDate(end)}`
}

/**
 * The Visited tab's trips: what you've been to and flown, put together as you
 * went. Each trip is your visits and the flights between them, in order, and
 * a name; below them, what's in no trip yet, ready to date or put in one.
 */
export default function TripsPanel(props: Props) {
  const { trips, loose, routes, flown, airports, datesOf, actions, onShowTrip, onShowRoute, onShowPlace, onFollowTrip } = props
  /** The trip opened, to see and change what's in it */
  const [open, setOpen] = useState<string | null>(null)
  const [naming, setNaming] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const { flights, km, aroundEarth } = flightStats(flown)
  const looseCount = loose.visits.length + loose.flights.length

  /** A new trip, opened, with what's to go in it; named straight away */
  const make = (name: string, items: TripItem[] = []) => {
    const id = actions.create(name, items)
    setOpen(id)
    if (!name) setNaming(id)
  }
  /** Puts something in no trip into one, where it fits there */
  const putIn = (id: string, item: TripItem) => {
    if (id === 'new') return make('', [item])
    const view = trips.find((t) => t.trip.id === id)
    if (view) actions.add(id, item, placeFor(item, view.items, routes))
  }

  return (
    <div className="trips">
      <StatsBox
        label="Your trips"
        stats={[
          { label: 'Trips', value: trips.length },
          { label: 'Flights', value: flights },
          { label: 'Distance', value: formatDistance(km), title: `${oneDecimal.format(aroundEarth)}× around the Earth, at 40,075 km` },
        ]}
      />
      {making ? (
        <NewTrip
          onMake={(name) => {
            setMaking(false)
            make(name)
          }}
          onCancel={() => setMaking(false)}
        />
      ) : (
        <div className="card-actions">
          <button type="button" className="primary-button" onClick={() => setMaking(true)}>
            <PlusIcon size={14} /> New trip
          </button>
        </div>
      )}

      {trips.length === 0 ? (
        <p className="muted">
          No trips yet. Make one, then add the places you went and the flights between them, in the order you went.
        </p>
      ) : (
        <ul className="trip-list" aria-label="Trips">
          {trips.map((view) => (
            <TripCard
              key={view.trip.id}
              view={view}
              routes={routes}
              airports={airports}
              datesOf={datesOf}
              actions={actions}
              isOpen={open === view.trip.id}
              onToggle={() => setOpen(open === view.trip.id ? null : view.trip.id)}
              naming={naming === view.trip.id}
              onNaming={(on) => setNaming(on ? view.trip.id : null)}
              onShow={() => onShowTrip(view)}
              onShowRoute={onShowRoute}
              onShowPlace={onShowPlace}
              onFollow={onFollowTrip && view.routes.length > 0 ? () => onFollowTrip(view.routes) : undefined}
            />
          ))}
        </ul>
      )}

      <h3>
        Not in a trip yet <span className="row-meta">{looseCount}</span>
      </h3>
      {looseCount === 0 ? (
        <p className="muted">Everything you've been to is in a trip.</p>
      ) : (
        <ul className="country-list loose-list" aria-label="Not in a trip yet">
          {loose.visits.map((visit) => (
            <VisitRow
              key={itemKey(visitItem(visit))}
              visit={visit}
              datesOf={datesOf}
              onShow={onShowPlace}
              onDate={(date) => actions.redateVisit(visit.place, visit.date, date)}
            >
              <TripPicker trips={trips} what={visit.place} onPick={(id) => putIn(id, visitItem(visit))} />
            </VisitRow>
          ))}
          {loose.flights.map((route) => (
            <FlightRow
              key={route.flight.id}
              route={route}
              onShow={() => onShowRoute(route)}
              onDate={(date) => actions.redateFlight(route.flight.id, date)}
              onRemove={() => actions.removeFlight(route.flight.id)}
            >
              <TripPicker
                trips={trips}
                what={`the flight to ${cityOf(route.to)}`}
                onPick={(id) => putIn(id, { kind: 'flight', flight: route.flight.id })}
              />
            </FlightRow>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Naming a new trip */
function NewTrip({ onMake, onCancel }: { onMake: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  return (
    <form
      className="trip-new"
      onSubmit={(e) => {
        e.preventDefault()
        onMake(name.trim())
      }}
    >
      <input
        {...noAutofill('trip-name')}
        type="text"
        aria-label="Name of the new trip"
        placeholder="Name it, like Summer in Japan"
        maxLength={TRIP_NAME_MAX}
        value={name}
        onChange={(e) => setName(e.target.value)}
        // Opened by pressing New trip, to write in straight away
        autoFocus
      />
      <div className="card-actions">
        <button type="submit" className="primary-button">
          Make the trip
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** Puts something in a trip, picked from a list of them, or a new one */
function TripPicker({ trips, what, onPick }: { trips: TripView[]; what: string; onPick: (id: string) => void }) {
  return (
    <select
      className="trip-picker"
      aria-label={`Put ${what} in a trip`}
      value=""
      onChange={(e) => e.target.value && onPick(e.target.value)}
    >
      <option value="" disabled>
        + Trip
      </option>
      {trips.map((view) => (
        <option key={view.trip.id} value={view.trip.id}>
          {[titleOf(view), whenOf(view.date, view.endDate)].filter(Boolean).join(' · ')}
        </option>
      ))}
      <option value="new">New trip</option>
    </select>
  )
}

type CardProps = {
  view: TripView
  routes: Route[]
  airports: Airport[] | null
  datesOf: (place: string) => readonly VisitDate[]
  actions: TripActions
  isOpen: boolean
  onToggle: () => void
  naming: boolean
  onNaming: (on: boolean) => void
  onShow: () => void
  onShowRoute: (route: Route) => void
  onShowPlace: (country: CountryFeature) => void
  onFollow?: () => void
}

/** A trip: its name and when, and opened, its places and flights in order, to rearrange, date and add to */
function TripCard({ view, routes, airports, datesOf, actions, isOpen, onToggle, naming, onNaming, onShow, onShowRoute, onShowPlace, onFollow }: CardProps) {
  const { trip, items, date, endDate } = view
  const [adding, setAdding] = useState<'place' | 'flight' | null>(null)
  const title = titleOf(view)
  const named = trip.name.trim() !== ''
  // The countries it went to, as flags, after its name if it has one
  const flags = countriesOfTrip(view).flatMap((place) => placeNamed.get(place) ?? [])
  const toCome = date && isToCome(date) ? countdown(date) : null
  const meta = [whenOf(date, endDate), toCome].filter(Boolean).join(' · ')
  const routeOfFlight = new Map(view.routes.map((route) => [route.flight.id, route]))

  // The grip of what was just moved keeps the focus, to move it on with the arrow keys
  const moved = useRef<string | null>(null)
  useEffect(() => {
    if (!moved.current) return
    document.querySelector<HTMLElement>(`[data-grip="${CSS.escape(moved.current)}"]`)?.focus()
    moved.current = null
  })
  const { list, grip, styleOf, dragging } = useReorder<HTMLOListElement>((from, to) => {
    moved.current = itemKey(items[from])
    actions.move(trip.id, items, from, to)
  })

  return (
    <li className={`trip${isOpen ? ' open' : ''}`}>
      <div className="trip-top">
        <button type="button" className="trip-header" aria-expanded={isOpen} onClick={onToggle}>
          {meta && <span className="trip-meta">{meta}</span>}
          <span className="trip-title">
            {named && <span className="trip-name">{trip.name}</span>}
            {flags.length > 0 && (
              <span className="trip-flags">
                {/* Apart when read out; the space takes no room between them */}
                {flags.map((country, i) => (
                  <Fragment key={country.properties.name}>
                    {i > 0 && ' '}
                    <Flag country={country} named />
                  </Fragment>
                ))}
              </span>
            )}
            {!named && flags.length === 0 && <span className="trip-name muted">Nothing in it yet</span>}
          </span>
          {trip.note && !naming && <span className="visit-note">{trip.note}</span>}
        </button>
        {onFollow && (
          <button
            type="button"
            className="remove-button note-button"
            onClick={onFollow}
            aria-label={`Follow the trip ${title}`}
            title="Follow it on the globe, flight by flight"
          >
            <PlayIcon size={14} />
          </button>
        )}
        <button
          type="button"
          className="remove-button note-button"
          aria-expanded={naming}
          onClick={() => onNaming(!naming)}
          aria-label={trip.name.trim() ? `Rename the trip ${title}` : `Name the trip ${title}`}
        >
          <PencilIcon size={14} />
        </button>
      </div>
      {naming && (
        <form
          className="note-editor trip-name-editor"
          onSubmit={(e) => {
            e.preventDefault()
            onNaming(false)
          }}
        >
          <input
            {...noAutofill('trip-name')}
            type="text"
            aria-label={`Name of the trip ${title}`}
            placeholder="Interrail 2019"
            maxLength={TRIP_NAME_MAX}
            value={trip.name}
            onChange={(e) => actions.rename(trip.id, { name: e.target.value, note: trip.note })}
            // Opened by pressing the pencil, to write in straight away
            autoFocus
          />
          <input
            {...noAutofill('trip-note')}
            type="text"
            aria-label={`Note on the trip ${title}`}
            placeholder="Who with, what you did…"
            maxLength={TRIP_NOTE_MAX}
            value={trip.note ?? ''}
            onChange={(e) => actions.rename(trip.id, { name: trip.name, note: e.target.value })}
          />
          <button type="submit" className="link-button">
            Done
          </button>
        </form>
      )}
      {isOpen && (
        <div className="trip-body">
          {items.length === 0 ? (
            <p className="muted small">Nothing in it yet: add the places you went, and the flights between them.</p>
          ) : (
            <ol ref={list} className={`trip-items${dragging ? ' dragging' : ''}`} aria-label={`What the trip ${title} was`}>
              {items.map((item, i) => {
                const key = itemKey(item)
                const label = item.kind === 'visit' ? item.place : `the flight to ${cityOf(routeOfFlight.get(item.flight)!.to)}`
                const handle = (
                  <button
                    type="button"
                    className="grip"
                    data-grip={key}
                    data-no-swipe
                    aria-label={`Move ${label}, now ${i + 1} of ${items.length}`}
                    title="Drag to move it, or use the arrow keys"
                    {...grip(i, items.length)}
                  >
                    <GripIcon size={14} />
                  </button>
                )
                return item.kind === 'visit' ? (
                  <VisitRow
                    key={key}
                    visit={item}
                    datesOf={datesOf}
                    style={styleOf(i)}
                    grip={handle}
                    onShow={onShowPlace}
                    onDate={(to) => actions.redateVisit(item.place, item.date, to)}
                  >
                    <button
                      type="button"
                      className="icon-button small"
                      onClick={() => actions.takeOut(key)}
                      aria-label={`Take ${item.place} out of the trip`}
                      title="Out of the trip (it stays visited)"
                    >
                      <CloseIcon size={14} />
                    </button>
                  </VisitRow>
                ) : (
                  <FlightRow
                    key={key}
                    route={routeOfFlight.get(item.flight)!}
                    style={styleOf(i)}
                    grip={handle}
                    onShow={() => onShowRoute(routeOfFlight.get(item.flight)!)}
                    onDate={(to) => actions.redateFlight(item.flight, to)}
                    onRemove={() => actions.removeFlight(item.flight)}
                  />
                )
              })}
            </ol>
          )}
          {adding === 'place' && (
            <AddPlace
              datesOf={datesOf}
              defaultDate={endDate}
              onAdd={(place, when) => {
                actions.addPlace(trip.id, place, when, placeFor({ kind: 'visit', place, date: when }, items, routes))
                setAdding(null)
              }}
              onCancel={() => setAdding(null)}
            />
          )}
          {adding === 'flight' &&
            (airports ? (
              <AddFlight
                airports={airports}
                from={view.routes.at(-1)?.to ?? null}
                defaultDate={endDate}
                onAdd={(from, to, when) => actions.addFlight(trip.id, from, to, when, items)}
                onDone={() => setAdding(null)}
              />
            ) : (
              <p className="muted small">Loading airports…</p>
            ))}
          <div className="card-actions trip-actions">
            {adding === null && (
              <>
                <button type="button" className="link-button" onClick={() => setAdding('place')}>
                  <PlusIcon size={13} /> Place
                </button>
                <button type="button" className="link-button" onClick={() => setAdding('flight')}>
                  <PlaneIcon size={13} /> Flight
                </button>
              </>
            )}
            {items.length > 0 && (
              <button type="button" className="link-button" onClick={onShow}>
                Show on globe
              </button>
            )}
            <button type="button" className="link-button muted-action" onClick={() => actions.remove(trip.id)}>
              Remove trip
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

type VisitRowProps = {
  visit: Visit
  datesOf: (place: string) => readonly VisitDate[]
  style?: CSSProperties
  grip?: ReactNode
  onShow: (country: CountryFeature) => void
  onDate: (date: VisitDate | null) => void
  children?: ReactNode
}

/** A visit: the place's flag and name, when, which can be changed, and what's done to it */
function VisitRow({ visit, datesOf, style, grip, onShow, onDate, children }: VisitRowProps) {
  const { place, date } = visit
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState<VisitDate | null>(date)
  const country = placeNamed.get(place)
  // Only a place's one visit can be left without a date: it's been to, when unknown
  const optional = datesOf(place).length <= 1
  return (
    <li className={`country-item trip-item${editing ? ' editing' : ''}`} style={style}>
      {grip}
      <button type="button" className="country-row" onClick={() => country && onShow(country)}>
        {country && <Flag country={country} />}
        <span className="row-text">
          <span className="row-name">{place}</span>
        </span>
      </button>
      <button
        type="button"
        className="link-button flight-date"
        aria-expanded={editing}
        aria-label={date ? `Change when you went to ${place}, ${formatVisitDate(date)}` : `Add when you went to ${place}`}
        onClick={() => {
          setWhen(date)
          setEditing(!editing)
        }}
      >
        {date ? formatVisitDate(date) : 'Add date'}
      </button>
      {children}
      {editing && (
        <div className="flight-date-editor">
          <MonthYearSelect label={`When you went to ${place}`} value={date} onChange={setWhen} optional={optional} />
          <button
            type="button"
            className="link-button"
            disabled={!optional && !when}
            onClick={() => {
              if (when !== date) onDate(when)
              setEditing(false)
            }}
          >
            Done
          </button>
        </div>
      )}
    </li>
  )
}

type FlightRowProps = {
  route: Route
  style?: CSSProperties
  grip?: ReactNode
  onShow: () => void
  onDate: (date: VisitDate | null) => void
  onRemove: () => void
  children?: ReactNode
}

/** A flight: where from and to, when (which can be changed), and a button to remove it */
function FlightRow({ route, style, grip, onShow, onDate, onRemove, children }: FlightRowProps) {
  const [editing, setEditing] = useState(false)
  const when = route.flight.date
  const name = `flight from ${cityOf(route.from)} to ${cityOf(route.to)}`
  const toCome = when && isToCome(when) ? countdown(when) : null
  return (
    <li className={`country-item trip-item flight-item${editing ? ' editing' : ''}`} style={style}>
      {grip}
      <button type="button" className="country-row" onClick={onShow}>
        <span className="mini-flag flight-mark" aria-hidden="true">
          <PlaneIcon size={14} />
        </span>
        <span className="row-text">
          <span className="row-name">
            {cityOf(route.from)} → {cityOf(route.to)}
          </span>
          <span className="row-note">
            {[`${route.from.code} → ${route.to.code}`, formatDistance(route.km), toCome].filter(Boolean).join(' · ')}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="link-button flight-date"
        aria-expanded={editing}
        aria-label={`${when ? `Change the date, ${formatVisitDate(when)},` : 'Add a date to the'} ${name}`}
        onClick={() => setEditing(!editing)}
      >
        {when ? formatVisitDate(when) : 'Add date'}
      </button>
      {children}
      <button type="button" className="icon-button small" onClick={onRemove} aria-label={`Remove the ${name}`}>
        <CloseIcon size={14} />
      </button>
      {editing && (
        <div className="flight-date-editor">
          <MonthYearSelect label={`When you took the ${name}`} value={when ?? null} onChange={onDate} optional future />
          <button type="button" className="link-button" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
      )}
    </li>
  )
}

/** A place to add to a trip, found by name, and when you went */
function AddPlace({ datesOf, defaultDate, onAdd, onCancel }: {
  datesOf: (place: string) => readonly VisitDate[]
  defaultDate: VisitDate | null
  onAdd: (place: string, date: VisitDate | null) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [place, setPlace] = useState<CountryFeature | null>(null)
  const [when, setWhen] = useState<VisitDate | null>(defaultDate)
  const matches = query && !place ? searchCountries(query, undefined, 5) : []
  // A place with dates already needs one: without, it'd be the visit when no one knows, which it hasn't
  const needsDate = !!place && datesOf(place.properties.name).length > 0
  return (
    <form
      className="trip-add"
      onSubmit={(e) => {
        e.preventDefault()
        if (place && (when || !needsDate)) onAdd(place.properties.name, when)
      }}
    >
      {place ? (
        <span className="city-chip">
          <span>
            <Flag country={place} /> {place.properties.name}
          </span>
          <button type="button" className="remove-button" onClick={() => setPlace(null)} aria-label="Change the place">
            <CloseIcon size={14} />
          </button>
        </span>
      ) : (
        <>
          <input
            {...noAutofill('trip-place')}
            type="search"
            aria-label="Place to add"
            placeholder="Where you went…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {matches.length > 0 && (
            <ul className="suggestions" aria-label="Places found">
              {matches.map(({ country }) => (
                <li key={country.properties.name}>
                  <button type="button" onClick={() => setPlace(country)}>
                    <span>{country.properties.name}</span>
                    <span className="row-meta">{country.properties.continent}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {place && (
        <div className="city-choice">
          <span className="city-choice-label">When{needsDate ? '' : ' (optional)'}</span>
          <MonthYearSelect label={`When you went to ${place.properties.name}`} value={when} onChange={setWhen} optional />
        </div>
      )}
      <div className="card-actions">
        <button type="submit" className="primary-button" disabled={!place || (needsDate && !when)}>
          Add place
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

/** A flight to add to a trip; the next one starts where it landed */
function AddFlight({ airports, from: start, defaultDate, onAdd, onDone }: {
  airports: Airport[]
  from: Airport | null
  defaultDate: VisitDate | null
  onAdd: (from: Airport, to: Airport, date: VisitDate | null) => void
  onDone: () => void
}) {
  const [from, setFrom] = useState<Airport | null>(start)
  const [to, setTo] = useState<Airport | null>(null)
  const [when, setWhen] = useState<VisitDate | null>(defaultDate)
  return (
    <form
      className="flight-form trip-add"
      onSubmit={(e) => {
        e.preventDefault()
        if (!from || !to || from === to) return
        onAdd(from, to, when)
        setFrom(to)
        setTo(null)
      }}
    >
      <AirportSearch label="From" airports={airports} value={from} onChange={setFrom} />
      <button
        type="button"
        className="swap-button"
        onClick={() => {
          setFrom(to)
          setTo(from)
        }}
        disabled={!from && !to}
        aria-label="Swap From and To"
        title="Swap, for the flight back"
      >
        ⇅
      </button>
      <AirportSearch label="To" airports={airports} value={to} onChange={setTo} />
      <div className="city-choice">
        <span className="city-choice-label">When (optional)</span>
        <MonthYearSelect label="When you flew" value={when} onChange={setWhen} optional future />
      </div>
      <div className="card-actions">
        <button type="submit" className="primary-button" disabled={!from || !to || from === to}>
          Add flight
        </button>
        <button type="button" className="link-button" onClick={onDone}>
          Done
        </button>
      </div>
      {from && to && from === to && <p className="input-hint">From and To are the same airport.</p>}
    </form>
  )
}
