import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { GlobeMethods } from 'react-globe.gl'
import { SRGBColorSpace, TextureLoader, type PerspectiveCamera, type Texture } from 'three'
import { geoDistance } from 'd3-geo'
import { borders, countries, findCountryNear, tinyPlaces, type CountryFeature } from '../countries'
import { loadCities, type City } from '../data/cities'
import { loadRegions, type RegionFeature } from '../data/regions'
import { createCountryLayer, createRaisedCountry, type CountryLayer } from './countryLayer'
import { PIN_FADE, createPinLayer, type Pin, type PinLayer } from './pinLayer'
import { createFlightLayer, type FlightJourney, type FlightLayer, type FlightLine } from './flightLayer'
import { loadAirports, type Airport } from '../data/airports'
import { createRegionLayer, type RegionLayer } from './regionLayer'
import { createPlanLayer, type Outlined, type PlanLayer } from './planLayer'
import { NIGHT_DARKNESS, createNightLayer, type Light } from './nightLayer'
import { subsolarPoint } from './sun'
import { approach, isClick, type LatLng, type Point } from './interaction'
import { screenToLatLng } from './picking'
import { LAND_ALTITUDE, SELECTED_ALTITUDE } from './style'
import { landColor, type Theme } from './themes'

/** How close (in pixels) the pointer must be to a tiny country's marker, or to any country's coast */
const MARKER_HIT_PX = 8
const NEAR_MISS_PX = 6
/** With the rings hidden, tiny places still answer to a smaller circle, or Monaco couldn't be clicked at all */
const HIDDEN_MARKER_HIT_PX = 5
/**
 * Zoomed in, tiny places reach at least this far (km), so pointing near
 * Vatican City finds it: it's a few pixels wide even then, and drawn 1.6 km
 * from where it is at this map's scale.
 */
export const TINY_REACH_KM = 3.5
const EARTH_KM = 6371

/** How far from a place's middle (with a ring, or tiny without one), and from any coast, the pointer counts as on it (radians) */
export const hitDistances = (perPixel: number) => ({
  markerRadius: Math.max(MARKER_HIT_PX * perPixel, TINY_REACH_KM / EARTH_KM),
  unringedRadius: Math.max(HIDDEN_MARKER_HIT_PX * perPixel, TINY_REACH_KM / EARTH_KM),
  tolerance: NEAR_MISS_PX * perPixel,
})

const NOTHING_EMPHASIZED: ReadonlyMap<CountryFeature, string> = new Map()

export const SPIN_SPEED = 0.4
/** How long the globe must be left alone before it starts spinning again */
export const IDLE_DELAY_MS = 30_000
/** Fraction of the remaining speed difference covered each frame */
const SPIN_EASING = 0.04

/**
 * Adds the merged country mesh to the globe's scene and keeps every country
 * painted in `colorOf(country)`, repainting only the ones that changed.
 */
export function useCountryLayer(
  globe: GlobeMethods | null,
  theme: Theme,
  colorOf: (country: CountryFeature) => string,
  {
    rings = tinyPlaces,
    ringColor = null,
    emphasized = NOTHING_EMPHASIZED,
    night = false,
  }: {
    /** Places with a ring around them */
    rings?: readonly CountryFeature[]
    /** One color for the rings, but for the countries a game colors; else each its country's */
    ringColor?: string | null
    emphasized?: ReadonlyMap<CountryFeature, string>
    /** Whether night is shown, for places painted over a picture of the Earth to glow through it */
    night?: boolean
  } = {},
) {
  const layer = useRef<CountryLayer | null>(null)
  const painted = useRef(new Map<CountryFeature, string>())

  useEffect(() => {
    if (!globe) return
    const scene = globe.scene()
    const created = createCountryLayer(countries, borders, globe.getGlobeRadius())
    scene.add(created.object)
    layer.current = created
    painted.current = new Map()
    return () => {
      scene.remove(created.object)
      created.dispose()
      layer.current = null
    }
  }, [globe])

  useEffect(() => {
    layer.current?.setBorders(theme.border, theme.borderOpacity)
    layer.current?.setSeeThrough(!!theme.imagery)
  }, [globe, theme])

  useEffect(() => {
    layer.current?.setRings(rings, ringColor)
  }, [globe, rings, ringColor])

  // Where the sun is, as it moves on every minute, as the night does
  useEffect(() => {
    const current = layer.current
    if (!current || !night) return
    const moveSun = () => current.setNight(subsolarPoint(new Date()))
    moveSun()
    const timer = setInterval(moveSun, SUN_UPDATE_MS)
    return () => {
      clearInterval(timer)
      current.setNight(null)
    }
  }, [globe, night])

  useEffect(() => {
    layer.current?.emphasize(emphasized)
  }, [globe, emphasized])

  useEffect(() => {
    const current = layer.current
    if (!current) return
    const { imagery } = theme
    for (const country of countries) {
      const color = colorOf(country)
      // Over a picture of the Earth, plain land isn't painted at all, and places colored are see-through
      const opacity = !imagery ? 1 : color === landColor(theme, country.properties.mapColor) ? 0 : imagery.tint
      const paint = `${color} ${opacity}`
      if (painted.current.get(country) === paint) continue
      current.paint(country, color, opacity)
      painted.current.set(country, paint)
    }
  }, [globe, colorOf, theme])
}

