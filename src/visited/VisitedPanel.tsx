import { useState } from 'react'
import { countries, searchCountries, type CountryFeature } from '../countries'
import { CONTINENTS, type Continent } from '../data/continents'
import { flagUrl } from '../flags'
import { CloseIcon, StarIcon } from '../icons'
import { countdown, formatDay, type Day } from '../data/plans'
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
  /** Places you want to go, not visited yet, by name */
  wishlist?: ReadonlySet<string>
  onWish?: (name: string) => void
  onUnwish?: (name: string) => void
  /** Visits planned, by place: the day you're going */
  plans?: Readonly<Record<string, Day>>
  onUnplan?: (name: string) => void
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
// No spaces: aria-controls reads spaces as separators between ids
const placesId = (continent: Continent) => `visited-in-${continent.replace(/\s+/g, '-')}`

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
const NO_PLANS: Readonly<Record<string, Day>> = {}

export default function VisitedPanel(props: Props) {
  const { visited, onAdd, onRemove, onShow, note, cityCount = 0, wishlist = NO_WISHES, onWish, onUnwish } = props
  const { plans = NO_PLANS, onUnplan } = props
  const [query, setQuery] = useState('')
  /** The continent whose places are listed under its bar */
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
  // Soonest first
  const upcoming = countries
    .filter((c) => plans[c.properties.name])
    .sort((a, b) => plans[a.properties.name].localeCompare(plans[b.properties.name]))
  // A second line under the name: "Territory", and states and cities visited; "In Greenland" for Denmark been to there
  const noteFor = (c: CountryFeature) =>
    throughTerritory(c)
      ? `In ${listOf(territoriesOf(c))}`
      : [isCountry(c) ? null : 'Territory', note?.(c)].filter(Boolean).join(' · ') || null

  // Adding a place opens its continent, to see it there
  const add = (country: CountryFeature) => {
    onAdd(country.properties.name)
    setQuery('')
    setOpen(country.properties.continent)
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
          const isOpen = open === continent
          return (
            <li key={continent} className={isOpen ? 'open' : undefined}>
              {/* The whole bar opens the continent's places; the button, for the keyboard */}
              <div className="continent-row" onClick={() => setOpen(isOpen ? null : continent)}>
                <button type="button" className="continent-name" aria-expanded={isOpen} aria-controls={placesId(continent)}>
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
              {isOpen &&
                (places.length === 0 ? (
                  <p id={placesId(continent)} className="muted continent-none">
                    None yet in {continent}.
                  </p>
                ) : (
                  <ul id={placesId(continent)} className="country-list continent-places" aria-label={`Visited in ${continent}`}>
                    {places.map((c) => (
                      <li key={c.properties.name} className="country-item">
                        <button type="button" className="country-row" onClick={() => onShow(c)}>
                          <Flag country={c} />
                          <span className="row-text">
                            <span className="row-name">{c.properties.name}</span>
                            {noteFor(c) && <span className="row-note">{noteFor(c)}</span>}
                          </span>
                        </button>
                        {/* Been to in a territory, not marked itself: nothing to remove */}
                        {!throughTerritory(c) && (
                          <button
                            type="button"
                            className="icon-button small"
                            onClick={() => onRemove(c.properties.name)}
                            aria-label={`Remove ${c.properties.name}`}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ))}
            </li>
          )
        })}
      </ul>
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

      {upcoming.length > 0 && (
        <>
          <h3>Upcoming</h3>
          <ul className="country-list" aria-label="Upcoming">
            {upcoming.map((c) => {
              const day = plans[c.properties.name]
              return (
                <li key={c.properties.name} className="country-item">
                  <button type="button" className="country-row" onClick={() => onShow(c)}>
                    <Flag country={c} />
                    <span className="row-text">
                      <span className="row-name">{c.properties.name}</span>
                      <span className="row-note">
                        {formatDay(day)} · <strong className="countdown">{countdown(day)}</strong>
                      </span>
                    </span>
                  </button>
                  {onUnplan && (
                    <button
                      type="button"
                      className="icon-button small"
                      onClick={() => onUnplan(c.properties.name)}
                      aria-label={`Not going to ${c.properties.name} after all`}
                    >
                      <CloseIcon size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

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
