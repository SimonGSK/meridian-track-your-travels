import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, type Mesh, type MeshBasicMaterial, type Sprite, Vector3 } from 'three'
import { FLIGHT_BASE, PLANE_SIZE_PX, STOP_SECONDS, createFlightLayer, flightPath, flightSeconds, legAt, pointAlong } from './flightLayer'
import { LAND_ALTITUDE } from './style'
import { fakeCanvas } from '../test/fakeCanvas'

const RADIUS = 100
const copenhagen = { lat: 55.62, lng: 12.66 }
const bangkok = { lat: 13.69, lng: 100.75 }
const paris = { lat: 49.01, lng: 2.55 }
const altitudeOf = (point: Vector3) => point.length() / RADIUS - 1

function camera() {
  const c = new PerspectiveCamera(50, 1, 0.1, 10000)
  c.position.set(0, 0, 300) // looking at lat 0, lng 0
  c.lookAt(0, 0, 0)
  c.updateMatrixWorld()
  c.updateProjectionMatrix()
  return c
}

describe('flightPath', () => {
  it('leaves and lands just above the land', () => {
    const path = flightPath(copenhagen, bangkok, RADIUS)
    expect(altitudeOf(path[0])).toBeCloseTo(FLIGHT_BASE)
    expect(altitudeOf(path.at(-1)!)).toBeCloseTo(FLIGHT_BASE)
    expect(FLIGHT_BASE).toBeGreaterThan(LAND_ALTITUDE)
    expect(path[0].clone().normalize().y).toBeCloseTo(Math.sin((copenhagen.lat * Math.PI) / 180), 3)
  })

  it('rises highest in the middle, and higher for longer flights', () => {
    const long = flightPath(copenhagen, bangkok, RADIUS)
    const short = flightPath(copenhagen, paris, RADIUS)
    const peak = (path: Vector3[]) => Math.max(...path.map(altitudeOf))
    expect(altitudeOf(long[32])).toBeCloseTo(peak(long))
    expect(peak(long)).toBeGreaterThan(peak(short))
    expect(peak(short)).toBeGreaterThan(FLIGHT_BASE)
  })
})

describe('pointAlong', () => {
  it('goes from the start to the end of a path, in between in the middle', () => {
    const path = [new Vector3(0, 0, 0), new Vector3(10, 0, 0), new Vector3(10, 10, 0)]
    expect(pointAlong(path, 0).toArray()).toEqual([0, 0, 0])
    expect(pointAlong(path, 0.25).toArray()).toEqual([5, 0, 0])
    expect(pointAlong(path, 1).toArray()).toEqual([10, 10, 0])
    expect(pointAlong(path, 2).toArray()).toEqual([10, 10, 0])
  })
})

