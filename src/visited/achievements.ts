import { countries, findCountryByName } from '../countries'
import { CONTINENTS } from '../data/continents'
import { regionIdsOf } from '../data/regions'
import { beenTo } from '../data/sovereigns'
import { countriesIn } from '../games/allGame'

/** What achievements are earned from: everything you've been to and flown */
export type Atlas = {
  /** Countries and territories, by name */
  visited: ReadonlySet<string>
  /** States and provinces, by id ("US-CA") */
  regions: ReadonlySet<string>
  /** Cities, and whether each is a capital */
  cities: readonly { capital?: boolean }[]
  /** Flights, with how far each went */
  flights: readonly { km: number }[]
  /** How many times you've been to a country, by name */
  visitsTo: (name: string) => number
  /** The trips been on: the places each went to, by name, and its flights flown, in order */
  trips: readonly Trip[]
}

type Point = { lat: number; lng: number }
export type Trip = { places: readonly string[]; flights: readonly { from: Point; to: Point }[] }

export const GROUPS = ['Milestones', 'Continents', 'Regions', 'Islands', 'States', 'Cities', 'Flights', 'Trips', 'Return trips'] as const
export type Group = (typeof GROUPS)[number]

export type Achievement = {
  id: string
  group: Group
  title: string
  description: string
  /** How many it takes */
  need: number
  /** How many you have */
  have: (atlas: Atlas) => number
  /** Shows a count, e.g. "12,345 km" */
  format?: (n: number) => string
}

const allCountries = countries.filter((c) => c.properties.kind === 'country')
// A territory visited counts for its country: being in Greenland is being in Denmark
const visitedCountries = (atlas: Atlas) => {
  const been = beenTo(atlas.visited)
  return allCountries.filter((c) => been.has(c.properties.name))
}
const count = (atlas: Atlas, names: readonly string[]) => {
  const been = beenTo(atlas.visited)
  return names.filter((n) => been.has(n)).length
}

/** Every one of a group of countries */
const allOf = (id: string, group: Group, title: string, description: string, names: readonly string[]): Achievement => ({
  id,
  group,
  title,
  description,
  need: names.length,
  have: (atlas) => count(atlas, names),
})

/** How many of something */
const atLeast = (
  id: string,
  group: Group,
  title: string,
  description: string,
  need: number,
  have: (atlas: Atlas) => number,
  format?: (n: number) => string,
): Achievement => ({ id, group, title, description, need, have, format })

const milestone = (need: number, title: string, description = `${need} countries`) =>
  atLeast(`countries-${need}`, 'Milestones', title, description, need, (atlas) => visitedCountries(atlas).length)

const LIVED_ON = CONTINENTS.filter((c) => countriesIn(c).length > 0)
const continentTitle: Record<string, string> = {
  Africa: 'All of Africa',
  Asia: 'All of Asia',
  Europe: 'All of Europe',
  'North America': 'All of North America',
  Oceania: 'All of Oceania',
  'South America': 'All of South America',
}

