import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { countries, searchCountries, type CountryFeature } from '../countries'
import { CONTINENTS, type Continent } from '../data/continents'
import { flagUrl } from '../flags'
import { CheckIcon, CloseIcon, StarIcon } from '../icons'
import { worldShareOf } from '../data/facts'
import { countriesOf, countryOfPlace, territoriesOf } from '../data/sovereigns'
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
  /** Shows your atlas as a poster, to save as a picture or share */
  onPoster?: () => void
}

const byName = (a: CountryFeature, b: CountryFeature) => a.properties.name.localeCompare(b.properties.name)
const isCountry = (c: CountryFeature) => c.properties.kind === 'country'
const COUNTRY_COUNT = countries.filter(isCountry).length
const TERRITORY_COUNT = countries.length - COUNTRY_COUNT
/** Countries per continent; Antarctica has none, so its places are counted instead */
const COUNTRIES_IN = new Map(
  CONTINENTS.map((continent) => [continent, countries.filter((c) => isCountry(c) && c.properties.continent === continent).length]),
)
/**
 * The places listed under a continent: its countries, and the territories
 * that are no country's, like Antarctica. Every other territory is listed
 * under its country, as the Faroe Islands are under Denmark.
 */
const PLACES_IN = new Map(
  CONTINENTS.map((continent) => [
    continent,
    countries.filter((c) => c.properties.continent === continent && (isCountry(c) || !countryOfPlace(c))).sort(byName),
  ]),
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
  const { visited, onAdd, onRemove, onShow, note, cityCount = 0, inTrips = NO_WISHES, wishlist = NO_WISHES, onWish, onUnwish, onPoster } = props
  const [query, setQuery] = useState('')
  /** The continent whose places are listed, over the rest */
  const [open, setOpen] = useState<Continent | null>(null)

  const visitedList = countries.filter((c) => visited.has(c.properties.name)).sort(byName)
  const notVisited = countries.filter((c) => !visited.has(c.properties.name))
  const matches = searchCountries(query, notVisited, MAX_RESULTS)
  // The countries been to: those visited, and those a territory visited belongs to, as Greenland is Denmark's
  const been = countriesOf(visitedList)
  const visitedCountries = been.size
  const visitedTerritories = visitedList.filter((c) => !isCountry(c)).length
  /** Been to a place listed under a continent: a country (also in one of its territories), or a territory that is no country's */
  const beenTo = (c: CountryFeature) => been.has(c) || visited.has(c.properties.name)
  const isVisited = (c: CountryFeature) => visited.has(c.properties.name)
  /** Countries been to only in a territory of theirs, like Denmark in Greenland */
  const throughTerritory = (country: CountryFeature) => !isVisited(country)
  const wishes = countries.filter((c) => wishlist.has(c.properties.name)).sort(byName)
  // The places been to are home to this much of the world's people, and cover this much of its land
  const share = worldShareOf(visitedList)
  // A second line under the name: "Territory" for one that's no country's, and states and cities visited; "In Greenland" for Denmark been to there
  const noteFor = (c: CountryFeature) =>
    throughTerritory(c)
      ? `In ${listOf(territoriesOf(c).filter(isVisited).map((t) => t.properties.name))}`
      : [countryOfPlace(c) ? null : 'Territory', note?.(c)].filter(Boolean).join(' · ') || null

  const add = (country: CountryFeature) => {
    onAdd(country.properties.name)
    setQuery('')
  }

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
      {visitedList.length > 0 && (
        <span className="visited-percent world-share">
          Home to {percentLabel(share.people, 1)} of its people, on {percentLabel(share.land, 1)} of its land
        </span>
      )}
      {visitedList.length > 0 && onPoster && (
        <button type="button" className="link-button atlas-poster" onClick={onPoster}>
          ✨ Your atlas as a poster
        </button>
      )}

      <h3>By continent</h3>
      <ul className="continent-stats" aria-label="Countries visited by continent">
        {CONTINENTS.map((continent) => {
          const total = COUNTRIES_IN.get(continent)!
          const places = PLACES_IN.get(continent)!.filter(beenTo)
          const count = places.filter(isCountry).length
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
          visited={PLACES_IN.get(open)!.filter(beenTo)}
          notVisited={PLACES_IN.get(open)!.filter((c) => !beenTo(c))}
          count={PLACES_IN.get(open)!.filter((c) => isCountry(c) && beenTo(c)).length}
          total={COUNTRIES_IN.get(open)!}
          isVisited={isVisited}
          noteFor={noteFor}
          canRemove={(c) => !throughTerritory(c) && !inTrips.has(c.properties.name)}
          onAdd={onAdd}
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
  /** Its countries been to, also only in a territory of theirs, and its territories visited that are no country's */
  visited: CountryFeature[]
  /** Its countries and those territories not been to yet */
  notVisited: CountryFeature[]
  /** Countries been to there, of how many */
  count: number
  total: number
  /** Whether a territory listed under its country is visited */
  isVisited: (place: CountryFeature) => boolean
  noteFor: (country: CountryFeature) => string | null
  canRemove: (country: CountryFeature) => boolean
  /** Marks a place not been to yet as visited; a country moves up to those visited, also when one of its territories is marked */
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  onShow: (country: CountryFeature) => void
  onClose: () => void
}

/**
 * A continent's places, over the rest: those visited first, then its
 * countries not been to yet, each to mark as visited. A country's
 * territories are under it, each visited or not. Closed with ×, Escape, or
 * a click beside it.
 */
function ContinentPopup(props: PopupProps) {
  const { continent, visited, notVisited, count, total, isVisited, noteFor, canRemove, onAdd, onRemove, onShow, onClose } = props
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
  /** A place: its flag and name; for one visited, what's noted about it and whether it can be removed, else a way to mark it */
  const row = (c: CountryFeature, been: boolean) => (
    <>
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
      {!been && (
        <button
          type="button"
          className="icon-button small mark-visited"
          onClick={() => onAdd(c.properties.name)}
          aria-label={`Mark ${c.properties.name} as visited`}
          title="Mark as visited"
        >
          <CheckIcon size={15} />
        </button>
      )}
    </>
  )
  /** A place in the list, with the territories that belong to it under it */
  const place = (c: CountryFeature, been: boolean) => {
    const territories = territoriesOf(c)
    return (
      <li key={c.properties.name} className="continent-place">
        <div className={been ? 'country-item' : 'country-item not-been'}>{row(c, been)}</div>
        {territories.length > 0 && (
          <ul className="country-list territories" aria-label={`Territories of ${c.properties.name}`}>
            {territories.map((territory) => (
              <li key={territory.properties.name} className={isVisited(territory) ? 'country-item' : 'country-item not-been'}>
                {row(territory, isVisited(territory))}
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }
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
              {visited.map((c) => place(c, true))}
            </ul>
          )}
          {notVisited.length > 0 && (
            <>
              <h3>
                Not yet <span className="row-meta">{notVisited.length}</span>
              </h3>
              <ul className="country-list continent-places" aria-label={`Not yet in ${continent}`}>
                {notVisited.map((c) => place(c, false))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  )
}
