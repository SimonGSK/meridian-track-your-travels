import { useState, type ComponentProps } from 'react'
import type { CountryFeature } from './countries'
import { factsOf, formatArea, formatAreaShort, formatPopulation, formatPopulationShort } from './data/facts'
import { languagesOf } from './data/languages'
import { clockIn, comparedToYou, timeZonesOf, timesIn, utcOffset } from './data/localTime'
import { currenciesOf, currencyName, exchange, formatSum, formatWorth, type Rates } from './data/money'
import { useMinute } from './ui/useMinute'
import { CheckIcon, CloseIcon, PlusIcon, StarIcon } from './icons'
import CityPicker from './CityPicker'
import RegionPicker from './RegionPicker'
import CountryVisits from './visited/CountryVisits'
import { useSwipeToClose } from './nav/swipeToClose'

type Props = {
  country: CountryFeature
  visited: boolean
  onToggleVisited: () => void
  /** On the wishlist, for places not visited yet */
  wished?: boolean
  onToggleWish?: () => void
  onClose: () => void
  /** For countries with states or provinces */
  regions?: ComponentProps<typeof RegionPicker>
  /** For countries with cities to pick */
  cities?: ComponentProps<typeof CityPicker>
  /** Its visits, each in the trip it was part of */
  visits?: ComponentProps<typeof CountryVisits>
  /** Visited on a trip, so in your atlas while the trip has it */
  onTrips?: boolean
  /** Your currency, and the rates to say what the place's is worth in it */
  money?: { currency: string; rates: Rates }
}