/** Groups of countries, by today's names */
export const REGIONS: { id: string; title: string; description: string; names: string[] }[] = [
  { id: 'scandinavia', title: 'Scandinavia', description: 'Denmark, Norway and Sweden', names: ['Denmark', 'Norway', 'Sweden'] },
  {
    id: 'nordics',
    title: 'The Nordics',
    description: 'Scandinavia, Finland and Iceland',
    names: ['Denmark', 'Finland', 'Iceland', 'Norway', 'Sweden'],
  },
  { id: 'baltics', title: 'The Baltics', description: 'Estonia, Latvia and Lithuania', names: ['Estonia', 'Latvia', 'Lithuania'] },
  { id: 'benelux', title: 'Benelux', description: 'Belgium, the Netherlands and Luxembourg', names: ['Belgium', 'Luxembourg', 'Netherlands'] },
  { id: 'british-isles', title: 'The British Isles', description: 'The United Kingdom and Ireland', names: ['Ireland', 'United Kingdom'] },
  { id: 'iberia', title: 'Iberia', description: 'Spain, Portugal and Andorra', names: ['Andorra', 'Portugal', 'Spain'] },
  {
    id: 'alps',
    title: 'The Alps',
    description: 'Every country the Alps reach',
    names: ['Austria', 'France', 'Germany', 'Italy', 'Liechtenstein', 'Monaco', 'Slovenia', 'Switzerland'],
  },
  {
    id: 'microstates',
    title: "Europe's microstates",
    description: 'Andorra, Liechtenstein, Malta, Monaco, San Marino and Vatican City',
    names: ['Andorra', 'Liechtenstein', 'Malta', 'Monaco', 'San Marino', 'Vatican City'],
  },
  {
    id: 'yugoslavia',
    title: 'The former Yugoslavia',
    description: 'Every country it split into',
    names: ['Bosnia and Herzegovina', 'Croatia', 'Kosovo', 'Montenegro', 'North Macedonia', 'Serbia', 'Slovenia'],
  },
  {
    id: 'central-america',
    title: 'Central America',
    description: 'From Guatemala and Belize to Panama',
    names: ['Belize', 'Costa Rica', 'El Salvador', 'Guatemala', 'Honduras', 'Nicaragua', 'Panama'],
  },
  {
    id: 'caribbean',
    title: 'The Caribbean',
    description: 'Every island country of the Caribbean',
    names: [
      'Antigua and Barbuda', 'Bahamas', 'Barbados', 'Cuba', 'Dominica', 'Dominican Republic', 'Grenada', 'Haiti',
      'Jamaica', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Trinidad and Tobago',
    ],
  },
  {
    id: 'andes',
    title: 'The Andes',
    description: 'Every country the Andes run through',
    names: ['Argentina', 'Bolivia', 'Chile', 'Colombia', 'Ecuador', 'Peru', 'Venezuela'],
  },
  {
    id: 'gulf',
    title: 'The Gulf',
    description: 'The six Gulf states',
    names: ['Bahrain', 'Kuwait', 'Oman', 'Qatar', 'Saudi Arabia', 'United Arab Emirates'],
  },
  {
    id: 'stans',
    title: 'The Stans',
    description: 'The five countries of Central Asia',
    names: ['Kazakhstan', 'Kyrgyzstan', 'Tajikistan', 'Turkmenistan', 'Uzbekistan'],
  },
  {
    id: 'southeast-asia',
    title: 'Southeast Asia',
    description: 'From Myanmar to Timor-Leste',
    names: [
      'Brunei', 'Cambodia', 'Indonesia', 'Laos', 'Malaysia', 'Myanmar', 'Philippines', 'Singapore', 'Thailand',
      'Timor-Leste', 'Vietnam',
    ],
  },
  {
    id: 'east-asia',
    title: 'East Asia',
    description: 'China, Japan, Mongolia, the Koreas and Taiwan',
    names: ['China', 'Japan', 'Mongolia', 'North Korea', 'South Korea', 'Taiwan'],
  },
  {
    id: 'maghreb',
    title: 'The Maghreb',
    description: 'Morocco, Algeria, Tunisia, Libya and Mauritania',
    names: ['Algeria', 'Libya', 'Mauritania', 'Morocco', 'Tunisia'],
  },
  {
    id: 'horn-of-africa',
    title: 'The Horn of Africa',
    description: 'Djibouti, Eritrea, Ethiopia and Somalia',
    names: ['Djibouti', 'Eritrea', 'Ethiopia', 'Somalia'],
  },
  {
    id: 'southern-africa',
    title: 'Southern Africa',
    description: 'South Africa and its neighbors',
    names: ['Botswana', 'Eswatini', 'Lesotho', 'Namibia', 'South Africa'],
  },
  {
    id: 'pacific',
    title: 'The Pacific islands',
    description: 'Every island country of the Pacific',
    names: [
      'Fiji', 'Kiribati', 'Marshall Islands', 'Micronesia', 'Nauru', 'Palau', 'Papua New Guinea', 'Samoa',
      'Solomon Islands', 'Tonga', 'Tuvalu', 'Vanuatu',
    ],
  },
  {
    id: 'north-america',
    title: "North America's big three",
    description: 'Canada, the United States and Mexico',
    names: ['Canada', 'Mexico', 'United States'],
  },
  {
    id: 'g7',
    title: 'The G7',
    description: 'Canada, France, Germany, Italy, Japan, the UK and the US',
    names: ['Canada', 'France', 'Germany', 'Italy', 'Japan', 'United Kingdom', 'United States'],
  },
]

