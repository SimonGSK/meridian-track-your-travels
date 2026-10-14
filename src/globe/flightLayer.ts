import {
  CanvasTexture,
  CatmullRomCurve3,
  NearestFilter,
  RepeatWrapping,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
  type ColorRepresentation,
  type PerspectiveCamera,
  type Texture,
} from 'three'
import { geoDistance, geoInterpolate } from 'd3-geo'
import { toUnitVector } from './sphereMesh'
import { LAND_ALTITUDE } from './style'

type LatLng = { lat: number; lng: number }

/**
 * A route to draw: from where to where, whether it's the one picked, and whether it's still to come (dashed).
 * With `drawn`, it's drawn behind its plane as it flies, from `startsAt` (on the tick's clock) over these seconds,
 * as a trail; else all at once
 */
export type FlightLine = {
  key: string
  from: LatLng
  to: LatLng
  highlighted?: boolean
  upcoming?: boolean
  drawn?: { startsAt: number; seconds: number }
}

/**
 * A plane's way round: a trip's flights, flown one after another, then again; picked, it stands out. With
 * `timing`, flown once instead, starting at a time (on the tick's clock), taking these seconds a flight and
 * waiting `stop` seconds where each lands
 */
export type FlightJourney = {
  key: string
  legs: readonly { from: LatLng; to: LatLng }[]
  highlighted?: boolean
  timing?: { startsAt: number; seconds: readonly number[]; stop: number }
}

/** Routes leave from just above the land, so their ends aren't hidden in it */
export const FLIGHT_BASE = LAND_ALTITUDE * 1.5
/** How high a route rises at its middle, as a share of the globe radius, per radian flown */
const RISE = 0.15
/** Points along each route */
const SAMPLES = 64
/** Sides of each route's tube */
const SIDES = 5
/** Width of a route's line, in globe units (the globe's radius is 100) */
const LINE_RADIUS = 0.22
const HIGHLIGHT_RADIUS = 0.38
const LINE_OPACITY = 0.5
/** On-screen size of the planes, in pixels */
export const PLANE_SIZE_PX = 18
/** Dashes along a flight still to come, per radian */
const DASHES_PER_RADIAN = 24

/** How long a plane waits where it lands, before the next flight of its trip */
export const STOP_SECONDS = 2

/**
 * A plane takes its time, more for long flights, then sets off again: Copenhagen to Bangkok about 28 seconds,
 * slow enough that many flights drift calmly rather than bustle
 */
export const flightSeconds = (radians: number) => 12 + radians * 12

/** Points along the great circle from `from` to `to`, rising in an arc that's higher for longer flights */
export function flightPath(from: LatLng, to: LatLng, globeRadius: number, samples = SAMPLES) {
  const ends: [[number, number], [number, number]] = [
    [from.lng, from.lat],
    [to.lng, to.lat],
  ]
  const interpolate = geoInterpolate(...ends)
  const peak = geoDistance(...ends) * RISE
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples
    const altitude = FLIGHT_BASE + peak * Math.sin(Math.PI * t)
    return new Vector3(...toUnitVector(interpolate(t))).multiplyScalar(globeRadius * (1 + altitude))
  })
}

/**
 * Where a plane is `time` into its round of legs that take these `seconds`, waiting `stop` seconds where each
 * lands: which leg, and how far along it (1 while waiting)
 */
export function legAt(seconds: readonly number[], time: number, stop = STOP_SECONDS) {
  let left = time
  for (let leg = 0; leg < seconds.length; leg++) {
    if (left < seconds[leg]) return { leg, t: left / seconds[leg] }
    left -= seconds[leg] + stop
    if (left < 0) return { leg, t: 1 }
  }
  return { leg: seconds.length - 1, t: 1 }
}

/** Where along its path a plane is, `t` from 0 to 1 */
export function pointAlong(path: readonly Vector3[], t: number, into = new Vector3()) {
  const position = Math.min(Math.max(t, 0), 1) * (path.length - 1)
  const i = Math.min(Math.floor(position), path.length - 2)
  return into.copy(path[i]).lerp(path[i + 1], position - i)
}

