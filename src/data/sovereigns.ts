import { countries, countryByAlpha2, type CountryFeature } from '../countries'

/**
 * The country each territory belongs to, by its code: being in Greenland is
 * being in Denmark. Antarctica, Western Sahara and the Siachen Glacier
 * belong to none: no one's, or claimed by more than one.
 */
const SOVEREIGNS: Record<string, string> = {
  // The United States
  'Northern Mariana Islands': 'US',
  'U.S. Virgin Islands': 'US',
  Guam: 'US',
  'American Samoa': 'US',
  'Puerto Rico': 'US',
  // The United Kingdom, with the Crown Dependencies
  'South Georgia and the South Sandwich Islands': 'GB',
  'Saint Helena': 'GB',
  'Pitcairn Islands': 'GB',
  Anguilla: 'GB',
  'Falkland Islands': 'GB',
  'Cayman Islands': 'GB',
  Bermuda: 'GB',
  'British Virgin Islands': 'GB',
  'Turks and Caicos Islands': 'GB',
  Montserrat: 'GB',
  Gibraltar: 'GB',
  Jersey: 'GB',
  Guernsey: 'GB',
  'Isle of Man': 'GB',
  // The Realm of New Zealand
  Niue: 'NZ',
  'Cook Islands': 'NZ',
  // The Kingdom of the Netherlands
  Aruba: 'NL',
  Curaçao: 'NL',
  'Sint Maarten': 'NL',
  // France
  'Saint Pierre and Miquelon': 'FR',
  'Wallis and Futuna': 'FR',
  'Saint Martin': 'FR',
  'Saint Barthélemy': 'FR',
  'French Polynesia': 'FR',
  'New Caledonia': 'FR',
  'French Southern and Antarctic Lands': 'FR',
  // The Nordics
  'Åland Islands': 'FI',
  Greenland: 'DK',
  'Faroe Islands': 'DK',
  // China
  Macao: 'CN',
  'Hong Kong': 'CN',
  // Australia
  'Australian Indian Ocean Territories': 'AU',
  'Heard Island and McDonald Islands': 'AU',
  'Norfolk Island': 'AU',
  'Ashmore and Cartier Islands': 'AU',
}

/** The country a place is in: a country itself, the one a territory belongs to, or null for none */
export function countryOfPlace(place: CountryFeature): CountryFeature | null {
  if (place.properties.kind === 'country') return place
  const code = SOVEREIGNS[place.properties.name]
  return code ? countryByAlpha2(code) : null
}

/** Each country's territories, by name */
const TERRITORIES = new Map<CountryFeature, CountryFeature[]>()
for (const place of [...countries].sort((a, b) => a.properties.name.localeCompare(b.properties.name))) {
  const country = countryOfPlace(place)
  if (country && country !== place) TERRITORIES.set(country, [...(TERRITORIES.get(country) ?? []), place])
}

/** The territories that belong to a country, by name: Denmark's are the Faroe Islands and Greenland */
export const territoriesOf = (country: CountryFeature): readonly CountryFeature[] => TERRITORIES.get(country) ?? []

/** The countries places are in, each once: Greenland and the Faroe Islands are both Denmark */
export function countriesOf(places: Iterable<CountryFeature>): Set<CountryFeature> {
  return new Set([...places].map(countryOfPlace).filter((country) => country !== null))
}

/**
 * The places been to, by name: those visited, and the countries their
 * territories belong to, as being in Greenland is being in Denmark
 */
export function beenTo(visited: ReadonlySet<string>): ReadonlySet<string> {
  const places = countries.filter((c) => visited.has(c.properties.name))
  return new Set([...visited, ...[...countriesOf(places)].map((c) => c.properties.name)])
}