/** States and provinces of a country visited */
const statesOf = (alpha2: string) => {
  const ids = regionIdsOf(alpha2)
  return { need: ids.length, have: (atlas: Atlas) => ids.filter((id) => atlas.regions.has(id)).length }
}

const islands = allCountries.filter((c) => c.properties.island).map((c) => c.properties.name)
const smallIslands = allCountries.filter((c) => c.properties.island && c.properties.areaKm2 < 30_000).map((c) => c.properties.name)

const km = new Intl.NumberFormat('en-US')
const formatKm = (n: number) => `${km.format(Math.round(n))} km`
const totalKm = (atlas: Atlas) => atlas.flights.reduce((sum, f) => sum + f.km, 0)
const mostVisits = (atlas: Atlas) => Math.max(0, ...[...atlas.visited].map(atlas.visitsTo))

/** The countries a trip went to, a territory as the country it belongs to */
const countriesOnTrip = (trip: Trip) => {
  const been = beenTo(new Set(trip.places))
  return allCountries.filter((c) => been.has(c.properties.name)).length
}
/** The continents a trip went to */
const continentsOnTrip = (trip: Trip) =>
  new Set(trip.places.flatMap((name) => findCountryByName(name)?.properties.continent ?? []))
/**
 * How far round the Earth a trip's flights went, east or west, in degrees:
 * each flight the short way, so out and back again is none, and once round is 360
 */
const roundTheEarth = (trip: Trip) =>
  Math.abs(trip.flights.reduce((sum, { from, to }) => sum + ((((to.lng - from.lng) % 360) + 540) % 360) - 180, 0))

