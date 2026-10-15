import type { CountryFeature } from '../countries'
import { cityOf } from '../data/airports'
import { formatDistance, type Route } from '../data/flights'
import { MONTHS, visitDate, type VisitDate } from '../data/visitDates'
import StatsBox from '../ui/StatsBox'
import { Flag } from './VisitedPanel'
import type { YearReview } from './yearInReview'

type Props = {
  /** The years with dated visits or flights, newest first */
  years: readonly number[]
  /** The year shown, or null when nothing has a date */
  review: YearReview | null
  onYearChange: (year: number) => void
  /** The note on a visit, if it has one */
  noteOf?: (name: string, date: VisitDate) => string | undefined
  onShow: (country: CountryFeature) => void
  onShowRoute: (route: Route) => void
  /** Replays the year's trips on the globe, if there's anything of it to replay */
  onReplay?: () => void
  /** The year shown, wrapped: its card to keep or share */
  onWrap?: () => void
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const monthId = (month: number | null) => `year-month-${month ?? 'any'}`

/**
 * "6 countries on 4 continents, 5 new places." and "8 flights, 21,400 km.". A territory counts as its country, so
 * Iceland and Greenland are 2 countries; only places that are no country's, like Antarctica, are counted apart. The
 * new places are those in green, first visited that year: Greenland is one, even after Denmark.
 */
function summaryOf({ places, countryCount, noCountry, firstVisits, continents, flights, km }: YearReview) {
  const lines: string[] = []
  if (places.length > 0) {
    const counted = [
      countryCount > 0 && plural(countryCount, 'country', 'countries'),
      noCountry.length > 0 && plural(noCountry.length, 'territory', 'territories'),
    ]
      .filter(Boolean)
      .join(' and ')
    const fresh = firstVisits.size > 0 ? `, ${plural(firstVisits.size, 'new place')}` : ''
    lines.push(`${counted} on ${plural(continents.length, 'continent')}${fresh}.`)
  }
  if (flights.length > 0) lines.push(`${plural(flights.length, 'flight')}, ${formatDistance(km)}.`)
  return lines
}

/** The Visited tab's years: a year's places month by month, and its flights; the globe shows just that year */
export default function YearsPanel({ years, review, onYearChange, noteOf, onShow, onShowRoute, onReplay, onWrap }: Props) {
  if (!review) {
    return (
      <p className="muted">
        No dates yet. Open a country you've been to and add when you went, under Visits, or give your flights a
        date: each year then gets its review here, and the globe can show just that year.
      </p>
    )
  }
  const { year, months, longest, firstVisits } = review
  const index = years.indexOf(year)
  return (
    <div className="years">
      <div className="year-picker">
        <button
          type="button"
          className="icon-button"
          aria-label="Earlier year"
          disabled={index === years.length - 1}
          onClick={() => onYearChange(years[index + 1])}
        >
          ‹
        </button>
        <h3 className="year-heading" aria-live="polite">
          {year}
        </h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Later year"
          disabled={index === 0}
          onClick={() => onYearChange(years[index - 1])}
        >
          ›
        </button>
      </div>
      {review.mostTravelled && <p className="year-badge">Your most travelled year</p>}
      <p className="year-summary">
        {summaryOf(review).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>
      {onWrap && (
        <button type="button" className="primary-button year-wrap" onClick={onWrap}>
          ✨ Your {year}, wrapped
        </button>
      )}
      {onReplay && (
        <button type="button" className="primary-button secondary year-replay" onClick={onReplay}>
          ▶ Replay {year}
        </button>
      )}

      <StatsBox
        label={`Places in ${year}`}
        stats={[
          { label: 'Countries', value: review.countryCount },
          { label: 'First visits', value: firstVisits.size },
          { label: 'Continents', value: review.continents.length },
        ]}
      />
      {review.flights.length > 0 && (
        <StatsBox
          label={`Flights in ${year}`}
          stats={[
            { label: 'Flights', value: review.flights.length },
            { label: 'Distance', value: formatDistance(review.km) },
            { label: 'Longest', value: formatDistance(longest!.km) },
          ]}
        />
      )}

      <h3>Month by month</h3>
      {months.length === 0 ? (
        <p className="muted">
          No visits dated {year}, only flights. Add when you went in a country's panel, under Visits.
        </p>
      ) : (
        <ul className="continent-groups" aria-label="Month by month">
          {months.map(({ month, places }) => (
            <li key={month ?? 'any'}>
              <h4 id={monthId(month)}>{month ? MONTHS[month - 1] : `Sometime in ${year}`}</h4>
              <ul className="country-list" aria-labelledby={monthId(month)}>
                {places.map((c) => {
                  // The visit's own note, after "First visit"
                  const note = [firstVisits.has(c) && 'First visit', noteOf?.(c.properties.name, visitDate(year, month))]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <li key={c.properties.name} className="country-item">
                      <button type="button" className="country-row" onClick={() => onShow(c)}>
                        <Flag country={c} />
                        <span className="row-text">
                          <span className="row-name">{c.properties.name}</span>
                          {note && <span className="row-note">{note}</span>}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {longest && (
        <>
          <h3>Longest flight</h3>
          <button type="button" className="country-row" onClick={() => onShowRoute(longest)}>
            <span className="row-text">
              <span className="row-name">
                {cityOf(longest.from)} → {cityOf(longest.to)}
              </span>
              <span className="row-note">
                {longest.from.code} → {longest.to.code} · {formatDistance(longest.km)}
              </span>
            </span>
          </button>
        </>
      )}

      <p className="muted year-note">
        The globe shows only {year}: where you went and the flights you took. Places and flights without a date
        aren't in any year.
      </p>
    </div>
  )
}