/**
 * A plane, flying a trip's legs (their paths, and how long each takes) in turn, waiting at each stop: round and
 * round, or once from `startsAt`
 */
type Plane = {
  sprite: Sprite
  paths: Vector3[][]
  seconds: readonly number[]
  stop: number
  total: number
  offset: number
  startsAt: number | null
}

export type FlightLayer = {
  object: Group
  /** Draws these routes, and a plane flying each of these journeys */
  show(lines: readonly FlightLine[], journeys?: readonly FlightJourney[]): void
  setColors(line: ColorRepresentation, highlight: ColorRepresentation): void
  /** Moves the planes to where they are at `seconds`, facing their way on screen */
  tick(seconds: number, camera: PerspectiveCamera, width: number, height: number): void
  dispose(): void
}

/** The same small offset for a route every time, so its plane doesn't jump when the list changes */
const offsetOf = (key: string) => [...key].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 997, 7) / 997

/**
 * Flights as thin arcs above the globe, and a little plane for each trip,
 * flying its flights in the order flown, gone a moment where each lands
 * before setting off again: one plane a trip keeps the globe calm. The planes keep
 * their size on screen and turn to face the way they're flying. Flights
 * still to come are dashed.
 */
export function createFlightLayer(globeRadius: number): FlightLayer {
  const object = new Group()
  object.name = 'flights'
  const texture = planeTexture()
  const dashes = dashTexture()
  const colors = { line: new Color('#ffffff'), highlight: new Color('#ffffff') }
  let lines: { mesh: Mesh<TubeGeometry, MeshBasicMaterial>; highlighted: boolean; drawn?: FlightLine['drawn'] }[] = []
  let planes: (Plane & { highlighted: boolean })[] = []

  const clear = () => {
    for (const { mesh } of lines) {
      mesh.geometry.dispose()
      // Its own copy of the dashes, repeated to its length
      if (mesh.material.alphaMap !== null) mesh.material.alphaMap.dispose()
      mesh.material.dispose()
    }
    for (const { sprite } of planes) sprite.material.dispose()
    object.clear()
    lines = []
    planes = []
  }

  const paint = () => {
    for (const { mesh, highlighted } of lines) mesh.material.color.copy(highlighted ? colors.highlight : colors.line)
    for (const { sprite, highlighted } of planes) sprite.material.color.copy(highlighted ? colors.highlight : colors.line)
  }

  const here = new Vector3()
  const ahead = new Vector3()

  return {
    object,
    show(routes, journeys = []) {
      clear()
      for (const route of routes) {
        const highlighted = !!route.highlighted
        const path = flightPath(route.from, route.to, globeRadius)
        const tube = new TubeGeometry(new CatmullRomCurve3(path), SAMPLES, highlighted ? HIGHLIGHT_RADIUS : LINE_RADIUS, SIDES)
        // A trail: nothing of it until its plane sets off
        if (route.drawn) tube.setDrawRange(0, 0)
        const radians = geoDistance([route.from.lng, route.from.lat], [route.to.lng, route.to.lat])
        const mesh = new Mesh(
          tube,
          new MeshBasicMaterial({
            transparent: true,
            opacity: highlighted ? 0.95 : LINE_OPACITY,
            depthWrite: false,
            alphaMap: route.upcoming ? dashesFor(dashes, radians) : null,
          }),
        )
        object.add(mesh)
        lines.push({ mesh, highlighted, drawn: route.drawn })
      }
      for (const journey of journeys) {
        if (journey.legs.length === 0) continue
        const paths = journey.legs.map(({ from, to }) => flightPath(from, to, globeRadius))
        const seconds =
          journey.timing?.seconds ??
          journey.legs.map(({ from, to }) => flightSeconds(geoDistance([from.lng, from.lat], [to.lng, to.lat])))
        const stop = journey.timing?.stop ?? STOP_SECONDS
        const total = seconds.reduce((sum, leg) => sum + leg + stop, 0)
        const sprite = new Sprite(new SpriteMaterial({ map: texture, sizeAttenuation: false, transparent: true, alphaTest: 0.5 }))
        sprite.renderOrder = 2
        object.add(sprite)
        planes.push({
          sprite,
          paths,
          seconds,
          stop,
          total,
          offset: offsetOf(journey.key) * total,
          startsAt: journey.timing?.startsAt ?? null,
          highlighted: !!journey.highlighted,
        })
      }
      paint()
    },
    setColors(line, highlight) {
      colors.line.set(line)
      colors.highlight.set(highlight)
      paint()
    },
    tick(seconds, camera, width, height) {
      // Trails as far as their planes have flown: the tube's first segments, each its sides' two triangles
      for (const { mesh, drawn } of lines) {
        if (!drawn) continue
        const t = Math.min(Math.max((seconds - drawn.startsAt) / drawn.seconds, 0), 1)
        mesh.geometry.setDrawRange(0, Math.round(t * SAMPLES) * SIDES * 6)
      }
      // Sprites that don't scale with distance are sized by the camera's projection
      const scale = PLANE_SIZE_PX / ((camera.projectionMatrix.elements[5] * height) / 2)
      for (const plane of planes) {
        // Once: not off until then, and done after
        const time = plane.startsAt === null ? (seconds + plane.offset) % plane.total : seconds - plane.startsAt
        const { leg, t } = legAt(plane.seconds, Math.max(time, 0), plane.stop)
        // Only while flying: gone once it lands, until it sets off again
        plane.sprite.visible = time >= 0 && t < 1
        if (!plane.sprite.visible) continue
        const path = plane.paths[leg]
        pointAlong(path, t, here)
        plane.sprite.position.copy(here)
        plane.sprite.scale.setScalar(scale)
        // Face the way it's going, as it looks on screen
        const start = pointAlong(path, t).project(camera)
        const end = pointAlong(path, t + 0.01, ahead).project(camera)
        const dx = (end.x - start.x) * width
        const dy = (end.y - start.y) * height
        if (dx || dy) plane.sprite.material.rotation = Math.atan2(dy, dx) - Math.PI / 2
      }
    },
    dispose() {
      clear()
      texture.dispose()
      dashes.dispose()
    },
  }
}