describe('createFlightLayer', () => {
  const lines = [
    { key: 'cph-bkk', from: copenhagen, to: bangkok },
    { key: 'bkk-cdg', from: bangkok, to: paris, highlighted: true },
  ]
  /** One trip: Copenhagen, Bangkok, Paris */
  const trip = { key: 'trip', legs: [lines[0], lines[1]] }
  const parts = (layer: ReturnType<typeof createFlightLayer>) => ({
    tubes: layer.object.children.filter((c) => c.type === 'Mesh') as Mesh[],
    planes: layer.object.children.filter((c) => c.type === 'Sprite') as Sprite[],
  })

  it('draws a line for each route and a plane for each trip, and clears them for new ones', () => {
    const layer = createFlightLayer(RADIUS)
    layer.show(lines, [trip])
    expect(parts(layer).tubes).toHaveLength(2)
    expect(parts(layer).planes).toHaveLength(1)
    layer.show([])
    expect(layer.object.children).toHaveLength(0)
    layer.dispose()
  })

  it('draws a line behind its plane as it flies, as a trail, when timed', () => {
    const layer = createFlightLayer(RADIUS)
    const route = { from: copenhagen, to: bangkok }
    layer.show(
      [{ key: 'trail', ...route, drawn: { startsAt: 100, seconds: 4 } }, { key: 'whole', from: copenhagen, to: paris }],
      [{ key: 'plane', legs: [route], timing: { startsAt: 100, seconds: [4], stop: 0 } }],
    )
    const [trail, whole] = parts(layer).tubes
    const full = trail.geometry.index!.count
    /** How much of the trail is drawn, from 0 to 1 */
    const drawn = (at: number) => {
      layer.tick(at, camera(), 800, 800)
      return trail.geometry.drawRange.count / full
    }
    expect(drawn(50)).toBe(0) // not off yet
    expect(drawn(101)).toBeCloseTo(0.25, 1)
    expect(drawn(102)).toBeCloseTo(0.5, 1) // halfway, where its plane is
    expect(drawn(104)).toBe(1)
    expect(drawn(500)).toBe(1) // and stays
    expect(whole.geometry.drawRange.count).toBe(Infinity) // all at once
    layer.dispose()
  })

  it('dashes a flight still to come', () => {
    const layer = createFlightLayer(RADIUS)
    layer.show([lines[0], { key: 'soon', from: copenhagen, to: paris, upcoming: true }], [{ key: 'trip', legs: [lines[0]] }])
    const [flown, soon] = parts(layer).tubes.map((t) => (t.material as MeshBasicMaterial).alphaMap)
    expect(flown).toBeNull()
    expect(soon?.repeat.x).toBeGreaterThanOrEqual(4)
    layer.dispose()
  })

  it('colors the routes and planes, those picked in the highlight color', () => {
    const layer = createFlightLayer(RADIUS)
    layer.show(lines, [trip, { key: 'picked', legs: [lines[1]], highlighted: true }])
    layer.setColors('#0000ff', '#ff0000')
    const color = (m: Mesh | Sprite) => (m.material as MeshBasicMaterial).color.getHexString()
    expect(parts(layer).tubes.map(color)).toEqual(['0000ff', 'ff0000'])
    expect(parts(layer).planes.map(color)).toEqual(['0000ff', 'ff0000'])
    layer.dispose()
  })

  it("flies a trip's plane along its flights over time, the same size on screen", () => {
    const layer = createFlightLayer(RADIUS)
    layer.show(lines, [trip])
    const [plane] = parts(layer).planes
    const cam = camera()
    layer.tick(0, cam, 800, 800)
    const first = plane.position.clone()
    layer.tick(1, cam, 800, 800)
    const second = plane.position.clone()
    // Moving, unless it happened to be waiting at a stop; then a second later it is
    layer.tick(STOP_SECONDS + 1, cam, 800, 800)
    expect(Math.max(second.distanceTo(first), plane.position.distanceTo(second))).toBeGreaterThan(0.1)
    // On a route: between the ends' heights and the peak
    expect(altitudeOf(plane.position)).toBeGreaterThanOrEqual(FLIGHT_BASE - 1e-6)
    // Sized so it's PLANE_SIZE_PX tall at any distance
    expect(plane.scale.x * cam.projectionMatrix.elements[5] * 400).toBeCloseTo(PLANE_SIZE_PX)
    layer.dispose()
  })

  it('turns each plane to face its way on screen', () => {
    const layer = createFlightLayer(RADIUS)
    // Due north along the meridian facing the camera: straight up the screen
    const north = { from: { lat: -10, lng: 0 }, to: { lat: 10, lng: 0 } }
    layer.show([{ key: 'north', ...north }], [{ key: 'north', legs: [north] }])
    const [plane] = parts(layer).planes
    for (const at of [0, 3, 7, 11, 15]) {
      layer.tick(at, camera(), 800, 800)
      expect(plane.material.rotation).toBeCloseTo(0, 1)
    }
    // Due east: to the right, a quarter turn clockwise
    const east = { from: { lat: 0, lng: -10 }, to: { lat: 0, lng: 10 } }
    layer.show([{ key: 'east', ...east }], [{ key: 'east', legs: [east] }])
    const [eastward] = parts(layer).planes
    layer.tick(5, camera(), 800, 800)
    expect(eastward.material.rotation).toBeCloseTo(-Math.PI / 2, 1)
    layer.dispose()
  })
})

