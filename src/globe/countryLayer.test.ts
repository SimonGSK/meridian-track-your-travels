import { describe, expect, it, vi } from 'vitest'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import { borders, countries } from '../countries'
import { GLOW_LIFT, NIGHT_GLOW, createCountryLayer, createRaisedCountry } from './countryLayer'
import { toUnitVector } from './sphereMesh'

const LAND = '#48a078'
const HOVER = '#ffc850'

const RADIUS = 100

describe('createCountryLayer', () => {
  const layer = createCountryLayer(countries, borders, RADIUS)
  const land = layer.object.children.find((c): c is Mesh => c instanceof Mesh)!
  const colors = land.geometry.getAttribute('color') as BufferAttribute
  const colorAt = (i: number) => new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString()
  const allColors = () => Array.from({ length: colors.count }, (_, i) => colorAt(i))
  const hex = (color: string) => new Color(color).getHexString()

  it('draws all countries as one mesh and one set of lines, with markers and dots for tiny places', () => {
    expect(layer.object.children).toHaveLength(5)
    // The land, and its glow at night over a picture of the Earth
    expect(layer.object.children.filter((c) => c instanceof Mesh)).toHaveLength(2)
    expect(layer.object.children.filter((c) => c instanceof LineSegments)).toHaveLength(1)
    expect(layer.object.children.filter((c) => c instanceof Points)).toHaveLength(2)
  })

  it('marks every tiny place, in its own color', () => {
    const markers = layer.object.children.find((c): c is Points<BufferGeometry> => c instanceof Points)!
    const tiny = countries.filter((c) => c.properties.tiny)
    expect(markers.geometry.getAttribute('position').count).toBe(tiny.length)
    const grenada = tiny.findIndex((c) => c.properties.name === 'Grenada')
    layer.paint(tiny[grenada], HOVER)
    const markerColors = markers.geometry.getAttribute('color')
    const color = new Color(markerColors.getX(grenada), markerColors.getY(grenada), markerColors.getZ(grenada))
    expect(color.getHexString()).toBe(hex(HOVER))
    layer.paint(tiny[grenada], LAND)
  })

  for (const country of countries) layer.paint(country, LAND)

  it('paints every country', () => {
    expect(new Set(allColors())).toEqual(new Set([hex(LAND)]))
  })

  it("paints only the given country's part of the mesh", () => {
    const denmark = countries.find((c) => c.properties.name === 'Denmark')!
    layer.paint(denmark, HOVER)
    const painted = allColors().filter((c) => c === hex(HOVER)).length
    expect(painted).toBeGreaterThan(0)
    expect(painted).toBeLessThan(colors.count / 100) // a small country, not the world

    layer.paint(denmark, LAND)
    expect(new Set(allColors())).toEqual(new Set([hex(LAND)]))
  })

  it('paints a country see-through, for a design with a picture of the Earth under the land', () => {
    const denmark = countries.find((c) => c.properties.name === 'Denmark')!
    const material = land.material as MeshLambertMaterial
    expect(material.transparent).toBe(false)
    layer.setSeeThrough(true)
    expect(material.transparent).toBe(true)
    layer.paint(denmark, HOVER, 0.6)
    const alphas = new Set(Array.from({ length: colors.count }, (_, i) => colors.getW(i)))
    expect([...alphas].map((a) => a.toFixed(2)).sort()).toEqual(['0.60', '1.00'])
    layer.paint(denmark, LAND)
    layer.setSeeThrough(false)
    expect(material.transparent).toBe(false)
  })

  it('makes the places painted over a picture of the Earth glow back through the night, where the sun has set', () => {
    const glow = layer.object.getObjectByName('night-glow') as Mesh<BufferGeometry, ShaderMaterial>
    // The land's own shape and colors, as much as each place is painted, added over the night
    expect(glow.geometry).toBe(land.geometry)
    expect(glow.material).toMatchObject({ blending: AdditiveBlending, depthWrite: false })
    expect(glow.material.uniforms.strength.value).toBe(NIGHT_GLOW)
    expect(glow.renderOrder).toBeGreaterThan(-1) // after the night, which would darken it
    // A hair above the land, so it never sinks into it in patches
    expect(glow.scale.toArray()).toEqual([1 + GLOW_LIFT, 1 + GLOW_LIFT, 1 + GLOW_LIFT])
    expect(glow.visible).toBe(false)
    layer.setNight({ lat: 10, lng: 20 })
    expect(glow.visible).toBe(false) // not over plain land, which it would light up
    layer.setSeeThrough(true)
    expect(glow.visible).toBe(true)
    expect((glow.material.uniforms.sun.value as Vector3).toArray()).toEqual(toUnitVector([20, 10]))
    layer.setNight(null)
    expect(glow.visible).toBe(false)
    layer.setNight({ lat: 0, lng: 0 })
    layer.setSeeThrough(false)
    expect(glow.visible).toBe(false)
    layer.setNight(null)
  })

  it('queues both countries for upload when switching hover in one frame', () => {
    const [a, b] = countries
    colors.clearUpdateRanges()
    layer.paint(a, LAND)
    layer.paint(b, HOVER)
    expect(colors.updateRanges).toHaveLength(2)
  })

  it('puts a dot on tiny places that are game answers, in their colors', () => {
    const [ring, dots] = layer.object.children.filter((c): c is Points<BufferGeometry> => c instanceof Points)
    const named = (name: string) => countries.find((c) => c.properties.name === name)!
    layer.emphasize(new Map([[named('Grenada'), '#ff0000'], [named('Nauru'), '#00ff00'], [named('Brazil'), '#0000ff']]))
    expect(dots.geometry.getAttribute('position').count).toBe(2) // Brazil is big enough to see
    const color = dots.geometry.getAttribute('color')
    expect(new Color(color.getX(0), color.getY(0), color.getZ(0)).getHexString()).toBe('ff0000')
    expect(dots.material).not.toBe(ring.material)
    layer.setRings([], null)
    expect(dots.geometry.getAttribute('position').count).toBe(2) // shown even when the rings are switched off
    layer.setRings(countries.filter((c) => c.properties.tiny), null)
    layer.emphasize(new Map())
    expect(dots.geometry.getAttribute('position').count).toBe(0)
  })

  it('rings the places asked for, in their colors', () => {
    const rings = layer.object.children.find((c): c is Points<BufferGeometry> => c instanceof Points)!
    const count = () => rings.geometry.getAttribute('position').count
    const named = (name: string) => countries.find((c) => c.properties.name === name)!
    expect(count()).toBe(countries.filter((c) => c.properties.tiny).length)
    layer.paint(named('Fiji'), '#ff0000')
    layer.setRings([named('Grenada'), named('Fiji')], null)
    expect(count()).toBe(2)
    const color = (i: number) => {
      const colors = rings.geometry.getAttribute('color')
      return new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString()
    }
    expect(color(1)).toBe('ff0000') // painted before it had a ring
    layer.paint(named('Grenada'), '#00ff00')
    expect(color(0)).toBe('00ff00')
    layer.setRings([], null)
    expect(count()).toBe(0)
  })

  it('can draw the rings in one color, but for the countries a game colors', () => {
    const rings = layer.object.children.find((c): c is Points<BufferGeometry> => c instanceof Points)!
    const named = (name: string) => countries.find((c) => c.properties.name === name)!
    const color = (i: number) => {
      const colors = rings.geometry.getAttribute('color')
      return new Color(colors.getX(i), colors.getY(i), colors.getZ(i)).getHexString()
    }
    layer.paint(named('Fiji'), '#123456')
    layer.setRings([named('Grenada'), named('Fiji')], '#9fd3ff')
    expect([color(0), color(1)]).toEqual(['9fd3ff', '9fd3ff'])
    layer.emphasize(new Map([[named('Fiji'), '#00ff00']])) // found
    expect([color(0), color(1)]).toEqual(['9fd3ff', '00ff00'])
    layer.emphasize(new Map())
    layer.setRings([named('Fiji')], null)
    expect(color(0)).toBe('123456')
  })

  it('recolors the borders', () => {
    const lines = layer.object.children.find((c): c is LineSegments<BufferGeometry, LineBasicMaterial> => c instanceof LineSegments)!
    layer.setBorders('#ff0000', 0.5)
    expect(lines.material.color.getHexString()).toBe('ff0000')
    expect(lines.material.opacity).toBe(0.5)
  })
})

