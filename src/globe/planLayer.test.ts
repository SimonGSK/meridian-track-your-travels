import { describe, expect, it } from 'vitest'
import type { LineDashedMaterial, LineLoop } from 'three'
import { countries, findCountryByName } from '../countries'
import { createPlanLayer } from './planLayer'
import { LAND_ALTITUDE } from './style'

const RADIUS = 100
const japan = findCountryByName('Japan')!
const peru = findCountryByName('Peru')!

describe('createPlanLayer', () => {
  it('outlines each place in dashes, every part of it, just above the land', () => {
    const layer = createPlanLayer(RADIUS)
    layer.show([japan, peru])
    const loops = layer.object.children as LineLoop[]
    const parts = (c: typeof japan) => (c.geometry.type === 'Polygon' ? 1 : c.geometry.coordinates.flat().length)
    expect(loops).toHaveLength(parts(japan) + parts(peru))
    expect(loops[0].material as LineDashedMaterial).toMatchObject({ type: 'LineDashedMaterial' })
    expect(loops[0].geometry.getAttribute('lineDistance')).toBeDefined()
    const [x, y, z] = loops[0].geometry.getAttribute('position').array
    expect(Math.hypot(x, y, z)).toBeGreaterThan(RADIUS * (1 + LAND_ALTITUDE))
    layer.show([])
    expect(layer.object.children).toHaveLength(0)
    layer.dispose()
  })

  it('outlines any area, under a name of its own', () => {
    const layer = createPlanLayer(RADIUS, 'city-area')
    expect(layer.object.name).toBe('city-area')
    const square: GeoJSON.Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }
    layer.show([{ geometry: square }])
    expect(layer.object.children).toHaveLength(1)
    layer.dispose()
  })

  it('takes its color', () => {
    const layer = createPlanLayer(RADIUS)
    layer.setColor('#ff0000')
    layer.show([countries[0]])
    expect(((layer.object.children[0] as LineLoop).material as LineDashedMaterial).color.getHexString()).toBe('ff0000')
    layer.dispose()
  })
})