const RISE_MS = 300

/** Shows the selected country raised above the others, rising smoothly into place. */
export function useSelectedCountry(globe: GlobeMethods | null, selected: CountryFeature | null, color: string) {
  const raised = useRef<ReturnType<typeof createRaisedCountry> | null>(null)

  useEffect(() => {
    if (!globe || !selected) return
    const radius = globe.getGlobeRadius()
    const base = radius * (1 + LAND_ALTITUDE)
    const top = radius * (1 + SELECTED_ALTITUDE)
    const country = createRaisedCountry(selected, radius, top)
    raised.current = country
    const scene = globe.scene()
    scene.add(country.object)

    // Start level with the other countries and ease up
    const start = performance.now()
    let frame = 0
    const rise = () => {
      const t = Math.min(1, (performance.now() - start) / RISE_MS)
      const eased = 1 - (1 - t) ** 3
      country.object.scale.setScalar((base + (top - base) * eased) / top)
      if (t < 1) frame = requestAnimationFrame(rise)
    }
    rise()

    return () => {
      cancelAnimationFrame(frame)
      scene.remove(country.object)
      country.dispose()
      raised.current = null
    }
  }, [globe, selected])

  useEffect(() => {
    raised.current?.setColor(color)
  }, [globe, selected, color])
}

/**
 * Keeps the depth buffer precise at every zoom level. With a fixed, tiny
 * near plane, zooming out leaves too little precision to tell the land from
 * the ocean just below it, and the two flicker. Moving the near plane out
 * with the camera fixes that. Also stops the camera from zooming into the land.
 */
export function useDepthPrecision(globe: GlobeMethods | null) {
  useEffect(() => {
    if (!globe) return
    const camera = globe.camera() as PerspectiveCamera
    const controls = globe.controls()
    const radius = globe.getGlobeRadius()
    controls.minDistance = radius * (1 + SELECTED_ALTITUDE * 2)

    const update = () => {
      const near = Math.max(0.1, (camera.position.length() - radius) * 0.5)
      if (Math.abs(near - camera.near) / camera.near < 0.01) return
      camera.near = near
      camera.updateProjectionMatrix()
    }
    update()
    controls.addEventListener('change', update)
    return () => controls.removeEventListener('change', update)
  }, [globe])
}

/**
 * Ends the camera's glide. The globe's OrbitControls damp every turn, so a
 * spin or a drag keeps turning the camera for a moment after it stops, which
 * would carry a flight past the country it's flying to. The leftover turn is
 * in an internal field, so this checks it's there.
 */
export function stopGlide(globe: GlobeMethods) {
  const glide = (globe.controls() as { _sphericalDelta?: { set(radius: number, phi: number, theta: number): void } })
    ._sphericalDelta
  glide?.set(0, 0, 0)
}

/**
 * Idle spin that eases in and out instead of starting and stopping abruptly.
 * Any interaction with the globe (moving the pointer over it, dragging,
 * zooming) stops it; it resumes once the globe has been left alone for
 * IDLE_DELAY_MS. It spins right away when the page opens.
 */