/** A dash and a gap, to repeat along a route still to come: only the dash shows */
function dashTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 1
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#fff'
    context.fillRect(0, 0, 1, 1)
    context.fillStyle = '#000'
    context.fillRect(1, 0, 1, 1)
  }
  const texture = new CanvasTexture(canvas)
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  return texture
}

/** The dashes repeated along a route this long, around a tube's length (its texture's u) */
function dashesFor(dashes: Texture, radians: number) {
  const texture = dashes.clone()
  texture.wrapS = RepeatWrapping
  texture.repeat.set(Math.max(4, Math.round(radians * DASHES_PER_RADIAN)), 1)
  texture.needsUpdate = true
  return texture
}

/** A white plane seen from above, nose up, with a dark edge; tinted by each sprite's color */
function planeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    context.beginPath()
    context.moveTo(32, 3)
    context.quadraticCurveTo(36, 6, 36, 14)
    context.lineTo(36, 24)
    context.lineTo(61, 38)
    context.lineTo(61, 44)
    context.lineTo(36, 37)
    context.lineTo(36, 50)
    context.lineTo(45, 57)
    context.lineTo(45, 61)
    context.lineTo(32, 57)
    context.lineTo(19, 61)
    context.lineTo(19, 57)
    context.lineTo(28, 50)
    context.lineTo(28, 37)
    context.lineTo(3, 44)
    context.lineTo(3, 38)
    context.lineTo(28, 24)
    context.lineTo(28, 14)
    context.quadraticCurveTo(28, 6, 32, 3)
    context.closePath()
    context.fillStyle = '#fff'
    context.fill()
    context.lineWidth = 2.5
    context.strokeStyle = 'rgba(0, 0, 0, 0.7)'
    context.stroke()
  }
  return new CanvasTexture(canvas)
}
