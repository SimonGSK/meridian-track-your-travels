import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { countries, searchCountries, type CountryFeature } from '../countries'
import { CONTINENTS, type Continent } from '../data/continents'
import { flagUrl } from '../flags'
import { CloseIcon, StarIcon } from '../icons'
import { countriesOf, countryOfPlace } from '../data/sovereigns'
import { percentLabel } from './percentLabel'
import StatsBox from '../ui/StatsBox'
import { noAutofill } from '../ui/noAutofill'

type Props = {
  visited: ReadonlySet<string>
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  onShow: (country: CountryFeature) => void
  /** States and cities visited, e.g. "3 of 51 states · 4 cities" */
  note?: (country: CountryFeature) => string | null
  /** Cities visited, all over the world */
  cityCount?: number
  /** Places a trip has been to, which stay visited while it has: nothing to remove here */
  inTrips?: ReadonlySet<string>
  /** Places you want to go, not visited yet, by name */
  wishlist?: ReadonlySet<string>
  onWish?: (name: string) => void
  onUnwish?: (name: string) => void
}

const byName = (a: CountryFeature, b: CountryFeature) => a.properties.name.localeCompare(b.properties.name)
const isCountry = (c: CountryFeature) => c.properties.kind === 'country'
const COUNTRY_COUNT = countries.filter(isCountry).length
const TERRITORY_COUNT = countries.length - COUNTRY_COUNT
/** Countries per continent; Antarctica has none, so it gets no row */
const COUNTRIES_IN = new Map(
  CONTINENTS.map((continent) => [continent, countries.filter((c) => isCountry(c) && c.properties.continent === continent).length]),
)
const MAX_RESULTS = 6

/** A small flag in front of a place's name in a list; `named` where it stands for the place, with no name beside it */
export function Flag({ country, named = false }: { country: CountryFeature; named?: boolean }) {
  const url = flagUrl(country)
  const { name } = country.properties
  if (!url) return named ? <span className="mini-flag" role="img" aria-label={name} title={name} /> : <span className="mini-flag" />
  return <img className="mini-flag" src={url} alt={named ? name : ''} title={named ? name : undefined} />
}

/** "Greenland", "Greenland and Faroe Islands", "A, B and C" */
const listOf = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

const NO_WISHES: ReadonlySet<string> = new Set()