export function useSmoothAutoRotate(globe: GlobeMethods | null, allowed: boolean, always = false) {
  const [idle, setIdle] = useState(true)

  useEffect(() => {
    const controls = globe?.controls()
    if (!globe || !controls) return
    const element = globe.renderer().domElement
    controls.autoRotate = false
    controls.autoRotateSpeed = 0

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    let held = false
    const wake = () => {
      clearTimeout(idleTimer)
      setIdle(false)
      // While the globe is held, the wait only starts once it's let go
      if (!held) idleTimer = setTimeout(() => setIdle(true), IDLE_DELAY_MS)
    }
    // Grabbing stops the spin at once rather than easing out
    const grab = () => {
      held = true
      controls.autoRotate = false
      controls.autoRotateSpeed = 0
      wake()
    }
    const release = () => {
      held = false
      wake()
    }
    controls.addEventListener('start', grab)
    controls.addEventListener('end', release)
    element.addEventListener('pointermove', wake)
    return () => {
      clearTimeout(idleTimer)
      controls.removeEventListener('start', grab)
      controls.removeEventListener('end', release)
      element.removeEventListener('pointermove', wake)
    }
  }, [globe])

  // `always`: spin now, not after being left alone a while (the screensaver's preview)
  const targetSpeed = allowed && (idle || always) ? SPIN_SPEED : 0

  useEffect(() => {
    const controls = globe?.controls()
    if (!controls) return
    // Not allowed (a country was picked, a game started): stop at once, or the
    // spin would carry the camera past the country it's flying to
    if (!allowed) {
      controls.autoRotate = false
      controls.autoRotateSpeed = 0
      return
    }
    let frame = 0
    const step = () => {
      controls.autoRotateSpeed = approach(controls.autoRotateSpeed, targetSpeed, SPIN_EASING)
      controls.autoRotate = controls.autoRotateSpeed !== 0
      if (controls.autoRotateSpeed !== targetSpeed) frame = requestAnimationFrame(step)
    }
    step()
    return () => cancelAnimationFrame(frame)
  }, [globe, targetSpeed, allowed])
}

type PointerOptions = {
  /** `position` is the point on the globe under the pointer, if any, and `point` the pointer on the screen */
  onHover: (country: CountryFeature | null, position: LatLng | null, point: Point | null) => void
  onClick: (country: CountryFeature | null, position: LatLng | null, point: Point) => void
  /** Places with a ring around them, which answer to a pointer anywhere in it (tiny places answer to a smaller circle without) */
  rings?: readonly CountryFeature[]
}

/**
 * Hover and click detection for countries, via pointer handlers to spread on
 * the element wrapping the globe. Hover is re-checked at most once per frame,
 * including while the globe moves under a still pointer.
 */
export function useCountryPointer(globe: GlobeMethods | null, { onHover, onClick, rings = tinyPlaces }: PointerOptions) {
  const pointer = useRef<Point | null>(null)
  const pressedAt = useRef<Point | null>(null)
  const frame = useRef(0)

  const countryAt = useCallback(
    ({ x, y }: Point): [CountryFeature | null, LatLng | null] => {
      const pos = globe && screenToLatLng(globe, x, y)
      if (!pos) return [null, null]
      // How far one pixel is on the globe here, to turn pixel tolerances into distances
      const beside = screenToLatLng(globe, x + 1, y) ?? screenToLatLng(globe, x - 1, y)
      const perPixel = beside ? geoDistance([pos.lng, pos.lat], [beside.lng, beside.lat]) : 0
      const country = findCountryNear(pos.lat, pos.lng, { ...hitDistances(perPixel), ringed: rings })
      return [country, pos]
    },
    [globe, rings],
  )

  // The latest callbacks, so a pending hover isn't dropped when the caller re-renders with new ones
  const latest = useRef({ countryAt, onHover })
  useLayoutEffect(() => {
    latest.current = { countryAt, onHover }
  })

  const scheduleHover = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const point = pointer.current
      const [country, position] = point ? latest.current.countryAt(point) : [null, null]
      latest.current.onHover(country, position, point)
    })
  }, [])

  useEffect(() => {
    const controls = globe?.controls()
    if (!controls) return
    controls.addEventListener('change', scheduleHover)
    return () => {
      controls.removeEventListener('change', scheduleHover)
      cancelAnimationFrame(frame.current)
      frame.current = 0
    }
  }, [globe, scheduleHover])

  return {
    onPointerMove: (e: PointerEvent) => {
      // Touch has no hover; a finger on the globe is always a tap or a drag
      if (e.pointerType !== 'mouse') return
      pointer.current = { x: e.clientX, y: e.clientY }
      scheduleHover()
    },
    onPointerLeave: () => {
      pointer.current = null
      scheduleHover()
    },
    onPointerDown: (e: PointerEvent) => {
      if (e.button === 0) pressedAt.current = { x: e.clientX, y: e.clientY }
    },
    onPointerUp: (e: PointerEvent) => {
      const releasedAt = { x: e.clientX, y: e.clientY }
      if (pressedAt.current && isClick(pressedAt.current, releasedAt)) onClick(...countryAt(releasedAt), releasedAt)
      pressedAt.current = null
    },
  }
}