describe('a journey flown once', () => {
  it('flies its flights in its own time from when it starts, there only while flying', () => {
    const layer = createFlightLayer(RADIUS)
    const legs = [
      { from: { lat: -10, lng: 0 }, to: { lat: 10, lng: 0 } },
      { from: { lat: 10, lng: 0 }, to: { lat: 10, lng: 20 } },
    ]
    layer.show([], [{ key: 'followed', legs, timing: { startsAt: 100, seconds: [4, 4], stop: STOP_SECONDS } }])
    const plane = layer.object.children.find((c) => c.type === 'Sprite') as Sprite
    /** Where the plane is at a time, [lat, lng], or null where it's not to be seen */
    const where = (at: number) => {
      layer.tick(at, camera(), 800, 800)
      if (!plane.visible) return null
      const { x, y, z } = plane.position
      return [Math.round((Math.asin(y / plane.position.length()) * 180) / Math.PI), Math.round((Math.atan2(x, z) * 180) / Math.PI)]
    }
    expect(where(50)).toBeNull() // not off yet
    expect(where(102)).toEqual([0, 0]) // halfway along the first
    expect(where(104 + STOP_SECONDS / 2)).toBeNull() // landed: gone, at the stop
    expect(where(104 + STOP_SECONDS + 2)).toEqual([10, 10]) // off again, halfway along the second
    expect(where(500)).toBeNull() // landed at the end: gone
    layer.dispose()
  })
})

describe('legAt', () => {
  it('goes through the legs in order, waiting where each lands, then starts over', () => {
    const legs = [10, 5]
    expect(legAt(legs, 0)).toEqual({ leg: 0, t: 0 })
    expect(legAt(legs, 3)).toEqual({ leg: 0, t: 0.3 })
    expect(legAt(legs, 10 + STOP_SECONDS / 2)).toEqual({ leg: 0, t: 1 }) // waiting, where the first landed
    expect(legAt(legs, 10 + STOP_SECONDS + 1)).toEqual({ leg: 1, t: 0.2 })
    expect(legAt(legs, 15 + STOP_SECONDS * 1.5)).toEqual({ leg: 1, t: 1 }) // waiting at the end, before starting over
  })

  it('goes straight on from each, without stops', () => {
    expect(legAt([10, 5], 11, 0)).toEqual({ leg: 1, t: 0.2 })
  })
})

describe('flightSeconds', () => {
  it('gives longer flights more time', () => {
    expect(flightSeconds(1)).toBeGreaterThan(flightSeconds(0.1))
    expect(flightSeconds(0)).toBeGreaterThan(0)
  })

  it('takes its time: Copenhagen to Bangkok, about 1.35 radians, in about 28 seconds, a short hop in 13', () => {
    expect(flightSeconds(1.35)).toBeCloseTo(28.2, 1)
    expect(flightSeconds(0.08)).toBeCloseTo(13, 0)
  })
})

describe('plane texture', () => {
  it('draws a white plane, nose up, with a dark edge, for each plane to tint', () => {
    const { drawing, restore } = fakeCanvas()
    const layer = createFlightLayer(RADIUS)
    expect(drawing.fills).toEqual(['#fff'])
    expect(drawing.strokes).toHaveLength(1)
    expect(drawing.lines).toBeGreaterThan(10) // fuselage, wings and tail
    // And the dash, then the gap, for flights still to come
    expect(drawing.rects).toEqual(['#fff', '#000'])
    layer.dispose()
    restore()
  })
})