describe('createRaisedCountry', () => {
  const denmark = countries.find((c) => c.properties.name === 'Denmark')!
  const raised = createRaisedCountry(denmark, RADIUS, RADIUS * 1.01)
  const [cap, walls] = raised.object.children as Mesh<BufferGeometry, MeshLambertMaterial>[]
  const radii = (mesh: Mesh) => {
    const pos = mesh.geometry.getAttribute('position')
    return Array.from({ length: pos.count }, (_, i) => new Vector3().fromBufferAttribute(pos, i).length())
  }

  it('puts the surface at the raised height', () => {
    for (const r of radii(cap)) expect(r).toBeCloseTo(RADIUS * 1.01, 3)
  })

  it('has walls from the globe up to the surface', () => {
    const r = radii(walls)
    expect(Math.min(...r)).toBeCloseTo(RADIUS, 3)
    expect(Math.max(...r)).toBeCloseTo(RADIUS * 1.01, 3)
  })

  it('colors the walls darker than the surface', () => {
    raised.setColor('#ff7846')
    expect(cap.material.color.getHexString()).toBe('ff7846')
    expect(walls.material.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(cap.material.color.getHSL({ h: 0, s: 0, l: 0 }).l)
  })
})

describe('marker rings', () => {
  it('draws a ring texture for the markers when a canvas is available', () => {
    const context = { strokeStyle: '', fillStyle: '', lineWidth: 0, beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn() }
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    const layer = createCountryLayer(countries.slice(0, 5), borders, RADIUS)
    const [markers, dots] = layer.object.children.filter((c): c is Points<BufferGeometry, PointsMaterial> => c instanceof Points)
    expect(markers.material.map).not.toBeNull()
    expect(dots.material.map).not.toBeNull()
    expect(context.arc).toHaveBeenCalled()
    expect(context.stroke).toHaveBeenCalled() // the ring
    expect(context.fill).toHaveBeenCalled() // the dot
    spy.mockRestore()
    layer.dispose()
  })
})

describe('disposing', () => {
  it('frees the raised country', () => {
    const raised = createRaisedCountry(countries.find((c) => c.properties.name === 'Denmark')!, RADIUS, RADIUS * 1.01)
    const [cap] = raised.object.children as Mesh[]
    const spy = vi.spyOn(cap.geometry, 'dispose')
    raised.dispose()
    expect(spy).toHaveBeenCalled()
  })
})
