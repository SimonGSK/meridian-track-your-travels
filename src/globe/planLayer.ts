import { BufferGeometry, Float32BufferAttribute, Group, LineDashedMaterial, LineLoop, type ColorRepresentation } from 'three'
import type { CountryFeature } from '../countries'
import { MAX_SAG, densifyRing } from './sphereMesh'
import { LAND_ALTITUDE } from './style'

/** Above the land and its states, as region outlines are, so the dashes aren't hidden in it */
const LIFT = 4 * MAX_SAG
/** Dashes and the gaps between them, in globe units (the globe's radius is 100) */
const DASH = 0.9
const GAP = 0.6

/** A place to outline: a country, or any area, like how far a city reaches */
export type Outlined = Pick<CountryFeature, 'geometry'>

export type PlanLayer = {
  object: Group
  /** Outlines these places, and no others */
  show(places: readonly Outlined[]): void
  setColor(color: ColorRepresentation): void
  dispose(): void
}

const polygonsOf = ({ geometry }: Outlined) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

/** Places you're going to, outlined in dashes (or other areas, under another name) */
export function createPlanLayer(globeRadius: number, name = 'plans'): PlanLayer {
  const radius = globeRadius * (1 + LAND_ALTITUDE) * (1 + LIFT)
  const object = new Group()
  object.name = name
  const material = new LineDashedMaterial({ dashSize: DASH, gapSize: GAP, transparent: true, opacity: 0.95 })
  let loops: LineLoop[] = []

  const clear = () => {
    for (const loop of loops) loop.geometry.dispose()
    object.clear()
    loops = []
  }

  return {
    object,
    show(places) {
      clear()
      for (const place of places) {
        for (const ring of polygonsOf(place).flat()) {
          const positions = densifyRing(ring).flatMap((v) => [v[0] * radius, v[1] * radius, v[2] * radius])
          const geometry = new BufferGeometry()
          geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
          const loop = new LineLoop(geometry, material)
          loop.computeLineDistances()
          object.add(loop)
          loops.push(loop)
        }
      }
    },
    setColor(color) {
      material.color.set(color)
    },
    dispose() {
      clear()
      material.dispose()
    },
  }
}