/** Data loaded in the background, or null until it's there */
function useLoaded<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let current = true
    load().then((loaded) => current && setData(loaded))
    return () => {
      current = false
    }
  }, [load])
  return data
}

/** The states and provinces, once loaded (they load in the background after the globe). */
export const useRegions = () => useLoaded(loadRegions)

/** The well-known cities, once loaded */
export const useCities = (): City[] | null => useLoaded(loadCities)

type Imagery = NonNullable<Theme['imagery']>

type Pictures = { map: Texture; water: Texture | null; relief: Texture | null }

/** A design's pictures of the Earth, once loaded (null while loading, or for a design without) */
export function useImagery(imagery: Theme['imagery']) {
  const [loaded, setLoaded] = useState<({ of: Imagery } & Pictures) | null>(null)

  useEffect(() => {
    if (!imagery) return
    let gone = false
    let textures: Texture[] = []
    const loader = new TextureLoader()
    const load = (url: string | undefined) => (url ? loader.loadAsync(url) : null)
    Promise.all([load(imagery.map), load(imagery.water), load(imagery.relief)])
      .then(([map, water, relief]) => {
        map!.colorSpace = SRGBColorSpace
        // Sharper at a slant, near the edge of the globe
        map!.anisotropy = 8
        textures = [map, water, relief].filter((t) => t !== null)
        if (gone) textures.forEach((t) => t.dispose())
        else setLoaded({ of: imagery, map: map!, water, relief })
      })
      .catch(() => {
        // Not there (offline before it was kept): the design's sea color stays
      })
    return () => {
      gone = true
      textures.forEach((t) => t.dispose())
    }
  }, [imagery])

  return loaded?.of === imagery ? loaded : null
}

/** The airports, once loaded */
export const useAirports = (): Airport[] | null => useLoaded(loadAirports)

/** Flights as arcs, with a plane flying each of `journeys` (a trip), in `color`, those picked in `highlight` */
export function useFlightLayer(
  globe: GlobeMethods | null,
  lines: readonly FlightLine[],
  journeys: readonly FlightJourney[],
  { color, highlight }: { color: string; highlight: string },
) {
  const layer = useRef<FlightLayer | null>(null)

  useEffect(() => {
    if (!globe) return
    const scene = globe.scene()
    const created = createFlightLayer(globe.getGlobeRadius())
    scene.add(created.object)
    layer.current = created
    return () => {
      scene.remove(created.object)
      created.dispose()
      layer.current = null
    }
  }, [globe])

  useEffect(() => {
    layer.current?.setColors(color, highlight)
  }, [globe, color, highlight])

  useEffect(() => {
    layer.current?.show(lines, journeys)
    if (!globe || (journeys.length === 0 && !lines.some((line) => line.drawn))) return
    // The planes fly, and the trails are drawn behind them, while there are any
    const camera = globe.camera() as PerspectiveCamera
    const canvas = globe.renderer().domElement
    let frame = 0
    const fly = () => {
      layer.current?.tick(performance.now() / 1000, camera, canvas.clientWidth, canvas.clientHeight)
      frame = requestAnimationFrame(fly)
    }
    fly()
    return () => cancelAnimationFrame(frame)
  }, [globe, lines, journeys])
}