/** Every achievement, in the order shown */
export const ACHIEVEMENTS: Achievement[] = [
  milestone(1, 'First stamp', 'Your first country'),
  milestone(10, 'Explorer'),
  milestone(25, 'Globetrotter'),
  milestone(50, 'Seasoned traveller'),
  milestone(100, 'Centurion'),
  milestone(150, 'Almost everywhere'),
  milestone(allCountries.length, 'Every country', `All ${allCountries.length} countries`),

  atLeast('every-continent', 'Continents', 'Every continent', 'A country on each of the six continents with countries', LIVED_ON.length, (atlas) => {
    const been = beenTo(atlas.visited)
    return LIVED_ON.filter((c) => countriesIn(c).some((country) => been.has(country.properties.name))).length
  }),
  ...LIVED_ON.map((continent) =>
    allOf(
      `all-${continent.toLowerCase().replace(/ /g, '-')}`,
      'Continents',
      continentTitle[continent],
      `Every country in ${continent}`,
      countriesIn(continent).map((c) => c.properties.name),
    ),
  ),
  allOf('antarctica', 'Continents', 'The seventh continent', 'Antarctica', ['Antarctica']),
  atLeast('hemispheres', 'Continents', 'All four hemispheres', 'North and south of the equator, east and west of Greenwich', 4, (atlas) => {
    const centers = visitedCountries(atlas).map((c) => c.properties.centroid)
    return [
      centers.some(([, lat]) => lat > 0),
      centers.some(([, lat]) => lat < 0),
      centers.some(([lng]) => lng > 0),
      centers.some(([lng]) => lng < 0),
    ].filter(Boolean).length
  }),

  ...REGIONS.map(({ id, title, description, names }) => allOf(id, 'Regions', title, description, names)),

  atLeast('islands-10', 'Islands', 'Island hopper', '10 island countries', 10, (atlas) => count(atlas, islands)),
  atLeast('small-islands-5', 'Islands', 'Specks in the ocean', '5 island countries smaller than 30,000 km²', 5, (atlas) =>
    count(atlas, smallIslands),
  ),

  atLeast('us-states-10', 'States', 'Road trip', '10 US states', 10, statesOf('US').have),
  { id: 'us-states', group: 'States', title: 'All 50 states', description: 'Every US state, and D.C.', ...statesOf('US') },
  { id: 'canada', group: 'States', title: 'Coast to coast to coast', description: 'Every Canadian province and territory', ...statesOf('CA') },
  { id: 'australia', group: 'States', title: 'All of Australia', description: 'Every Australian state and territory', ...statesOf('AU') },
  { id: 'brazil', group: 'States', title: 'All of Brazil', description: 'Every Brazilian state', ...statesOf('BR') },

  atLeast('cities-10', 'Cities', 'City breaks', '10 cities', 10, (atlas) => atlas.cities.length),
  atLeast('cities-50', 'Cities', 'City collector', '50 cities', 50, (atlas) => atlas.cities.length),
  atLeast('cities-100', 'Cities', 'Metropolitan', '100 cities', 100, (atlas) => atlas.cities.length),
  atLeast('capitals-10', 'Cities', 'Capital collector', '10 capital cities', 10, (atlas) => atlas.cities.filter((c) => c.capital).length),

  atLeast('flights-1', 'Flights', 'Wheels up', 'Your first flight', 1, (atlas) => atlas.flights.length),
  atLeast('flights-10', 'Flights', 'Frequent flyer', '10 flights', 10, (atlas) => atlas.flights.length),
  atLeast('flights-50', 'Flights', 'Jet set', '50 flights', 50, (atlas) => atlas.flights.length),
  atLeast('around-the-world', 'Flights', 'Around the world', 'Flown once around the Earth', 40_075, totalKm, formatKm),
  atLeast('to-the-moon', 'Flights', 'To the Moon', 'Flown as far as the Moon', 384_400, totalKm, formatKm),
  atLeast('long-haul', 'Flights', 'Long haul', 'A flight over 10,000 km', 1, (atlas) => atlas.flights.filter((f) => f.km > 10_000).length),
  atLeast('ultra-long-haul', 'Flights', 'Ultra long haul', 'A flight over 15,000 km', 1, (atlas) =>
    atlas.flights.filter((f) => f.km > 15_000).length,
  ),

  atLeast('trips-10', 'Trips', 'Off again', '10 trips', 10, (atlas) => atlas.trips.length),
  atLeast('trip-countries-5', 'Trips', 'Grand tour', '5 countries in one trip', 5, (atlas) =>
    Math.max(0, ...atlas.trips.map(countriesOnTrip)),
  ),
  atLeast('trip-every-continent', 'Trips', 'A trip to every continent', 'A trip to each of the six continents with countries', LIVED_ON.length, (atlas) => {
    const reached = new Set(atlas.trips.flatMap((trip) => [...continentsOnTrip(trip)]))
    return LIVED_ON.filter((continent) => reached.has(continent)).length
  }),
  atLeast('round-the-world', 'Trips', 'Round the world', 'One trip all the way round the Earth', 360, (atlas) =>
    Math.round(Math.max(0, ...atlas.trips.map(roundTheEarth))),
    (n) => `${n}°`,
  ),

  atLeast('visits-3', 'Return trips', 'Coming back', '3 visits to one country', 3, mostVisits),
  atLeast('visits-5', 'Return trips', 'Second home', '5 visits to one country', 5, mostVisits),
]

export type Progress = { have: number; need: number; done: boolean }

/** How far along an achievement is: what you have counts up to what it takes */
export function progressOf(achievement: Achievement, atlas: Atlas): Progress {
  const have = Math.min(achievement.have(atlas), achievement.need)
  return { have, need: achievement.need, done: have >= achievement.need }
}

/** The achievements earned, by id */
export const earnedIds = (atlas: Atlas) =>
  new Set(ACHIEVEMENTS.filter((a) => progressOf(a, atlas).done).map((a) => a.id))
