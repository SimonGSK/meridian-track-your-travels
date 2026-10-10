import type { ComponentProps } from 'react'
import type { CountryFeature } from './countries'
import { factsOf, formatArea, formatAreaShort, formatPopulation, formatPopulationShort } from './data/facts'
import { CheckIcon, CloseIcon, PlusIcon, StarIcon } from './icons'
import CityPicker from './CityPicker'
import RegionPicker from './RegionPicker'
import VisitsCard from './visited/VisitsCard'
import PlanVisit from './visited/PlanVisit'
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
  /** When you went, once it's visited */
  visits?: ComponentProps<typeof VisitsCard>
  /** A visit you're planning */
  plan?: ComponentProps<typeof PlanVisit>
}

/** The selected country, on the left: "SELECTED COUNTRY", its facts, cities and states. */
export default function CountryPanel(props: Props) {
  const { country, visited, onToggleVisited, wished = false, onToggleWish, onClose, regions, cities, visits, plan } = props
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
      {facts && <Facts facts={facts} mapArea={mapArea} />}
      {visits && <VisitsCard {...visits} />}
      {cities && <CityPicker {...cities} />}
      {regions && <RegionPicker {...regions} />}
      <button
        type="button"
        className={`atlas-button${visited ? ' on' : ''}`}
        aria-pressed={visited}
        onClick={onToggleVisited}
      >
        {visited ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
        {visited ? 'In visited atlas' : 'Add to visited atlas'}
      </button>
      {!visited && onToggleWish && (
        <button type="button" className={`wish-button${wished ? ' on' : ''}`} aria-pressed={wished} onClick={onToggleWish}>
          <StarIcon size={16} filled={wished} />
          {wished ? 'On your wishlist' : 'Add to wishlist'}
        </button>
      )}
      {plan && <PlanVisit {...plan} />}
    </aside>
  )
}

function Facts({ facts, mapArea }: { facts: NonNullable<ReturnType<typeof factsOf>>; mapArea: number }) {
  const { capital, population, populationYear, areaKm2, note, source } = facts
  const area = areaKm2 ?? Math.round(mapArea)
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
      </dl>
      {note && <p className="facts-note">{note}</p>}
      <p className="facts-source">
        {source === 'World Bank' ? 'Source: World Bank (CC BY 4.0)' : 'Estimate'}
        {populationYear && population ? ` · ${populationYear}` : ''}
      </p>
    </>
  )
}
