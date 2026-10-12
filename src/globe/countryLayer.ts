import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  CanvasTexture,
  Mesh,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector3,
  type ColorRepresentation,
} from 'three'
import GeoJsonGeometry from 'three-geojson-geometry'
import type { MultiLineString } from 'geojson'
import type { CountryFeature } from '../countries'
import { densifyRing, toUnitVector, triangulatePolygon } from './sphereMesh'
import { LAND_ALTITUDE } from './style'
import { NIGHT_GLSL } from './nightLayer'

/** How far borders float above the land, as a fraction of its radius */
const BORDER_LIFT = 0.0004
/** Tiny places are drawn a hair above the rest, as some overlap a bigger neighbor (Gibraltar and Spain) */
const TINY_LIFT = 0.0002
/** On-screen size of the ring marking tiny places, in pixels */
export const MARKER_SIZE_PX = 12
/** On-screen size of the dot on tiny places that are game answers */
export const EMPHASIS_SIZE_PX = 16
/** How much of their color places painted over a picture of the Earth glow with at night, back through the dark */
export const NIGHT_GLOW = 0.3
/**
 * How far the glow floats above the land, as a fraction of its radius: drawn
 * by another shader, at the land's very height its depth would come out a
 * hair off here and there, hiding it in flickering patches. Below tiny
 * places, which are lifted over their bigger neighbors (TINY_LIFT).
 */
export const GLOW_LIFT = 0.0001

export type CountryLayer = {
  object: Group
  /** Recolor one country, see-through by `opacity` once the land is (see setSeeThrough) */
  paint(country: CountryFeature, color: ColorRepresentation, opacity?: number): void
  /** Whether the land lets the globe under it show through, where it's painted less than opaque */
  setSeeThrough(on: boolean): void
  setBorders(color: ColorRepresentation, opacity: number): void
  /**
   * Rings around these places: the tiny ones, none, or in the letter hunt the small islands too. In
   * their countries' colors, or all in `color` but for the ones a game colors.
   */
  setRings(places: readonly CountryFeature[], color: ColorRepresentation | null): void
  /** Big filled dots on tiny places in these colors (game answers), so they can be seen at any zoom */
  emphasize(colors: ReadonlyMap<CountryFeature, ColorRepresentation>): void
  /**
   * Where the sun is overhead, while night is shown, for the places painted over a picture of the Earth to glow
   * back through it (it darkens them so much they'd be lost); null without night
   */
  setNight(sun: { lat: number; lng: number } | null): void
  dispose(): void
}

/**
 * All countries as one mesh plus one set of border lines.
 *
 * Drawing each country separately (the default polygon layer) costs thousands
 * of draw calls per frame; merging them keeps rotation smooth. Each country
 * keeps its own range of vertex colors so it can be highlighted in place.
 */