/** Places you're going to, outlined in dashes of `color`; or other areas, in a layer of another `name` */
export function usePlanLayer(globe: GlobeMethods | null, places: readonly Outlined[], color: string, name?: string) {
  const layer = useRef<PlanLayer | null>(null)

  useEffect(() => {
    if (!globe) return
    const scene = globe.scene()
    const created = createPlanLayer(globe.getGlobeRadius(), name)
    scene.add(created.object)
    layer.current = created
    return () => {
      scene.remove(created.object)
      created.dispose()
      layer.current = null
    }
  }, [globe, name])

  useEffect(() => {
    layer.current?.setColor(color)
  }, [globe, color])

  useEffect(() => {
    layer.current?.show(places)
  }, [globe, places])
}

/** Pins in `color`, at `pins`, fading out near the edge of the globe as `fade` says */
export function usePinLayer(globe: GlobeMethods | null, pins: readonly Pin[], color: string, fade = PIN_FADE) {
  const layer = useRef<PinLayer | null>(null)

  useEffect(() => {
    if (!globe) return
    const scene = globe.scene()
    const created = createPinLayer(globe.getGlobeRadius())
    scene.add(created.object)
    layer.current = created
    return () => {
      scene.remove(created.object)
      created.dispose()
      layer.current = null
    }
  }, [globe])

  useEffect(() => {
    layer.current?.setColor(color)
  }, [globe, color])

  useEffect(() => {
    layer.current?.setFade(fade)
  }, [globe, fade])

  useEffect(() => {
    layer.current?.show(pins)
  }, [globe, pins])
}

/** How often night moves on: the sun crosses a quarter of a degree a minute */
export const SUN_UPDATE_MS = 60_000

/**
 * Night where the sun has set, as it is now, while `shown`: with `lights` lit in it, or `picture`, the Earth at
 * night with its cities lit
 */
export function useNightLayer(
  globe: GlobeMethods | null,
  shown: boolean,
  lights: readonly Light[],
  picture: Texture | null = null,
  darkness = NIGHT_DARKNESS,
) {
  const layer = useRef<ReturnType<typeof createNightLayer> | null>(null)

  useEffect(() => {
    if (!globe || !shown) return
    const scene = globe.scene()
    const created = createNightLayer(globe.getGlobeRadius())
    const moveSun = () => created.setSun(subsolarPoint(new Date()))
    moveSun()
    const timer = setInterval(moveSun, SUN_UPDATE_MS)
    scene.add(created.object)
    layer.current = created
    return () => {
      clearInterval(timer)
      scene.remove(created.object)
      created.dispose()
      layer.current = null
    }
  }, [globe, shown])

  useEffect(() => {
    layer.current?.setLights(lights)
  }, [globe, shown, lights])

  useEffect(() => {
    layer.current?.setPicture(picture)
  }, [globe, shown, picture])

  useEffect(() => {
    layer.current?.setDarkness(darkness)
  }, [globe, shown, darkness])
}

/** Draws states and provinces over their countries: `fills` in their colors, and `outlines`. */
export function useRegionLayer(
  globe: GlobeMethods | null,
  regions: readonly RegionFeature[] | null,
  fills: ReadonlyMap<RegionFeature, string>,
  outlines: readonly RegionFeature[],
  theme: Theme,
) {
  const layer = useRef<RegionLayer | null>(null)

  useEffect(() => {
    if (!globe || !regions) return
    const scene = globe.scene()
    const created = createRegionLayer(regions, globe.getGlobeRadius())
    scene.add(created.object)
    layer.current = created
    return () => {
      scene.remove(created.object)
      created.dispose()
      layer.current = null
    }
  }, [globe, regions])

  useEffect(() => {
    layer.current?.setOutlineColor(theme.border, theme.borderOpacity * 0.7)
    layer.current?.setFillOpacity(theme.imagery?.tint ?? 1)
  }, [globe, regions, theme])

  useEffect(() => {
    layer.current?.show(fills, outlines)
  }, [globe, regions, fills, outlines])
}
