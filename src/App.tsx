import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { geoCircle } from 'd3-geo'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { MeshPhongMaterial } from 'three'
import { countries, tinyPlaces, type CountryFeature } from './countries'
import { citiesLabel, citiesOf, countryOfCity, type City } from './data/cities'
import { findRegionAt, hasRegions, regionsLabel, regionsOf, type RegionFeature } from './data/regions'
import CountryPanel from './CountryPanel'
import type { CountryVisit } from './visited/CountryVisits'
import ExplorePanel from './explore/ExplorePanel'
import { useSettings } from './explore/useSettings'
import GamesPanel from './games/GamesPanel'
import { GAMES, currentRound, type Difficulty, type GameChoice, type RoundGameId } from './games/games'
import type { Scope } from './games/allGame'
import {
  LETTER_HUNT_RINGS,
  flightTarget,
  gameHighlights,
  gameRings,
  globeAnswers,
  isPlaying,
  overviewKey,
  showsGame,
} from './games/globeView'
import { useGame } from './games/useGame'
import { currentCity, spotOnKm, type CityLevel } from './games/cityGame'
import { currentNeighbours, type NeighboursLevel } from './games/neighboursGame'
import type { Measure } from './games/higherLower'
import { useTheme } from './design/useTheme'
import FlagCorner from './FlagCorner'
import Tabs from './nav/Tabs'
import TopBar from './nav/TopBar'
import ViewCenter from './nav/ViewCenter'
import { VIEWS, type ViewId } from './nav/views'
import SidePanel from './nav/SidePanel'
import Card from './ui/Card'
import { isScreensaver } from './screensaver'
import PreviewExit from './design/PreviewExit'
import MorePanel, { type MoreId } from './more/MorePanel'
import VisitedPanel from './visited/VisitedPanel'
import { useVisited } from './visited/useVisited'
import { useVisitedRegions } from './visited/useVisitedRegions'
import { useVisitedCities } from './visited/useVisitedCities'
import { useVisitDates } from './visited/useVisitDates'
import { useWishlist } from './visited/useWishlist'
import { useFriend } from './visited/useFriend'
import { comparisonOf, type Friend } from './visited/friend'
import CompareView from './visited/CompareView'
import { ACHIEVEMENTS, earnedIds, type Atlas } from './visited/achievements'
import AchievementsPanel from './visited/AchievementsPanel'
import AchievementToast from './visited/AchievementToast'
import GlobeKey from './ui/GlobeKey'
import { useNewAchievements } from './visited/useNewAchievements'
import { describeVisits, newestFirst, type VisitDate } from './data/visitDates'
import { cityOf, countryOf } from './data/airports'
import { FOLLOW_LEAD_IN, FOLLOW_STOP, followLandings, followSeconds } from './globe/follow'
import FollowBar from './ui/FollowBar'
import ReplayBar from './ui/ReplayBar'
import { replayOf, replayedBy } from './data/replay'
import UndoToast from './ui/UndoToast'
import UpdateToast from './pwa/UpdateToast'
import { useUpdateReady } from './pwa/useUpdateReady'
import { applyUpdate } from './pwa/update'
import { useUndo } from './ui/useUndo'
import { useFlights } from './visited/useFlights'
import { useTripNames } from './visited/useTripNames'
import { usePlans, useToday } from './visited/usePlans'
import { isToCome } from './data/plans'
import TripsPanel, { type TripActions } from './visited/TripsPanel'
import { useTrips, newId } from './visited/useTrips'
import VisitedTab, { type VisitedView } from './visited/VisitedTab'
import YearsPanel from './visited/YearsPanel'
import WrappedView from './visited/WrappedView'
import { reviewOf, spotsOf, spotsOfStep, timelineOf, yearsOf, type YearReview } from './visited/yearInReview'
import { useTimeLapse } from './visited/useTimeLapse'
import { EARTH_KM, distanceKm, routeOf, uniqueRoutes, type Route } from './data/flights'
import {
  journeysOf,
  looseOf,
  placeFor,
  titleOf,
  tripViewsOf,
  tripsFromFlights,
  joinTrips,
  tripsOfVisits,
  visitItem,
  visitsOf,
  visitsOfPlans,
  type TripItem,
  type Visit,
} from './data/savedTrips'
import { regionFills, regionOutlines, regionProgress } from './visited/regionsView'
import Tooltip from './Tooltip'
import {
  stopGlide,
  useAirports,
  useCities,
  useCountryLayer,
  useFlightLayer,
  useImagery,
  useCountryPointer,
  useDepthPrecision,
  useNightLayer,
  usePinLayer,
  usePlanLayer,
  useRegionLayer,
  useRegions,
  useSelectedCountry,
  useSmoothAutoRotate,
} from './globe/hooks'
import { PIN_FADE, SCREENSAVER_PIN_FADE, pinAt } from './globe/pinLayer'
import { NIGHT_DARKNESS, PICTURE_DARKNESS } from './globe/nightLayer'
import { useNightLights } from './globe/nightLights'
import { heatColors, hoveredRegionColor, revisitColor, visitedRegionColor } from './globe/themes'
import type { LatLng, Point, Spot } from './globe/interaction'
import {
  INITIAL_VIEW,
  SCREENSAVER_VIEW,
  fitAltitude,
  flightAltitude,
  flightDuration,
  spotsOfRoute,
  viewOf,
} from './globe/interaction'
import { countryColor } from './globe/colors'

const RENDERER_CONFIG = { antialias: true, alpha: true, powerPreference: 'high-performance' } as const

const NO_VISITS: ReadonlySet<string> = new Set()
const NO_DATES: readonly VisitDate[] = []

/** A circle `km` around a place, as an area to outline */
const areaAround = ({ lat, lng }: { lat: number; lng: number }, km: number) => ({
  geometry: geoCircle()
    .center([lng, lat])
    .radius((km / EARTH_KM) * (180 / Math.PI))() as GeoJSON.Polygon,
})

/** What to keep in view to see places, by name, each as wide as it is */
const spotsOfPlaces = (names: readonly string[]): Spot[] =>
  countries
    .filter((c) => names.includes(c.properties.name))
    .map(({ properties: { centroid, extent } }) => ({ lng: centroid[0], lat: centroid[1], radius: extent / 2 }))
/** How much the land's height shows in a picture of the Earth */
const RELIEF = 40
const NO_FLIGHTS = { lines: [], journeys: [] }
/** How long the last landing shows before the whole trip, and the panel, come back */
const FOLLOW_END = 1.5


/** Phones show one panel at a time, as a sheet over the globe */
const PHONE = '(max-width: 640px)'
const isPhone = () => !!window.matchMedia?.(PHONE).matches
const NO_RINGS: readonly CountryFeature[] = []
const NO_LIGHTS: readonly City[] = []

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

