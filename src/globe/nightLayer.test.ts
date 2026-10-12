import { describe, expect, it } from 'vitest'
import { BufferGeometry, Mesh, Points, ShaderMaterial, Texture, Vector3, type SphereGeometry } from 'three'
import { NIGHT_DARKNESS, PICTURE_DARKNESS, createNightLayer, lightSize } from './nightLayer'
import { toUnitVector } from './sphereMesh'

const RADIUS = 100

describe('createNightLayer', () => {
  const layer = createNightLayer(RADIUS)
  const [shell, lights] = layer.object.children as [Mesh<BufferGeometry, ShaderMaterial>, Points<BufferGeometry, ShaderMaterial>]

  it('covers the globe, just above the land, in a see-through dark', () => {
    shell.geometry.computeBoundingSphere()
    expect(shell.geometry.boundingSphere!.radius).toBeGreaterThan(RADIUS)
    expect(shell.geometry.boundingSphere!.radius).toBeLessThan(RADIUS * 1.02)
    expect(shell.material.transparent).toBe(true)
    expect(shell.material.depthWrite).toBe(false)
    expect(shell.material.uniforms.darkness.value).toBe(NIGHT_DARKNESS)
    // Drawn before the borders, rings, pins and flights, which stay readable at night
    expect(shell.renderOrder).toBeLessThan(0)
  })

  it('turns to where the sun is overhead', () => {
    layer.setSun({ lat: 23.4, lng: -45 })
    const sun = shell.material.uniforms.sun.value as Vector3
    expect(sun.toArray().map((v) => v.toFixed(6))).toEqual(toUnitVector([-45, 23.4]).map((v) => v.toFixed(6)))
    expect(lights.material.uniforms.sun.value).toBe(sun) // the lights follow the same sun
  })

  it('lights the cities, bigger for more people', () => {
    layer.setLights([
      { lat: 35.68, lng: 139.69, population: 13_960_000 },
      { lat: 64.15, lng: -21.94, population: 118_918 },
    ])
    expect(lights.geometry.getAttribute('position').count).toBe(2)
    const sizes = lights.geometry.getAttribute('size')
    expect(sizes.getX(0)).toBeGreaterThan(sizes.getX(1))
    expect(new Vector3().fromBufferAttribute(lights.geometry.getAttribute('position'), 0).length()).toBeGreaterThan(RADIUS)
  })

  it('sizes lights from a town to a megacity', () => {
    expect(lightSize(5_000)).toBe(1.5)
    expect(lightSize(500_000)).toBeCloseTo(3.2, 1)
    expect(lightSize(30_000_000)).toBe(5)
  })

  it("lights the night with a picture of the Earth's lights instead, over the dark, as dark as it's told", () => {
    const layer = createNightLayer(100)
    const [shell] = layer.object.children as Mesh<SphereGeometry, ShaderMaterial>[]
    expect(shell.material.premultipliedAlpha).toBe(true)
    const picture = new Texture()
    layer.setPicture(picture)
    expect(shell.material.uniforms.picture.value).toBe(picture)
    expect(shell.material.uniforms.hasPicture.value).toBe(1)
    expect(shell.material.uniforms.darkness.value).toBe(NIGHT_DARKNESS)
    layer.setDarkness(PICTURE_DARKNESS)
    expect(shell.material.uniforms.darkness.value).toBe(PICTURE_DARKNESS)
    layer.setPicture(null)
    expect(shell.material.uniforms.hasPicture.value).toBe(0)
    layer.dispose()
  })

  it('cleans up', () => {
    expect(() => layer.dispose()).not.toThrow()
  })
})