export function createCountryLayer(
  countries: CountryFeature[],
  borders: MultiLineString,
  globeRadius: number,
): CountryLayer {
  const top = globeRadius * (1 + LAND_ALTITUDE)

  // Which vertices of the merged mesh belong to which country
  const ranges = new Map<CountryFeature, { start: number; count: number }>()
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  for (const country of countries) {
    const start = positions.length / 3
    const radius = top * (country.properties.tiny ? 1 + TINY_LIFT : 1)
    for (const rings of polygonsOf(country)) {
      const offset = positions.length / 3
      const { vertices, indices: triangles } = triangulatePolygon(rings)
      for (const v of vertices) {
        positions.push(v[0] * radius, v[1] * radius, v[2] * radius)
        normals.push(...v)
      }
      for (const i of triangles) indices.push(offset + i)
    }
    ranges.set(country, { start, count: positions.length / 3 - start })
  }
  const vertexCount = positions.length / 3
  const landGeometry = new BufferGeometry()
  landGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  landGeometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  landGeometry.setIndex(indices)

  // Starts out white; the caller paints each country, and how opaque
  const colors = new BufferAttribute(new Float32Array(vertexCount * 4).fill(1), 4)
  landGeometry.setAttribute('color', colors)

  const land = new Mesh(landGeometry, new MeshLambertMaterial({ vertexColors: true }))

  // Places painted over a picture of the Earth, glowing on the side the sun has set on: their color added over the
  // night, as much as they're painted (none for those not painted), so they show without hiding the city lights
  const sun = new Vector3(1, 0, 0)
  const nightGlow = new Mesh(
    landGeometry,
    new ShaderMaterial({
      uniforms: { sun: { value: sun }, strength: { value: NIGHT_GLOW } },
      vertexShader: `
        attribute vec4 color;
        varying vec4 paint;
        varying vec3 direction;
        void main() {
          paint = color;
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sun;
        uniform float strength;
        varying vec4 paint;
        varying vec3 direction;
        ${NIGHT_GLSL}
        void main() {
          float night = nightAt(dot(normalize(direction), sun));
          gl_FragColor = vec4(paint.rgb * paint.a * night * strength, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  nightGlow.name = 'night-glow'
  nightGlow.scale.setScalar(1 + GLOW_LIFT)
  // After the night, which is drawn before (at -1), so it isn't darkened
  nightGlow.renderOrder = 0
  nightGlow.visible = false
  let night = false
  const showGlow = () => {
    nightGlow.visible = night && land.material.transparent
  }

  // Borders sit just above the land so they never sink into it
  const lines = new LineSegments(
    new GeoJsonGeometry(borders, top * (1 + BORDER_LIFT), 1),
    new LineBasicMaterial({ transparent: true }),
  )

  // Rings around places too small to see, the same size on screen at any zoom, each in its country's color
  const tiny = new Set(countries.filter((c) => c.properties.tiny))
  const painted = new Map<CountryFeature, Color>()
  let ringColor: Color | null = null
  let gameColors = new Map<CountryFeature, Color>()
  const colorOfRing = (country: CountryFeature) => gameColors.get(country) ?? ringColor ?? painted.get(country)
  const markerRadius = top * (1 + BORDER_LIFT * 2)
  const markerGeometry = new BufferGeometry()
  let markerIndex = new Map<CountryFeature, number>()
  let markerColors = new BufferAttribute(new Float32Array(), 3)
  const recolorRings = () => {
    for (const [country, i] of markerIndex) {
      const color = colorOfRing(country)
      if (color) markerColors.setXYZ(i, color.r, color.g, color.b)
    }
    markerColors.needsUpdate = true
  }
  const setRings = (places: readonly CountryFeature[], color: ColorRepresentation | null) => {
    markerIndex = new Map(places.map((c, i) => [c, i]))
    ringColor = color === null ? null : new Color(color)
    const position = places.flatMap((c) => toUnitVector(c.properties.centroid).map((v) => v * markerRadius))
    markerGeometry.setAttribute('position', new Float32BufferAttribute(position, 3))
    markerColors = new BufferAttribute(new Float32Array(places.length * 3).fill(1), 3)
    markerGeometry.setAttribute('color', markerColors)
    markerGeometry.computeBoundingSphere()
    recolorRings()
  }
  setRings([...tiny], null)
  const markers = new Points(
    markerGeometry,
    new PointsMaterial({
      size: MARKER_SIZE_PX,
      sizeAttenuation: false,
      vertexColors: true,
      map: ringTexture(),
      alphaTest: 0.5,
      transparent: true,
    }),
  )

  // Filled dots for tiny places that are game answers, on top of their rings
  const emphasisGeometry = new BufferGeometry()
  const emphasis = new Points(
    emphasisGeometry,
    new PointsMaterial({
      size: EMPHASIS_SIZE_PX,
      sizeAttenuation: false,
      vertexColors: true,
      map: dotTexture(),
      alphaTest: 0.5,
      transparent: true,
    }),
  )
  emphasis.renderOrder = 1

  const object = new Group()
  object.name = 'countries'
  object.add(land, nightGlow, lines, markers, emphasis)

  const paintColor = new Color()
  return {
    object,
    paint(country, color, opacity = 1) {
      const range = ranges.get(country)
      if (!range) return
      paintColor.set(color)
      for (let i = range.start; i < range.start + range.count; i++) {
        colors.setXYZW(i, paintColor.r, paintColor.g, paintColor.b, opacity)
      }
      // Only re-upload this country's colors to the GPU (three.js clears the ranges after uploading)
      colors.addUpdateRange(range.start * 4, range.count * 4)
      colors.needsUpdate = true

      painted.set(country, paintColor.clone())
      const marker = markerIndex.get(country)
      if (marker !== undefined) {
        const ring = colorOfRing(country)!
        markerColors.setXYZ(marker, ring.r, ring.g, ring.b)
        markerColors.needsUpdate = true
      }
    },
    setSeeThrough(on) {
      // See-through, it's drawn with the other see-through things: before the night, which darkens it
      land.renderOrder = on ? -2 : 0
      if (land.material.transparent === on) return
      land.material.transparent = on
      land.material.needsUpdate = true
      showGlow()
    },
    setBorders(color, opacity) {
      lines.material.color.set(color)
      lines.material.opacity = opacity
    },
    setRings,
    emphasize(emphasized) {
      gameColors = new Map([...emphasized].map(([country, color]) => [country, new Color(color)]))
      recolorRings()
      const shown = [...emphasized].filter(([country]) => tiny.has(country))
      const position: number[] = []
      const color: number[] = []
      for (const [country, value] of shown) {
        position.push(...toUnitVector(country.properties.centroid).map((v) => v * markerRadius * (1 + BORDER_LIFT)))
        paintColor.set(value)
        color.push(paintColor.r, paintColor.g, paintColor.b)
      }
      emphasisGeometry.setAttribute('position', new Float32BufferAttribute(position, 3))
      emphasisGeometry.setAttribute('color', new Float32BufferAttribute(color, 3))
    },
    setNight(at) {
      night = at !== null
      if (at) sun.set(...toUnitVector([at.lng, at.lat]))
      showGlow()
    },
    dispose() {
      landGeometry.dispose()
      land.material.dispose()
      nightGlow.material.dispose()
      lines.geometry.dispose()
      lines.material.dispose()
      markerGeometry.dispose()
      markers.material.map?.dispose()
      markers.material.dispose()
      emphasisGeometry.dispose()
      emphasis.material.map?.dispose()
      emphasis.material.dispose()
    },
  }
}

/** A white dot with a dark edge, tinted per dot by its vertex color (the edge stays dark). */
function dotTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null // no canvas (tests): dots draw as squares
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
  context.fillStyle = '#000'
  context.fill()
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2 - 9, 0, Math.PI * 2)
  context.fillStyle = '#fff'
  context.fill()
  return new CanvasTexture(canvas)
}

/** A white ring on transparency, tinted per marker by its vertex color. */
function ringTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null // no canvas (tests): markers draw as squares
  context.strokeStyle = '#fff'
  context.lineWidth = 12
  context.beginPath()
  context.arc(size / 2, size / 2, size / 2 - context.lineWidth / 2 - 1, 0, Math.PI * 2)
  context.stroke()
  return new CanvasTexture(canvas)
}

const polygonsOf = ({ geometry }: CountryFeature) =>
  geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates

/**
 * A country standing out from the globe: its surface at `topRadius` and
 * walls down to `baseRadius`.
 */
export function createRaisedCountry(country: CountryFeature, baseRadius: number, topRadius: number) {
  const capPositions: number[] = []
  const capNormals: number[] = []
  const capIndices: number[] = []
  const wallPositions: number[] = []
  const wallNormals: number[] = []

  for (const rings of polygonsOf(country)) {
    const offset = capPositions.length / 3
    const { vertices, indices } = triangulatePolygon(rings)
    for (const v of vertices) {
      capPositions.push(v[0] * topRadius, v[1] * topRadius, v[2] * topRadius)
      capNormals.push(...v)
    }
    for (const i of indices) capIndices.push(offset + i)

    for (const ring of rings) {
      const points = densifyRing(ring)
      points.forEach((a, i) => {
        const b = points[(i + 1) % points.length]
        const corners = [
          [a, baseRadius],
          [b, baseRadius],
          [b, topRadius],
          [a, baseRadius],
          [b, topRadius],
          [a, topRadius],
        ] as const
        for (const [v, r] of corners) {
          wallPositions.push(v[0] * r, v[1] * r, v[2] * r)
          wallNormals.push(...v)
        }
      })
    }
  }

  const cap = new BufferGeometry()
  cap.setAttribute('position', new Float32BufferAttribute(capPositions, 3))
  cap.setAttribute('normal', new Float32BufferAttribute(capNormals, 3))
  cap.setIndex(capIndices)
  const walls = new BufferGeometry()
  walls.setAttribute('position', new Float32BufferAttribute(wallPositions, 3))
  walls.setAttribute('normal', new Float32BufferAttribute(wallNormals, 3))

  const object = new Group()
  object.name = 'selected-country'
  const capMesh = new Mesh(cap, new MeshLambertMaterial())
  const wallMesh = new Mesh(walls, new MeshLambertMaterial({ side: DoubleSide }))
  object.add(capMesh, wallMesh)

  return {
    object,
    setColor(color: ColorRepresentation) {
      capMesh.material.color.set(color)
      // Walls a shade darker, so the country reads as raised
      wallMesh.material.color.set(color).multiplyScalar(0.6)
    },
    dispose() {
      cap.dispose()
      walls.dispose()
      capMesh.material.dispose()
      wallMesh.material.dispose()
    },
  }
}

export type RaisedCountry = ReturnType<typeof createRaisedCountry>