export default function VisitedPanel(props: Props) {
  const { visited, onAdd, onRemove, onShow, note, cityCount = 0, inTrips = NO_WISHES, wishlist = NO_WISHES, onWish, onUnwish } = props
  const [query, setQuery] = useState('')
  /** The continent whose places are listed, over the rest */
  const [open, setOpen] = useState<Continent | null>(null)

  const visitedList = countries.filter((c) => visited.has(c.properties.name)).sort(byName)
  const notVisited = countries.filter((c) => !visited.has(c.properties.name))
  const matches = searchCountries(query, notVisited, MAX_RESULTS)
  // The countries been to: those visited, and those a territory visited belongs to, as Greenland is Denmark's
  const been = [...countriesOf(visitedList)]
  const visitedCountries = been.length
  const visitedTerritories = visitedList.filter((c) => !isCountry(c)).length
  const visitedIn = (continent: Continent) => visitedList.filter((c) => c.properties.continent === continent)
  /** Countries been to only in a territory of theirs, like Denmark in Greenland */
  const throughTerritory = (country: CountryFeature) => !visited.has(country.properties.name)
  const territoriesOf = (country: CountryFeature) =>
    visitedList.filter((place) => place !== country && countryOfPlace(place) === country).map((place) => place.properties.name)
  const wishes = countries.filter((c) => wishlist.has(c.properties.name)).sort(byName)
  // A second line under the name: "Territory", and states and cities visited; "In Greenland" for Denmark been to there
  const noteFor = (c: CountryFeature) =>
    throughTerritory(c)
      ? `In ${listOf(territoriesOf(c))}`
      : [isCountry(c) ? null : 'Territory', note?.(c)].filter(Boolean).join(' · ') || null

  const add = (country: CountryFeature) => {
    onAdd(country.properties.name)
    setQuery('')
  }
  // Every continent with countries, and Antarctica too once you've been to one of its territories
  const continents = CONTINENTS.filter((continent) => COUNTRIES_IN.get(continent)! > 0 || visitedIn(continent).length > 0)

  return (
    <div className="visited">
      <StatsBox
        label="Your atlas"
        stats={[
          { label: 'Countries', value: visitedCountries, of: COUNTRY_COUNT },
          { label: 'Territories', value: visitedTerritories, of: TERRITORY_COUNT },
          { label: 'Cities', value: cityCount },
        ]}
      />
      <div
        className="progress"
        role="progressbar"
        aria-label="Share of the world's countries visited"
        aria-valuemin={0}
        aria-valuemax={COUNTRY_COUNT}
        aria-valuenow={visitedCountries}
        aria-valuetext={percentLabel(visitedCountries, COUNTRY_COUNT)}
      >
        <div style={{ width: `${(visitedCountries / COUNTRY_COUNT) * 100}%` }} />
      </div>
      <span className="visited-percent">{percentLabel(visitedCountries, COUNTRY_COUNT)} of the world's countries</span>

      <h3>By continent</h3>
      <ul className="continent-stats" aria-label="Countries visited by continent">
        {continents.map((continent) => {
          const total = COUNTRIES_IN.get(continent)!
          const countriesHere = been.filter((c) => c.properties.continent === continent)
          // The places visited there, and the countries been to only in a territory elsewhere
          const places = [...visitedIn(continent), ...countriesHere.filter(throughTerritory)].sort(byName)
          const count = countriesHere.length
          return (
            <li key={continent}>
              {/* The whole bar opens the continent's places, over the rest; the button, for the keyboard */}
              <div className="continent-row" onClick={() => setOpen(continent)}>
                <button type="button" className="continent-name" aria-haspopup="dialog" aria-expanded={open === continent}>
                  {continent}
                </button>
                {total > 0 ? (
                  <>
                    <span className="continent-count">
                      {count} / {total}
                    </span>
                    <span className="continent-percent">{percentLabel(count, total)}</span>
                    <div
                      className="progress small"
                      role="progressbar"
                      aria-label={`${continent}: ${count} of ${total} countries`}
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={count}
                      aria-valuetext={percentLabel(count, total)}
                    >
                      <div style={{ width: `${(count / total) * 100}%` }} />
                    </div>
                  </>
                ) : (
                  <span className="continent-count">{places.length === 1 ? '1 place' : `${places.length} places`}</span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {open && (
        <ContinentPopup
          continent={open}
          visited={[...visitedIn(open), ...been.filter((c) => c.properties.continent === open).filter(throughTerritory)].sort(byName)}
          notVisited={countries.filter((c) => isCountry(c) && c.properties.continent === open && !been.includes(c)).sort(byName)}
          count={been.filter((c) => c.properties.continent === open).length}
          total={COUNTRIES_IN.get(open)!}
          noteFor={noteFor}
          canRemove={(c) => !throughTerritory(c) && !inTrips.has(c.properties.name)}
          onRemove={onRemove}
          onShow={(c) => {
            setOpen(null)
            onShow(c)
          }}
          onClose={() => setOpen(null)}
        />
      )}
      {visitedList.length === 0 && (
        <p className="muted">None yet. Search below, or click a country on the globe and mark it as visited.</p>
      )}

      <form
        className="search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          if (matches[0]) add(matches[0].country)
        }}
      >
        <label htmlFor="visited-search">Add a country</label>
        <input
          {...noAutofill('country')}
          id="visited-search"
          type="search"
          placeholder="Search countries…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>

      {matches.length > 0 && (
        <ul className="country-list" aria-label="Search results">
          {matches.map(({ country: c, matchedAlias }) => {
            const { name } = c.properties
            const wished = wishlist.has(name)
            return (
              <li key={name} className="country-item">
                <button type="button" className="country-row" onClick={() => add(c)}>
                  <Flag country={c} />
                  <span className="row-name">
                    {name}
                    {matchedAlias && <span className="muted"> ({matchedAlias})</span>}
                  </span>
                  <span className="row-action">Add</span>
                </button>
                {onWish && onUnwish && (
                  <button
                    type="button"
                    className={`icon-button small wish-star${wished ? ' on' : ''}`}
                    aria-label={wished ? `Take ${name} off your wishlist` : `Add ${name} to your wishlist`}
                    onClick={() => (wished ? onUnwish(name) : onWish(name))}
                  >
                    <StarIcon size={15} filled={wished} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {query.trim() && matches.length === 0 && <p className="muted">No matching countries.</p>}

      {onWish && onUnwish && (
        <>
          <h3>Wishlist</h3>
          {wishes.length === 0 ? (
            <p className="muted">
              Where do you want to go? Star a country in the search above, or in its panel, and it's colored on the
              globe.
            </p>
          ) : (
            <ul className="country-list" aria-label="Wishlist">
              {wishes.map((c) => (
                <li key={c.properties.name} className="country-item">
                  <button type="button" className="country-row" onClick={() => onShow(c)}>
                    <Flag country={c} />
                    <span className="row-text">
                      <span className="row-name">{c.properties.name}</span>
                      <span className="row-note">{c.properties.continent}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="link-button been-there"
                    aria-label={`Been to ${c.properties.name}: add it to your visited atlas`}
                    onClick={() => add(c)}
                  >
                    Been there
                  </button>
                  <button
                    type="button"
                    className="icon-button small"
                    onClick={() => onUnwish(c.properties.name)}
                    aria-label={`Take ${c.properties.name} off your wishlist`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

    </div>
  )
}

type PopupProps = {
  continent: Continent
  /** The places visited there, and countries been to only in a territory elsewhere */
  visited: CountryFeature[]
  /** Its countries not been to yet */
  notVisited: CountryFeature[]
  /** Countries been to there, of how many */
  count: number
  total: number
  noteFor: (country: CountryFeature) => string | null
  canRemove: (country: CountryFeature) => boolean
  onRemove: (name: string) => void
  onShow: (country: CountryFeature) => void
  onClose: () => void
}

/**
 * A continent's places, over the rest: those visited first, then its
 * countries not been to yet. Closed with ×, Escape, or a click beside it.
 */
function ContinentPopup({ continent, visited, notVisited, count, total, noteFor, canRemove, onRemove, onShow, onClose }: PopupProps) {
  const titleId = useId()
  // Escape closes it, before anything else
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])
  /** A place: its flag and name, and for one visited, what's noted about it and whether it can be removed */
  const row = (c: CountryFeature, been: boolean) => (
    <li key={c.properties.name} className="country-item">
      <button type="button" className="country-row" onClick={() => onShow(c)}>
        <Flag country={c} />
        <span className="row-text">
          <span className="row-name">{c.properties.name}</span>
          {been && noteFor(c) && <span className="row-note">{noteFor(c)}</span>}
        </span>
      </button>
      {been && canRemove(c) && (
        <button type="button" className="icon-button small" onClick={() => onRemove(c.properties.name)} aria-label={`Remove ${c.properties.name}`}>
          ×
        </button>
      )}
    </li>
  )
  return createPortal(
    <div className="popup-backdrop" onClick={onClose}>
      <section className="card popup" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <header className="card-header">
          <h3 id={titleId} className="card-label">
            {continent}
          </h3>
          {total > 0 && (
            <span className="card-meta">
              {count} / {total}
            </span>
          )}
          <button type="button" className="close-button" onClick={onClose} aria-label="Close" autoFocus>
            <CloseIcon />
          </button>
        </header>
        <div className="popup-body">
          <h3>
            Visited <span className="row-meta">{visited.length}</span>
          </h3>
          {visited.length === 0 ? (
            <p className="muted continent-none">None yet in {continent}.</p>
          ) : (
            <ul className="country-list continent-places" aria-label={`Visited in ${continent}`}>
              {visited.map((c) => row(c, true))}
            </ul>
          )}
          {notVisited.length > 0 && (
            <>
              <h3>
                Not yet <span className="row-meta">{notVisited.length}</span>
              </h3>
              <ul className="country-list continent-places not-yet" aria-label={`Not yet in ${continent}`}>
                {notVisited.map((c) => row(c, false))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