/** The selected country, on the left: "SELECTED COUNTRY", its facts, cities and states. */
export default function CountryPanel(props: Props) {
  const { country, visited, onToggleVisited, wished = false, onToggleWish, onClose, regions, cities, visits, onTrips = false, money } = props
  const { name, kind, continent, areaKm2: mapArea, isoCode, isoAlpha2 } = country.properties
  const facts = factsOf(country)
  const code = isoCode ?? isoAlpha2
  const regionCount = regions?.regions && `${regions.regions.length} ${regions.label.toLowerCase()}`
  // On phones, a sheet to swipe up all the way, or down to close
  const { ref: sheet, raised } = useSwipeToClose<HTMLElement>(onClose)

  return (
    <aside ref={sheet} className={`panel country-panel${raised ? ' raised' : ''}`} aria-labelledby="country-panel-title">
      <span className="sheet-grabber" aria-hidden="true" />
      <header className="card-header">
        <span className="card-label">Selected {kind === 'country' ? 'country' : 'territory'}</span>
        {code && <span className="card-meta">ISO {code}</span>}
        <button type="button" className="close-button" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>
      <h2 id="country-panel-title" className="country-name">
        {name}
      </h2>
      <p className="panel-meta">{[continent, regionCount].filter(Boolean).join(' · ')}</p>
      {facts && <Facts country={country} facts={facts} mapArea={mapArea} money={money} />}
      {visits && <CountryVisits {...visits} />}
      {cities && <CityPicker {...cities} />}
      {regions && <RegionPicker {...regions} />}
      <button
        type="button"
        className={`atlas-button${visited ? ' on' : ''}`}
        aria-pressed={visited}
        // A trip went there: it stays in your atlas while the trip has it
        disabled={onTrips}
        onClick={onToggleVisited}
      >
        {visited ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
        {visited ? 'In visited atlas' : 'Add to visited atlas'}
      </button>
      {onTrips && <p className="muted small atlas-note">Visited on a trip: take it out of the trip to remove it.</p>}
      {!visited && onToggleWish && (
        <button type="button" className={`wish-button${wished ? ' on' : ''}`} aria-pressed={wished} onClick={onToggleWish}>
          <StarIcon size={16} filled={wished} />
          {wished ? 'On your wishlist' : 'Add to wishlist'}
        </button>
      )}
    </aside>
  )
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function Facts({ country, facts, mapArea, money }: {
  country: CountryFeature
  facts: NonNullable<ReturnType<typeof factsOf>>
  mapArea: number
  money?: Props['money']
}) {
  const { capital, population, populationYear, areaKm2, note, source } = facts
  const area = areaKm2 ?? Math.round(mapArea)
  const zones = timeZonesOf(country)
  const currencies = currenciesOf(country)
  const languages = languagesOf(country)
  // Under the figures, side by side; one alone across
  const below = (zones.length > 0 ? 1 : 0) + (currencies.length > 0 && money ? 1 : 0)
  return (
    <>
      <dl className="facts">
        <div className="fact fact-wide">
          <dt>Capital</dt>
          <dd className="fact-capital">{capital ?? 'None'}</dd>
        </div>
        <div className="fact">
          <dt>Inhabitants</dt>
          <dd className="fact-number" title={population ? formatPopulation(population) : undefined}>
            {population === null ? '–' : population === 0 ? 'None' : formatPopulationShort(population)}
          </dd>
        </div>
        <div className="fact">
          <dt>Area</dt>
          <dd className="fact-number" title={formatArea(area)}>
            {areaKm2 ? '' : '≈ '}
            {formatAreaShort(area)}
          </dd>
        </div>
        {zones.length > 0 && <LocalTime zones={zones} alone={below === 1} />}
        {currencies.length > 0 && money && <Currency currencies={currencies} money={money} alone={below === 1} />}
        {languages.length > 0 && <Languages key={country.properties.name} names={languages} />}
      </dl>
      {note && <p className="facts-note">{note}</p>}
      <p className="facts-source">
        {source === 'World Bank' ? 'Source: World Bank (CC BY 4.0)' : 'Estimate'}
        {populationYear && population ? ` · ${populationYear}` : ''}
        {currencies.length > 0 && money ? ` · rates of ${dayMonth.format(new Date(money.rates.date))}` : ''}
      </p>
    </>
  )
}

/** The time at the capital, as a clock, and how far ahead of yours it is; for a place of several times, how many */
function LocalTime({ zones, alone }: { zones: readonly string[]; alone: boolean }) {
  const now = useMinute()
  const [capital] = zones
  const times = timesIn(zones, now)
  return (
    <div className={`fact fact-below${alone ? ' fact-alone' : ''}`}>
      <dt>Local time</dt>
      <dd className="fact-number">{clockIn(capital, now)}</dd>
      <dd className="fact-note">{comparedToYou(utcOffset(capital, now) + now.getTimezoneOffset())}</dd>
      {times > 1 && <dd className="fact-note">In the capital, of {times} time zones</dd>}
    </div>
  )
}

/** What a round sum of the place's money is worth in yours ("100 JPY = 4.23 DKK"), or that it's yours */
function Currency({ currencies, money, alone }: { currencies: readonly string[]; money: NonNullable<Props['money']>; alone: boolean }) {
  const [main] = currencies
  const worth = main === money.currency ? null : exchange(main, money.currency, money.rates)
  const names = currencies.map(currencyName).join(', and ')
  return (
    <div className={`fact fact-below${alone ? ' fact-alone' : ''}`}>
      <dt>Currency</dt>
      {worth ? (
        <dd className="fact-number fact-exchange">
          <span>
            {formatSum(worth.amount)} {main} =
          </span>{' '}
          <span>
            {formatWorth(worth.worth)} {money.currency}
          </span>
        </dd>
      ) : (
        <dd className="fact-number">{main}</dd>
      )}
      <dd className="fact-note">{main === money.currency ? `${names}, as yours` : names}</dd>
    </div>
  )
}

/** How many languages show before "+ more" */
export const SHOWN_LANGUAGES = 4

/** The languages spoken there, the official ones first: the first few, and the rest when asked for */
function Languages({ names }: { names: readonly string[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? names : names.slice(0, SHOWN_LANGUAGES)
  const more = names.length - shown.length
  return (
    <div className="fact fact-languages">
      <dt>{names.length === 1 ? 'Language' : 'Languages'}</dt>
      <dd>
        {shown.join(', ')}
        {more > 0 && (
          <>
            {' '}
            <button type="button" className="link-button" onClick={() => setAll(true)} aria-label={`${more} more languages`}>
              +{more} more
            </button>
          </>
        )}
      </dd>
    </div>
  )
}