/** `compareOnOpen`: a friend's link was opened, so show the comparison */
export default function App({ compareOnOpen = false }: { compareOnOpen?: boolean } = {}) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const [globe, setGlobe] = useState<GlobeMethods | null>(null)
  const [hovered, setHovered] = useState<CountryFeature | null>(null)
  const [selected, setSelected] = useState<CountryFeature | null>(null)
  const [screensaver] = useState(() => isScreensaver())
  /** The screensaver shown in the app, from Settings, to have a look: only the globe, until left */
  const [previewing, setPreviewing] = useState(false)
  // Big screens start with Explore open; phones with just the globe
  // Always a tab open: Explore, its buttons in a corner, when no other is
  const [view, setView] = useState<ViewId>(compareOnOpen ? 'more' : 'explore')
  /** The kind of games listed in the Games tab, or the game whose setup is open */
  const [chosenGame, setChosenGame] = useState<GameChoice | null>(null)
  /** What's opened in the More tab, kept while the screensaver is previewed from it */
  const [moreOpen, setMoreOpen] = useState<MoreId | null>(compareOnOpen ? 'compare' : null)
  // Places marked visited, by hand
  const { visited: marked, add: addVisited, remove: removeVisited } = useVisited()
  const {
    trips: savedTrips,
    create: createTrip,
    rename: renameTrip,
    remove: removeTrip,
    add: addToTrip,
    takeOut: takeOutOfTrip,
    move: moveInTrip,
    redate: redateInTrips,
    start: startTrips,
    replaceAll: replaceTrips,
  } = useTrips()
  const today = useToday()
  // Visits are in trips: those been on (or with no date), and those to come
  const [pastVisits, visitsToCome] = useMemo(() => {
    const now = new Date(`${today}T12:00`)
    const all = (savedTrips ?? []).flatMap((trip) => trip.items.flatMap((item) => (item.kind === 'visit' ? [item] : [])))
    return [all.filter((visit) => !visit.date || !isToCome(visit.date, now)), all.filter((visit) => visit.date && isToCome(visit.date, now))]
  }, [savedTrips, today])
  // Your atlas: the places marked visited, and those a trip has been to
  const visited = useMemo(() => new Set([...marked, ...pastVisits.map((visit) => visit.place)]), [marked, pastVisits])
  /** Places a trip has been to, which stay visited while it has */
  const inTrips = useMemo(() => new Set(pastVisits.map((visit) => visit.place)), [pastVisits])
  // When each place was visited, newest first, from the trips
  const datesByPlace = useMemo(() => {
    const dates = new Map<string, Set<VisitDate>>()
    for (const { place, date } of pastVisits) if (date) dates.set(place, (dates.get(place) ?? new Set()).add(date))
    return new Map([...dates].map(([place, all]) => [place, [...all].sort(newestFirst)]))
  }, [pastVisits])
  const datesOf = useCallback((name: string): readonly VisitDate[] => datesByPlace.get(name) ?? NO_DATES, [datesByPlace])
  const { wishlist: wished, add: addWish, remove: removeWish } = useWishlist()
  // A friend to compare with, shown on the globe until switched off (at once, when their link was opened)
  const [friend, setFriend] = useFriend()
  const [friendShown, setFriendShown] = useState(compareOnOpen)
  const comparison = useMemo(() => (friend ? comparisonOf(visited, friend) : null), [friend, visited])
  // Going somewhere takes it off the wishlist; a place still on it from before (a backup) isn't shown there
  const wishlist = useMemo(() => new Set([...wished].filter((name) => !visited.has(name))), [wished, visited])
  const addPlace = useCallback(
    (name: string) => {
      addVisited(name)
      removeWish(name)
    },
    [addVisited, removeWish],
  )
  // The last thing removed, with a note to undo it for a few seconds
  const { removal, offerUndo, clearRemoval } = useUndo()
  // A new version of the app, downloaded while it's open, to reload into
  const [update, dismissUpdate] = useUpdateReady()
  const removePlace = useCallback(
    (name: string) => {
      removeVisited(name)
      offerUndo(`Removed ${name}`, () => addVisited(name))
    },
    [removeVisited, addVisited, offerUndo],
  )
  const unwish = useCallback(
    (name: string) => {
      removeWish(name)
      offerUndo(`Took ${name} off your wishlist`, () => addWish(name))
    },
    [removeWish, addWish, offerUndo],
  )
  const changeFriend = (next: Friend | null) => {
    if (!next && friend) {
      const gone = friend
      offerUndo(`Removed ${gone.name}`, () => setFriend(gone))
    }
    setFriend(next)
  }
  const {
    game,
    best,
    previousBest,
    bestTimes,
    previousTime,
    daily,
    startDaily,
    start: startGame,
    startLetter,
    startAll,
    startHigher,
    startCity,
    startNeighbours,
    startBigger,
    pick,
    pickCity,
    guessAt,
    guessHigher,
    giveUpRound,
    advance,
    stop,
    quit: quitGame,
  } = useGame()
  const playing = isPlaying(game)
  const globeIsAnswer = globeAnswers(game)
  const { width, height } = useWindowSize()
  const [theme, setTheme] = useTheme()
  const [settings, changeSettings] = useSettings()
  const regions = useRegions()
  const { visitedRegions, toggle: toggleRegionId, add: addRegionId } = useVisitedRegions()
  const [hoveredRegion, setHoveredRegion] = useState<RegionFeature | null>(null)
  const cities = useCities()
  const { visitedCities, toggle: toggleCityId, add: addCityId } = useVisitedCities()
  // Notes on visits; and the dates saved before visits were made in trips, which go into trips (see below)
  const { datesOf: datesBefore, noteOf, setNote, clearDates: clearDatesBefore } = useVisitDates()
  const [hoveredCity, setHoveredCity] = useState<City | null>(null)
  const airports = useAirports()
  const { flights, add: addFlight, remove: removeFlight, setDate: setFlightDate } = useFlights(cities, airports)
  // Names trips had before trips were made by hand: they go with them, the first time
  const { nameOf: tripNameOf } = useTripNames()
  // Visits planned before trips to come could be made: they become trips (see below)
  const { plans: plansBefore, clear: clearPlansBefore } = usePlans()
  // A friend's link opened: their comparison
  const [visitedView, setVisitedView] = useState<VisitedView>('countries')
  /** A flight or trip picked in the list, shown on the globe (and highlighted) until the view moves on */
  const [shownRoutes, setShownRoutes] = useState<Route[] | null>(null)

  // The sea in the design's color, or a picture of the Earth (once loaded), its sea shining
  const imagery = useImagery(theme.imagery)
  const globeMaterial = useMemo(
    () =>
      imagery
        ? new MeshPhongMaterial({
            map: imagery.map,
            specularMap: imagery.water,
            specular: '#4a5a6a',
            shininess: theme.oceanShininess,
            // Mountains catch the light, and cast shade
            bumpMap: imagery.relief,
            bumpScale: RELIEF,
          })
        : new MeshPhongMaterial({ color: theme.ocean, shininess: theme.oceanShininess }),
    [theme, imagery],
  )
  useEffect(() => () => globeMaterial.dispose(), [globeMaterial])

  /** Keeps the user's zoom by default; `fit` zooms to the country's size instead. */
  const flyTo = useCallback(
    (country: CountryFeature, { fit = false } = {}) => {
      if (!globe) return
      const from = globe.pointOfView()
      const [lng, lat] = country.properties.centroid
      const altitude = fit ? fitAltitude(country.properties.extent) : flightAltitude(from.altitude)
      stopGlide(globe)
      globe.pointOfView({ lat, lng, altitude }, flightDuration(from, { lat, lng }))
    },
    [globe],
  )

  const selectCountry = useCallback(
    (country: CountryFeature | null) => {
      setSelected(country)
      setShownRoutes(null)
      if (country) flyTo(country)
    },
    [flyTo],
  )

  const airportByCode = useMemo(() => new Map((airports ?? []).map((a) => [a.code, a])), [airports])
  const allRoutes = useMemo(
    () => flights.flatMap((flight) => routeOf(flight, airportByCode) ?? []),
    [flights, airportByCode],
  )
  // Flights flown, which count, and those booked, still to come: they count once their month comes
  const [routes, upcomingRoutes] = useMemo(() => {
    const now = new Date(`${today}T12:00`)
    const toCome = (route: Route) => !!route.flight.date && isToCome(route.flight.date, now)
    return [allRoutes.filter((route) => !toCome(route)), allRoutes.filter(toCome)]
  }, [allRoutes, today])
  /** When a visit was, changed in a trip: its note goes with it, and a visit that's been puts the place in your atlas */
  const changeVisitDate = (place: string, from: VisitDate | null, to: VisitDate | null) => {
    if (from === to) return
    const note = from ? noteOf(place, from) : undefined
    if (note && from) setNote(place, from, '')
    if (note && to) setNote(place, to, note)
    redateInTrips(place, from, to)
    if (to && !isToCome(to)) addPlace(place)
  }

  // The trips as they stand, and what's in none yet
  const tripViews = useMemo(() => tripViewsOf(savedTrips ?? [], allRoutes), [savedTrips, allRoutes])
  const looseTravels = useMemo(() => looseOf(tripViews, marked, allRoutes), [tripViews, marked, allRoutes])
  // What there was before visits were only made in trips goes into trips, once the airports have loaded: the first
  // time, trips worked out from the flights; and dated visits in none, a trip a month, and plans, trips to come
  useEffect(() => {
    if (!airports) return
    const before = visitsOf(marked, datesBefore)
    const datedBefore = before.some((visit) => visit.date)
    const planned = Object.keys(plansBefore).length > 0
    if (savedTrips !== null && !datedBefore && !planned) return
    const made = savedTrips ?? tripsFromFlights(allRoutes, before, tripNameOf, newId)
    // Each into a trip whose flight lands there then, or else a trip a month (a plan, one of its own)
    const plannedVisits = visitsOfPlans(plansBefore)
    const { trips: joined, rest } = joinTrips(made, [...before.filter((visit) => visit.date), ...plannedVisits], allRoutes)
    const isPlanned = (visit: Visit) => plannedVisits.includes(visit)
    const all = [
      ...joined,
      ...tripsOfVisits(joined, rest.filter((visit) => !isPlanned(visit)), newId),
      ...rest.filter(isPlanned).map((visit) => ({ id: newId(), name: '', items: [visitItem(visit)] })),
    ]
    if (savedTrips === null) startTrips(all)
    else replaceTrips(all)
    if (datedBefore) clearDatesBefore()
    if (planned) clearPlansBefore()
  }, [airports, marked, datesBefore, plansBefore, savedTrips, allRoutes, tripNameOf, startTrips, replaceTrips, clearDatesBefore, clearPlansBefore])
  // The selected place's visits, each in its trip: to come first, then newest first, without a date last
  const selectedVisits = useMemo((): CountryVisit[] => {
    if (!selected) return []
    const now = new Date(`${today}T12:00`)
    const name = selected.properties.name
    return tripViews
      .flatMap((trip) =>
        trip.items.flatMap((item) =>
          item.kind === 'visit' && item.place === name ? [{ date: item.date, trip, toCome: !!item.date && isToCome(item.date, now) }] : [],
        ),
      )
      .sort((a, b) => (a.date && b.date ? newestFirst(a.date, b.date) : a.date ? -1 : b.date ? 1 : 0))
  }, [selected, tripViews, today])
  /** The trip open in the Trips list */
  const [openTripId, setOpenTripId] = useState<string | null>(null)
  /** Opens a trip in the Trips list, from a place's visits */
  const openTrip = (id: string) => {
    selectCountry(null)
    setVisitedView('trips')
    setOpenTripId(id)
    changeView('visited')
  }
  /** The trip a flight is in */
  const tripOfFlight = (id: string) => tripViews.find((view) => view.routes.some((route) => route.flight.id === id)) ?? null
  // A trip picked in the list, or one of its flights, says what it's called on the globe
  const pickedTrip = shownRoutes?.length ? (tripOfFlight(shownRoutes[0].flight.id)?.trip ?? null) : null
  const removeFlightById = (id: string) => {
    if (shownRoutes?.some((route) => route.flight.id === id)) setShownRoutes(null)
    const route = allRoutes.find((r) => r.flight.id === id)
    const undo = removeFlight(id)
    offerUndo(route ? `Removed the flight from ${cityOf(route.from)} to ${cityOf(route.to)}` : 'Removed the flight', undo)
  }

  // What achievements are earned from, and the ones just earned
  const visitedCityList = useMemo(() => (cities ?? []).filter((c) => visitedCities.has(c.id)), [cities, visitedCities])
  // Each trip been on: where it went, and the flights flown, in order (not those to come, nor trips with nothing yet)
  const tripsTaken = useMemo(() => {
    const now = new Date(`${today}T12:00`)
    const been = (date: VisitDate | null | undefined) => !date || !isToCome(date, now)
    return tripViews
      .map((view) => ({
        places: view.items.flatMap((item) => (item.kind === 'visit' && been(item.date) ? [item.place] : [])),
        flights: view.routes.filter((route) => been(route.flight.date)),
      }))
      .filter((trip) => trip.places.length > 0 || trip.flights.length > 0)
  }, [tripViews, today])
  const atlas = useMemo<Atlas>(
    () => ({
      visited,
      regions: visitedRegions,
      cities: visitedCityList,
      flights: routes,
      visitsTo: (name) => datesOf(name).length,
      trips: tripsTaken,
    }),
    [visited, visitedRegions, visitedCityList, routes, datesOf, tripsTaken],
  )
  const [newAchievements, clearAchievements] = useNewAchievements(atlas, !!cities && !!airports)

  // The years with dates, and the one picked in the Visited tab (the newest, until another is)
  const years = useMemo(() => yearsOf({ visited, datesOf, routes }), [visited, datesOf, routes])
  const [pickedYear, setPickedYear] = useState<number | null>(null)
  const reviewYear = pickedYear !== null && years.includes(pickedYear) ? pickedYear : (years[0] ?? null)
  const review = useMemo(
    () => (reviewYear === null ? null : reviewOf(reviewYear, { visited, datesOf, routes })),
    [reviewYear, visited, datesOf, routes],
  )

  /** Flies to see places whole, from above their middle */
  const flyToSee = useCallback(
    (spots: Spot[]) => {
      if (!globe || spots.length === 0) return
      const { lat, lng, extent } = viewOf(spots)
      const from = globe.pointOfView()
      stopGlide(globe)
      globe.pointOfView({ lat, lng, altitude: fitAltitude(extent) }, flightDuration(from, { lat, lng }))
    },
    [globe],
  )

  /** Flies to show a flight's or a trip's whole route */
  const showRoutes = useCallback(
    (picked: Route[]) => {
      selectCountry(null)
      setShownRoutes(picked)
      flyToSee(picked.flatMap(spotsOfRoute))
      if (isPhone()) setView('explore')
    },
    [flyToSee, selectCountry],
  )
  /** Flies to see a trip's places, for one without flights */
  const showPlaces = (items: readonly TripItem[]) => {
    selectCountry(null)
    flyToSee(spotsOfPlaces(items.flatMap((item) => (item.kind === 'visit' ? [item.place] : []))))
    if (isPhone()) setView('explore')
  }
  /** What can be done in the Trips list */
  const tripActions: TripActions = {
    create: createTrip,
    rename: renameTrip,
    remove: (id) => {
      const view = tripViews.find((v) => v.trip.id === id)
      offerUndo(`Removed the trip ${view ? titleOf(view) : ''}`.trim(), removeTrip(id))
    },
    add: addToTrip,
    takeOut: takeOutOfTrip,
    move: moveInTrip,
    addPlace: (id, place, date, index) => {
      // Been: in your atlas. To come: a trip you're going on
      if (!date || !isToCome(date)) addPlace(place)
      addToTrip(id, { kind: 'visit', place, date }, index)
    },
    addFlight: (id, from, to, date, items) => {
      const flight = addFlight(from.code, to.code, date)
      if (!flight) return
      const item = { kind: 'flight' as const, flight }
      const route = { flight: { id: flight, from: from.code, to: to.code, ...(date ? { date } : {}) }, from, to, km: distanceKm(from, to) }
      addToTrip(id, item, placeFor(item, items, [...allRoutes, route]))
    },
    redateVisit: changeVisitDate,
    redateFlight: setFlightDate,
    removeFlight: removeFlightById,
  }
  /** Turns the globe to a year's places and flights, as it shows just them */
  const showYear = (year: YearReview | null) => year && flyToSee(spotsOf(year))

  // A year wrapped: its card full screen, to keep or share
  const [wrapping, setWrapping] = useState(false)

  // Following a trip: its plane flies its flights once, from when it starts (on the planes' clock), and the globe turns
  // to each flight in turn. On phones the panel makes way for it, and comes back at the end (`reopen`)
  const [following, setFollowing] = useState<{ legs: Route[]; startedAt: number; reopen: boolean } | null>(null)
  /** The flight being followed */
  const [followLeg, setFollowLeg] = useState(0)
  const followTrip = useCallback(
    (legs: Route[]) => {
      selectCountry(null)
      setShownRoutes(legs)
      setFollowLeg(0)
      setFollowing({ legs, startedAt: performance.now() / 1000, reopen: isPhone() })
      if (isPhone()) setView('explore')
    },
    [selectCountry],
  )
  /** At the end of the trip, or with Stop: the Trips list again, if it made way */
  const finishFollowing = useCallback(() => {
    if (following?.reopen) setView('visited')
    setFollowing(null)
  }, [following])
  useEffect(() => {
    if (!following) return
    const { legs } = following
    flyToSee(spotsOfRoute(legs[0]))
    // As each flight lands, the globe turns to the next as the plane flies on, and at the end to the whole trip
    const landings = followLandings(legs.map(followSeconds))
    const timers = landings.map((lands, i) =>
      setTimeout(() => {
        if (i + 1 < legs.length) {
          setFollowLeg(i + 1)
          flyToSee(spotsOfRoute(legs[i + 1]))
        } else {
          flyToSee(legs.flatMap(spotsOfRoute))
        }
      }, lands * 1000),
    )
    const done = setTimeout(finishFollowing, (landings.at(-1)! + FOLLOW_END) * 1000)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
    }
  }, [following, flyToSee, finishFollowing])

  // Replaying your trips, from the Trips list: every trip been on, oldest first, its flights flown and its places colored
  // as they're reached, staying colored. On phones the panel makes way, and comes back at the end (`reopen`)
  const [replay, setReplay] = useState<(ReturnType<typeof replayOf> & { startedAt: number; reopen: boolean }) | null>(null)
  /** The step of the replay begun last */
  const [replayAt, setReplayAt] = useState(-1)
  const canReplay = useMemo(() => replayOf(tripViews).steps.length > 0, [tripViews])
  const startReplay = () => {
    selectCountry(null)
    setShownRoutes(null)
    setFollowing(null)
    setReplayAt(-1)
    setReplay({ ...replayOf(tripViews), startedAt: performance.now() / 1000, reopen: isPhone() })
    if (isPhone()) setView('explore')
  }
  const finishReplay = useCallback(() => {
    if (replay?.reopen) setView('visited')
    setReplay(null)
  }, [replay])
  useEffect(() => {
    if (!replay) return
    const timers = replay.steps.map((step, i) =>
      setTimeout(() => {
        setReplayAt(i)
        // The globe turns to each flight, and to each place not just landed in
        const before = replay.steps[i - 1]
        if (step.kind === 'flight') flyToSee(spotsOfRoute(step.route))
        else if (before?.kind !== 'flight' || countryOf(before.route.to) !== step.place) flyToSee(spotsOfPlaces([step.place]))
      }, step.at * 1000),
    )
    // A moment on the last, then everything again
    timers.push(setTimeout(finishReplay, (replay.seconds + 1.5) * 1000))
    return () => timers.forEach(clearTimeout)
  }, [replay, flyToSee, finishReplay])
  const replayed = useMemo(() => (replay ? replayedBy(replay.steps, replayAt) : null), [replay, replayAt])

  // A selected country with states isn't raised: it stays flat so its states can be picked on the globe
  const editing = !playing && selected && hasRegions(selected) ? selected : null
  const editingRegions = useMemo(() => (editing && regions ? regionsOf(regions, editing) : []), [editing, regions])

  const selectedCities = useMemo(() => (selected && cities ? citiesOf(cities, selected) : []), [selected, cities])

  // While a year is open in the Visited tab, the globe shows just that year: its places and flights, which have
  // dates (states and cities don't)
  const yearsOpen = view === 'visited' && visitedView === 'years' && !showsGame(game)
  const yearShown = yearsOpen ? review : null

  // The time-lapse plays through the years in the Years view: all you'd been to by each, the new places in green
  const timeline = useMemo(() => timelineOf({ visited, datesOf, routes }), [visited, datesOf, routes])
  const { lapse, play: playLapse, pause: pauseLapse, stop: stopLapse } = useTimeLapse(timeline.length)
  const lapseStep = yearsOpen && lapse ? timeline[lapse.step] : null
  // Leaving the years ends it
  useEffect(() => {
    if (!yearsOpen) stopLapse()
  }, [yearsOpen, stopLapse])
  useEffect(() => {
    if (lapseStep) flyToSee(spotsOfStep(lapseStep))
  }, [lapseStep, flyToSee])

  const highlights = useMemo(() => {
    const colors = gameHighlights(game, theme)
    // Replaying, the places of the trip it's on stand out over those before
    if (replayed) {
      return new Map([
        ...colors,
        ...countries.filter((c) => replayed.thisTrip.has(c.properties.name)).map((c) => [c, theme.correct] as const),
      ])
    }
    // In the time-lapse, the year's places stand out over those before: new ones brighter than those visited again
    if (lapseStep) {
      return new Map([
        ...colors,
        ...lapseStep.revisits.map((c) => [c, revisitColor(theme)] as const),
        ...lapseStep.newPlaces.map((c) => [c, theme.correct] as const),
      ])
    }
    return editing ? new Map([...colors, [editing, theme.selected]]) : colors
  }, [game, theme, editing, lapseStep, replayed])

  // Games get a clean globe: no visited colors, and hover only where the globe is the answer
  // In games only countries are answers, so territories don't light up
  // Finding a city, countries don't light up: the answer is a point
  const findingCity = globeIsAnswer && game?.kind === 'city'
  const hoverable =
    !!hovered && (!playing || (globeIsAnswer && !findingCity && hovered.properties.kind === 'country'))
  const colorHovered = hoverable ? hovered : null
  const colorVisited = replayed
    ? replayed.places
    : lapseStep
    ? lapseStep.names
    : yearShown
      ? yearShown.names
      : showsGame(game) || !settings.showVisited
        ? NO_VISITS
        : visited
  // While comparing is open in More, the globe shows just countries (your friend has no states, cities or flights), and,
  // switched on, where you've both been and where only they have, over your places. Not in the screensaver's preview:
  // the real one doesn't know your friend
  const compareOpen = view === 'more' && moreOpen === 'compare' && !showsGame(game) && !previewing
  const compareShown = compareOpen && !!comparison && friendShown && colorVisited === visited
  // A year picked in the Years tab: its places first visited then, and those visited again a darker shade, as in the
  // time-lapse
  const yearPicked = lapseStep ? null : yearShown
  const markedColors = useMemo(() => {
    if (compareShown && comparison) {
      return new Map([
        ...comparison.both.map((c) => [c.properties.name, theme.correct] as const),
        ...comparison.onlyFriend.map((c) => [c.properties.name, theme.wishlist] as const),
      ])
    }
    if (yearPicked) {
      return new Map(
        yearPicked.places.map((c) => [c.properties.name, yearPicked.firstVisits.has(c) ? theme.correct : revisitColor(theme)]),
      )
    }
    return undefined
  }, [compareShown, comparison, yearPicked, theme])
  const colorWishlist = yearShown || replay || compareShown || showsGame(game) || !settings.showWishlist ? NO_VISITS : wishlist
  // Places you're going to, tinted and outlined in dashes, on the globe as it is (not a year, a game or a friend's; in the
  // screensaver too), if switched on
  const plansShown = settings.showFutureVisits && !yearShown && !replay && !compareShown && !showsGame(game)
  // The places of trips to come you haven't been to yet
  const plannedNames = useMemo(
    () => new Set(visitsToCome.map((visit) => visit.place).filter((place) => !visited.has(place))),
    [visitsToCome, visited],
  )
  const colorPlanned = plansShown ? plannedNames : NO_VISITS
  const plannedPlaces = useMemo(
    () => (plansShown ? countries.filter((c) => plannedNames.has(c.properties.name)) : []),
    [plansShown, plannedNames],
  )
  usePlanLayer(globe, plannedPlaces, theme.flight)
  // The heat map shades your places by how many times you've been; one marked visited without dates counts once
  const heatShown = colorVisited === visited && settings.showVisitHeat && !compareShown
  const visitsTo = useCallback((name: string) => Math.max(1, datesOf(name).length), [datesOf])
  const colorOf = useCallback(
    (country: CountryFeature) =>
      countryColor(country, {
        theme,
        hovered: colorHovered,
        visited: colorVisited,
        wishlist: colorWishlist,
        planned: colorPlanned,
        visits: heatShown ? visitsTo : undefined,
        marked: markedColors,
        highlights,
      }),
    [theme, colorHovered, colorVisited, colorWishlist, colorPlanned, heatShown, visitsTo, markedColors, highlights],
  )
  // Game answers on tiny islands get a dot, or they'd be invisible
  const gameColors = useMemo(() => gameHighlights(game, theme), [game, theme])
  // Rings around tiny places, if switched on; games ring only countries, and the letter hunt the small islands
  // too, always, in a color that shows over the sea
  const rings = gameRings(game, settings.showMarkers) ?? (settings.showMarkers ? tinyPlaces : NO_RINGS)
  const ringColor = rings === LETTER_HUNT_RINGS ? theme.flight : null
  // Night as it is now; not in games, where it would hide what to find
  const nightShown = settings.showDayNight && !showsGame(game)
  useCountryLayer(globe, theme, colorOf, { rings, ringColor, emphasized: gameColors, night: nightShown })
  useSelectedCountry(globe, editing ? null : selected, theme.selected)

  // A hovered country's visited states turn the hover color with it (only countries with states matter here)
  const hoveredWithRegions = hovered && hasRegions(hovered) ? hovered : null
  const fills = useMemo(
    () =>
      regions && !showsGame(game)
        ? regionFills({
            regions,
            visitedRegions,
            isShownCountry: (c) =>
              !yearShown && !replay && !compareOpen && settings.showRegions && visited.has(c.properties.name),
            editing,
            hovered: hoveredRegion,
            hoveredCountry: hoveredWithRegions,
            color: visitedRegionColor(theme),
            hoverColor: theme.hover,
            hoveredCountryColor: hoveredRegionColor(theme),
          })
        : new Map<RegionFeature, string>(),
    [
      regions,
      game,
      visitedRegions,
      yearShown,
      replay,
      compareOpen,
      settings.showRegions,
      visited,
      editing,
      hoveredRegion,
      hoveredWithRegions,
      theme,
    ],
  )
  const outlines = useMemo(() => (regions ? regionOutlines(regions, fills, editing) : []), [regions, fills, editing])
  useRegionLayer(globe, regions, fills, outlines, theme)

  /** Mark or unmark a state; marking one also marks its country as visited */
  const toggleRegion = useCallback(
    (region: RegionFeature, country: CountryFeature) => {
      if (!visitedRegions.has(region.properties.id) && !visited.has(country.properties.name)) {
        addPlace(country.properties.name)
      }
      toggleRegionId(region.properties.id)
    },
    [visitedRegions, visited, addPlace, toggleRegionId],
  )
  /** Mark or unmark a city; marking one also marks its country, and its state, as visited */
  const toggleCity = useCallback(
    (city: City, country: CountryFeature) => {
      if (!visitedCities.has(city.id)) {
        if (!visited.has(country.properties.name)) addPlace(country.properties.name)
        // The state the city is in, as the city data says; else where its point falls on the map
        const region =
          city.region ??
          (regions && hasRegions(country) ? findRegionAt(regionsOf(regions, country), city.lat, city.lng)?.properties.id : null)
        if (region) addRegionId(region)
      } else {
        offerUndo(`Removed ${city.name}`, () => addCityId(city.id))
      }
      toggleCityId(city.id)
    },
    [visitedCities, visited, addPlace, regions, addRegionId, toggleCityId, addCityId, offerUndo],
  )

  // "Find the city": once guessed, the city and where you clicked
  const cityAnswer = useMemo(
    () => (game?.kind === 'city' && game.guess && !game.finished ? { ...currentCity(game), guess: game.guess } : null),
    [game],
  )

  // "Whose city?": once answered, the city named
  const cityNamed = game?.kind === 'rounds' && !game.finished && game.answer ? (currentRound(game).city ?? null) : null
  // "Bigger city": the two cities
  const cityPair = game?.kind === 'bigger' ? game.pair : null
  // A pin on each visited city, standing on the selected country when it's raised; in "find the city" the answer's,
  // in "whose city?" the city named, and in "bigger city" the two
  const pinned = useMemo(() => {
    if (cityAnswer) return [{ city: cityAnswer.city, lat: cityAnswer.city.lat, lng: cityAnswer.city.lng, raised: false }]
    if (cityNamed) return [{ city: cityNamed, lat: cityNamed.lat, lng: cityNamed.lng, raised: false }]
    if (cityPair) return cityPair.map((city) => ({ city, lat: city.lat, lng: city.lng, raised: false }))
    return cities && settings.showCities && !showsGame(game) && !yearShown && !replay && !compareOpen
      ? cities
          .filter((c) => visitedCities.has(c.id))
          .map((city) => ({ city, lat: city.lat, lng: city.lng, raised: !editing && countryOfCity(city) === selected }))
      : []
  }, [cityAnswer, cityNamed, cityPair, cities, settings.showCities, game, yearShown, replay, compareOpen, visitedCities, editing, selected])
  // Answers in green; in "bigger city" once picked, green or red as the pick was
  const pinColor =
    cityAnswer || cityNamed ? theme.correct : game?.kind === 'bigger' && game.answer ? (game.answer.correct ? theme.correct : theme.wrong) : theme.pin
  usePinLayer(
    globe,
    pinned,
    pinColor,
    screensaver || previewing ? SCREENSAVER_PIN_FADE : PIN_FADE,
  )
  // And how far it reaches: anywhere in there is spot on
  const cityArea = useMemo(() => (cityAnswer ? [areaAround(cityAnswer.city, spotOnKm(cityAnswer.city))] : []), [cityAnswer])
  usePlanLayer(globe, cityArea, theme.correct, 'city-area')
  // Night as it is now, lit by the Earth's lights at night as seen from space; not in games, where it would hide what
  // to find. Should the picture not load (offline before it was kept), each city is a dot of light instead. A picture of
  // the Earth (the Realistic design) has its night as dark as from space, the lights bright on it
  const nightLights = useNightLights(nightShown && settings.showCityLights)
  useNightLayer(
    globe,
    nightShown,
    (nightLights.failed && settings.showCityLights && cities) || NO_LIGHTS,
    nightLights.picture,
    nightLights.picture && theme.imagery ? PICTURE_DARKNESS : NIGHT_DARKNESS,
  )

  // Each route once, and a plane for each trip, flying its flights in order; those picked in the list stand out. In
  // "find the city", a plane flies from where you clicked to the city
  const flightsShown = useMemo(() => {
    if (cityAnswer?.guess.position) {
      const line = { key: `city-${cityAnswer.city.id}`, from: cityAnswer.guess.position, to: cityAnswer.city, highlighted: true }
      return { lines: [line], journeys: [{ key: line.key, legs: [line], highlighted: true }] }
    }
    // Replaying: the flights flown so far, those of the trip it's on standing out, each plane flying once in its turn
    if (replay && replayed) {
      return {
        lines: uniqueRoutes(replayed.flights.map((step) => step.route)).map((route) => ({
          key: route.flight.id,
          from: route.from,
          to: route.to,
          highlighted: replayed.flights.some((step) => step.trip === replayed.trip && uniqueRoutes([route, step.route]).length === 1),
        })),
        journeys: replayed.flights.map((step) => ({
          key: `replay-${step.at}`,
          legs: [step.route],
          highlighted: true,
          timing: { startsAt: replay.startedAt + step.at, seconds: [step.seconds], stop: 0 },
        })),
      }
    }
    // Following a trip: just it, the flight being flown standing out, and its plane flying it once
    if (following) {
      const { legs, startedAt } = following
      return {
        lines: uniqueRoutes(legs).map((route) => ({
          key: route.flight.id,
          from: route.from,
          to: route.to,
          highlighted: uniqueRoutes([route, legs[followLeg]]).length === 1,
        })),
        journeys: [
          {
            key: 'following',
            legs,
            highlighted: true,
            timing: { startsAt: startedAt + FOLLOW_LEAD_IN, seconds: legs.map(followSeconds), stop: FOLLOW_STOP },
          },
        ],
      }
    }
    // The flights taken, and those booked, each if switched on (a year shows its flights all the same)
    const flownShown = !!yearShown || settings.showFlights
    const bookedShown = !lapseStep && !yearShown && settings.showFutureFlights
    if (showsGame(game) || compareOpen || (!flownShown && !bookedShown)) return NO_FLIGHTS
    // In the time-lapse, the flights so far, that year's standing out
    const picked = lapseStep ? lapseStep.newFlights : (shownRoutes ?? [])
    const flown = flownShown ? (lapseStep ? lapseStep.flights : yearShown ? yearShown.flights : routes) : []
    const isPicked = (route: Route) => picked.some((p) => uniqueRoutes([route, p]).length === 1)
    const lines = uniqueRoutes(flown).map((route) => ({
      key: route.flight.id,
      from: route.from,
      to: route.to,
      highlighted: isPicked(route),
    }))
    const journeys = journeysOf(flown, savedTrips ?? []).map((legs) => ({
      key: legs[0].flight.id,
      legs,
      highlighted: legs.some(isPicked),
    }))
    // Flights booked, dashed, on the globe as it is: each route once (dashes there and back would fill each other's
    // gaps), and not over one flown already
    if (lapseStep || yearShown) return { lines, journeys }
    const booked = uniqueRoutes(bookedShown ? upcomingRoutes : []).filter(
      (route) => !flown.some((f) => uniqueRoutes([f, route]).length === 1),
    )
    return {
      lines: [
        ...lines,
        ...booked.map((route) => ({
          key: `upcoming-${route.flight.id}`,
          from: route.from,
          to: route.to,
          highlighted: isPicked(route),
          upcoming: true,
        })),
      ],
      journeys,
    }
  }, [
    cityAnswer,
    following,
    followLeg,
    routes,
    upcomingRoutes,
    lapseStep,
    yearShown,
    compareOpen,
    settings.showFlights,
    settings.showFutureFlights,
    game,
    shownRoutes,
    savedTrips,
    replay,
    replayed,
  ])
  useFlightLayer(globe, flightsShown.lines, flightsShown.journeys, { color: theme.flight, highlight: theme.selected })
  const cityAt = useCallback(
    (point: Point | null) => (globe && point && pinned.length > 0 ? (pinAt(globe, pinned, point)?.city ?? null) : null),
    [globe, pinned],
  )

  const regionAt = useCallback(
    (country: CountryFeature | null, position: LatLng | null) =>
      editing && country === editing && position ? findRegionAt(editingRegions, position.lat, position.lng) : null,
    [editing, editingRegions],
  )
  useDepthPrecision(globe)
  // Not while a year is shown either: it turned to that year's places
  // The preview spins at once, as the real screensaver does
  useSmoothAutoRotate(globe, !selected && !playing && !shownRoutes && !yearShown && !replay, previewing)

  const onGlobeClick = useCallback(
    (country: CountryFeature | null, position: LatLng | null, point: Point) => {
      if (playing) {
        // Finding a city, anywhere counts, the sea too; otherwise it's a country
        if (globeIsAnswer && game?.kind === 'city') {
          if (position) guessAt(position)
        } else if (globeIsAnswer && country) pick(country)
        return
      }
      // A pin stands for its city's country
      const city = cityAt(point)
      if (city) return selectCountry(countryOfCity(city))
      // Clicking a state of the country being edited marks it
      const region = regionAt(country, position)
      if (region && editing) toggleRegion(region, editing)
      else selectCountry(country)
    },
    [playing, globeIsAnswer, game, guessAt, pick, cityAt, regionAt, editing, toggleRegion, selectCountry],
  )
  const onGlobeHover = useCallback(
    (country: CountryFeature | null, position: LatLng | null, point: Point | null) => {
      const city = cityAt(point)
      setHoveredCity(city)
      setHovered(city ? countryOfCity(city) : country)
      setHoveredRegion(city ? null : regionAt(country, position))
    },
    [cityAt, regionAt],
  )
  const pointerHandlers = useCountryPointer(globe, {
    onHover: onGlobeHover,
    onClick: onGlobeClick,
    rings,
  })

  const gameFlight = flightTarget(game)
  useEffect(() => {
    if (gameFlight) flyTo(gameFlight, { fit: true })
  }, [gameFlight, flyTo])
  // Neighbours: each country with its surroundings in view, where its neighbours are
  const neighboursRound = game?.kind === 'neighbours' && !game.finished ? currentNeighbours(game) : null
  useEffect(() => {
    if (!neighboursRound) return
    const { country, neighbours } = neighboursRound
    const spotOf = ({ properties: { centroid } }: CountryFeature) => ({ lng: centroid[0], lat: centroid[1] })
    flyToSee([{ ...spotOf(country), radius: country.properties.extent / 2 }, ...neighbours.map(spotOf)])
  }, [neighboursRound, flyToSee])
  // "Find the city", once guessed: see where you clicked and the city, or the city if you didn't know
  useEffect(() => {
    if (!cityAnswer) return
    const { city, guess } = cityAnswer
    flyToSee(guess.position ? spotsOfRoute({ from: guess.position, to: city }) : [{ lat: city.lat, lng: city.lng, radius: 4 }])
  }, [cityAnswer, flyToSee])
  // "Bigger city": both cities in view, each new pair
  useEffect(() => {
    if (cityPair) flyToSee(spotsOfRoute({ from: cityPair[0], to: cityPair[1] }))
  }, [cityPair, flyToSee])

  // Searching the globe starts from an overview, not zoomed in on the last answer
  const overview = overviewKey(game)
  useEffect(() => {
    if (overview !== null) globe?.pointOfView({ altitude: INITIAL_VIEW.altitude }, 800)
  }, [overview, globe])

  const playGame = (id: RoundGameId, difficulty: Difficulty) => {
    selectCountry(null)
    startGame(id, difficulty)
  }
  const playLetter = (letter: string) => {
    selectCountry(null)
    startLetter(letter)
  }
  const playAll = (scope: Scope) => {
    selectCountry(null)
    startAll(scope)
  }
  const playNeighbours = (level: NeighboursLevel) => {
    selectCountry(null)
    startNeighbours(level)
  }
  const playBigger = () => {
    selectCountry(null)
    void startBigger()
  }
  const playCity = (level: CityLevel) => {
    selectCountry(null)
    void startCity(level)
  }
  const playHigher = (measure: Measure) => {
    selectCountry(null)
    startHigher(measure)
  }
  const playDaily = () => {
    selectCountry(null)
    startDaily()
  }

  // Leaving the Games panel ends the game
  const changeView = (next: ViewId) => {
    setFollowing(null)
    setReplay(null)
    if (view === 'games' && next !== 'games') {
      quitGame()
      setChosenGame(null)
    }
    if (next !== 'more') setMoreOpen(null)
    setView(next)
    if (next === 'visited' && visitedView === 'years' && !showsGame(game)) showYear(review)
  }

  // From a list in the side panel. On phones its sheet would cover the country's, so it makes way, back to Explore
  const showCountry = useCallback(
    (country: CountryFeature) => {
      selectCountry(country)
      if (isPhone()) setView('explore')
    },
    [selectCountry],
  )

  // Escape closes the country panel first, then the side panel
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // The preview's own Escape leaves it, back to the panels as they were
      if (e.key !== 'Escape' || previewing) return
      if (wrapping) setWrapping(false)
      else if (following) setFollowing(null)
      else if (replay) setReplay(null)
      else if (selected) selectCountry(null)
      else if (shownRoutes) setShownRoutes(null)
      else {
        // Back to Explore, which is only buttons in a corner
        quitGame()
        setMoreOpen(null)
        setView('explore')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [wrapping, following, replay, selected, shownRoutes, selectCountry, quitGame, previewing])

  /** The screensaver's preview, from Settings: nothing picked, from the screensaver's view */
  const startPreview = () => {
    selectCountry(null)
    setShownRoutes(null)
    setPreviewing(true)
    globe?.pointOfView(SCREENSAVER_VIEW, 1000)
  }
  // The same function each time, so the preview's Escape listener isn't replaced mid key press
  const leavePreview = useCallback(() => setPreviewing(false), [])


  const globeView = (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      rendererConfig={RENDERER_CONFIG}
      backgroundColor="rgba(0, 0, 0, 0)"
      globeMaterial={globeMaterial}
      atmosphereColor={theme.atmosphere}
      atmosphereAltitude={0.18}
      // Picking happens in useCountryPointer, far cheaper than raycasting every mesh
      enablePointerInteraction={false}
      onGlobeReady={() => {
        globeRef.current?.pointOfView(screensaver ? SCREENSAVER_VIEW : INITIAL_VIEW)
        setGlobe(globeRef.current ?? null)
      }}
    />
  )

  // As a screensaver: just the spinning globe, which the pointer doesn't stop
  if (screensaver) {
    return (
      <div className="app screensaver" style={{ '--scene': theme.background } as CSSProperties}>
        <div className="globe" data-testid="globe" aria-busy={!globe}>
          {globeView}
        </div>
      </div>
    )
  }

  return (
    <div
      // Previewing the screensaver: just the globe, as the screensaver shows it
      // Explore is buttons in a corner, not a sheet: the globe stays where it is
      className={
        previewing ? 'app screensaver' : `app${view !== 'explore' ? ' panel-open' : ''}${selected ? ' country-open' : ''}`
      }
      // The page behind the globe, with a glow drawn in CSS
      style={{ '--scene': theme.background } as CSSProperties}
    >
      <div
        className="globe"
        data-testid="globe"
        aria-busy={!globe}
        style={previewing ? undefined : { cursor: hoverable ? 'pointer' : findingCity ? 'crosshair' : 'grab' }}
        {...(previewing
          ? {}
          : {
              ...pointerHandlers,
              // Taking hold of the globe stops following a trip
              onPointerDown: (e: ReactPointerEvent) => {
                setFollowing(null)
                setReplay(null)
                pointerHandlers.onPointerDown(e)
              },
            })}
      >
        {globeView}
      </div>

      {previewing ? (
        <PreviewExit onExit={leavePreview} />
      ) : (
        <>

      <TopBar
        tabs={<Tabs view={view} onChange={changeView} />}
        status={
          <>
            <ViewCenter globe={globe} />
            <span className="status-dot" aria-hidden="true" />
            <span>{visited.size} visited</span>
          </>
        }
      />

      {/* Along the bottom: how to move the globe, and a key to its colors, beside it or above it when there's no room */}
      <div className="globe-notes">
        <p className="hint" aria-hidden="true">
          <span>drag to spin</span>
          <span>{isPhone() ? 'pinch to zoom' : 'scroll to zoom'}</span>
        </p>
        {replay ? (
          <ReplayBar
            trip={replayed && replayed.trip >= 0 ? replay.trips[replayed.trip] : null}
            index={Math.max(replayed?.trip ?? 0, 0)}
            count={replay.trips.length}
            onStop={() => setReplay(null)}
          />
        ) : following ? (
          <FollowBar
            name={tripOfFlight(following.legs[0].flight.id)?.trip.name.trim() || null}
            leg={following.legs[followLeg]}
            index={followLeg}
            count={following.legs.length}
            onStop={finishFollowing}
          />
        ) : (
          pickedTrip &&
          !playing && (
            <p className="globe-caption">
              {pickedTrip.name.trim() && <strong>{pickedTrip.name}</strong>}
              {pickedTrip.note && <span>{pickedTrip.note}</span>}
            </p>
          )
        )}
        {compareShown && friend && (
          <GlobeKey
            title="Compare"
            items={[
              { label: 'You', color: theme.visited },
              { label: 'Both', color: theme.correct },
              { label: friend.name, color: theme.wishlist },
            ]}
          />
        )}
        {(lapseStep || (yearPicked && yearPicked.places.length > 0)) && (
          <GlobeKey
            title={String((lapseStep ?? yearPicked)!.year)}
            items={[
              { label: 'New', color: theme.correct },
              { label: 'Again', color: revisitColor(theme) },
              // The time-lapse shows the years before too
              ...(lapseStep ? [{ label: 'Earlier', color: theme.visited }] : []),
            ]}
          />
        )}
        {heatShown && (
          <GlobeKey
            title="Visits"
            items={heatColors(theme).map((color, i, all) => ({ label: i === all.length - 1 ? `${i + 1}+` : String(i + 1), color }))}
          />
        )}
      </div>

      {view === 'explore' && (
        <ExplorePanel
          settings={settings}
          onChange={changeSettings}
          theme={theme}
          onThemeChange={setTheme}
          onFind={showCountry}
          cities={cities}
        />
      )}
      {view !== 'explore' && (
        <SidePanel title={VIEWS.find((v) => v.id === view)!.label} onClose={() => changeView('explore')}>
          {view === 'visited' && (
            <VisitedTab
              view={visitedView}
              onViewChange={(next) => {
                setFollowing(null)
                setVisitedView(next)
                if (next === 'years') showYear(review)
              }}
              places={visited.size}
              trips={tripViews.length}
              years={years.length}
              countries={
                <VisitedPanel
                  visited={visited}
                  onAdd={addPlace}
                  onRemove={removePlace}
                  wishlist={wishlist}
                  onWish={addWish}
                  onUnwish={unwish}
                  inTrips={inTrips}
                  onShow={showCountry}
                  note={(country) => {
                    const notes = [describeVisits(datesOf(country.properties.name))]
                    if (regions && hasRegions(country)) {
                      const { visited: count, total } = regionProgress(regions, visitedRegions, country)
                      if (count > 0) notes.push(`${count} of ${total} ${regionsLabel(country).toLowerCase()}`)
                    }
                    const cityCount = cities ? citiesOf(cities, country).filter((c) => visitedCities.has(c.id)).length : 0
                    if (cityCount > 0) notes.push(citiesLabel(cityCount))
                    return notes.filter(Boolean).join(' · ') || null
                  }}
                  cityCount={cities ? cities.filter((c) => visitedCities.has(c.id)).length : 0}
                />
              }
              yearsPanel={
                <YearsPanel
                  years={years}
                  review={review}
                  noteOf={noteOf}
                  onWrap={() => setWrapping(true)}
                  lapse={{
                    steps: timeline,
                    shown: lapse,
                    onPlay: playLapse,
                    onPause: pauseLapse,
                    onStop: () => {
                      stopLapse()
                      showYear(review)
                    },
                  }}
                  onYearChange={(year) => {
                    setPickedYear(year)
                    showYear(reviewOf(year, { visited, datesOf, routes }))
                  }}
                  onShow={showCountry}
                  onShowRoute={(route) => showRoutes([route])}
                />
              }
              tripsPanel={
                <TripsPanel
                  trips={tripViews}
                  loose={looseTravels}
                  routes={allRoutes}
                  flown={routes}
                  airports={airports}
                  actions={tripActions}
                  open={openTripId}
                  onOpen={setOpenTripId}
                  onShowTrip={(trip) => (trip.routes.length ? showRoutes(trip.routes) : showPlaces(trip.items))}
                  onShowRoute={(route) => showRoutes([route])}
                  onShowPlace={showCountry}
                  onFollowTrip={followTrip}
                  onReplay={canReplay ? startReplay : undefined}
                />
              }
            />
          )}
          {view === 'more' && (
            <>
              <MorePanel
                open={moreOpen}
                onOpen={setMoreOpen}
                earned={earnedIds(atlas).size}
                achievementCount={ACHIEVEMENTS.length}
                achievements={<AchievementsPanel atlas={atlas} />}
                friend={friend?.name ?? null}
                compare={
                  <CompareView
                    visited={visited}
                    friend={friend}
                    comparison={comparison}
                    onFriend={changeFriend}
                    shown={friendShown}
                    onShownChange={setFriendShown}
                    wishlist={wishlist}
                    onWish={addWish}
                    onUnwish={unwish}
                    onShow={showCountry}
                  />
                }
                onPreview={startPreview}
              />
            </>
          )}
          {view === 'games' && (
            <Card label="Games" meta={String(GAMES.length).padStart(2, '0')}>
              <GamesPanel
                game={game}
                best={best}
                previousBest={previousBest}
                bestTimes={bestTimes}
                previousTime={previousTime}
                onStart={playGame}
                onStartLetter={playLetter}
                onStartAll={playAll}
                onStartHigher={playHigher}
                onStartCity={playCity}
                onStartNeighbours={playNeighbours}
                onStartBigger={playBigger}
                onPickCity={pickCity}
                daily={daily}
                onStartDaily={playDaily}
                onPick={pick}
                onGuess={guessHigher}
                onDontKnow={giveUpRound}
                onNext={advance}
                onStop={stop}
                onQuit={quitGame}
                chosen={chosenGame}
                onChoose={setChosenGame}
              />
            </Card>
          )}
        </SidePanel>
      )}

      {/* Names and flags would give away game answers */}
      <Tooltip
        text={playing ? null : (hoveredCity?.name ?? hoveredRegion?.properties.name ?? hovered?.properties.name ?? null)}
      />
      <FlagCorner country={playing ? null : hovered} />
      {wrapping && review && <WrappedView review={review} onClose={() => setWrapping(false)} />}

      {/* Notes at the bottom, one over the other */}
      <div className="toasts">
        {update && !previewing && <UpdateToast onReload={() => applyUpdate(update)} onDismiss={dismissUpdate} />}
        <AchievementToast
          achievements={newAchievements}
          onOpen={() => {
            clearAchievements()
            setMoreOpen('achievements')
            changeView('more')
          }}
          onDismiss={clearAchievements}
        />
        <UndoToast removal={removal} onDone={clearRemoval} />
      </div>

      {selected && (
        <CountryPanel
          country={selected}
          visited={visited.has(selected.properties.name)}
          onToggleVisited={() =>
            (visited.has(selected.properties.name) ? removePlace : addPlace)(selected.properties.name)
          }
          wished={wishlist.has(selected.properties.name)}
          onToggleWish={() => (wished.has(selected.properties.name) ? unwish : addWish)(selected.properties.name)}
          onClose={() => selectCountry(null)}
          regions={
            editing
              ? {
                  regions: regions && editingRegions,
                  label: regionsLabel(editing),
                  visited: visitedRegions,
                  onToggle: (region) => toggleRegion(region, editing),
                }
              : undefined
          }
          cities={
            selectedCities.length > 0 || !cities
              ? {
                  cities: cities && selectedCities,
                  visited: visitedCities,
                  onToggle: (city) => toggleCity(city, selected),
                }
              : undefined
          }
          visits={
            visited.has(selected.properties.name) || selectedVisits.length > 0
              ? {
                  visits: selectedVisits,
                  noteOf: (date) => noteOf(selected.properties.name, date),
                  onNote: (date, note) => setNote(selected.properties.name, date, note),
                  onOpenTrip: openTrip,
                }
              : undefined
          }
          onTrips={inTrips.has(selected.properties.name)}
        />
      )}
        </>
      )}
    </div>
  )
}
