import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
} from 'three'
import { toUnitVector } from './sphereMesh'
import { LAND_ALTITUDE } from './style'

/** Just above the land and its borders, under the raised country, pins and flights */
const NIGHT_LIFT = 0.0015
/** How dark full night is: dark enough to see, light enough to still read the map */
export const NIGHT_DARKNESS = 0.62
/** How dark under a picture of the Earth's lights at night: as from space, the lights bright on it */
export const PICTURE_DARKNESS = 0.8
/** How bright the picture's lights are */
const PICTURE_GAIN = 2.5
export const NIGHT_COLOR = '#02060d'
export const LIGHT_COLOR = '#ffd27f'

/**
 * How dark it is where the sun is at `sine` (the sine of its height above
 * the horizon): day above, twilight down to 18° below, then night.
 */
const NIGHT_GLSL = `
  float nightAt(float sine) {
    return 1.0 - smoothstep(-0.309, 0.035, sine);
  }
`

type LatLng = { lat: number; lng: number }
/** A city lit at night, bigger for more people */
export type Light = LatLng & { population: number }

export type NightLayer = {
  object: Group
  /** Where the sun is overhead */
  setSun(point: LatLng): void
  /** The cities that light up at night */
  setLights(lights: readonly Light[]): void
  /** A picture of the Earth's lights at night, on black, to light the side the sun has set on; or none */
  setPicture(picture: Texture | null): void
  dispose(): void
}

/** On-screen size of a city's light, in pixels: from 1.5 for a town to 5 for the biggest cities */
export const lightSize = (population: number) => 1.5 + Math.min(Math.max(Math.log10(Math.max(population, 1)) - 4.5, 0), 2.5) * 1.4

/**
 * Night on the globe: a dark, see-through shell over the side the sun has
 * set on, fading through twilight, with the cities lit on it, as dots or as
 * they look from space in a picture of the Earth's lights at night.
 */
export function createNightLayer(globeRadius: number): NightLayer {
  const radius = globeRadius * (1 + LAND_ALTITUDE) * (1 + NIGHT_LIFT)
  const sun = new Vector3(1, 0, 0)

  const shell = new Mesh(
    new SphereGeometry(radius, 128, 64),
    new ShaderMaterial({
      uniforms: {
        sun: { value: sun },
        color: { value: new Color(NIGHT_COLOR) },
        darkness: { value: NIGHT_DARKNESS },
        picture: { value: null as Texture | null },
        hasPicture: { value: 0 },
      },
      vertexShader: `
        varying vec3 direction;
        void main() {
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sun;
        uniform vec3 color;
        uniform float darkness;
        uniform sampler2D picture;
        uniform float hasPicture;
        varying vec3 direction;
        ${NIGHT_GLSL}
        void main() {
          vec3 d = normalize(direction);
          float night = nightAt(dot(d, sun));
          float alpha = night * darkness;
          vec3 lit = vec3(0.0);
          if (hasPicture > 0.5) {
            // Where on the picture, as on the globe's: longitude around from +z towards +x, latitude up y
            float a = atan(d.x, d.z) / 6.2831853 + 0.5;
            // At the date line a jumps from one edge of the picture to the other, and the smaller copies of the
            // picture used far out would be misread along it: there, read it from b, the same place on the
            // picture (it repeats sideways), whose jump is at Greenwich instead
            float b = fract(a + 0.5) - 0.5;
            float x = fwidth(a) < fwidth(b) - 0.001 ? a : b;
            vec2 uv = vec2(x, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5);
            lit = texture2D(picture, uv).rgb * night * ${PICTURE_GAIN.toFixed(2)};
          }
          // Premultiplied: the dark over what's under it, and the lights on top
          gl_FragColor = vec4(color * alpha + lit, alpha);
        }
      `,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
    }),
  )
  shell.name = 'night'
  // Over the land, under the borders, rings, pins and flights, which stay readable at night
  shell.renderOrder = -1

  const lightGeometry = new BufferGeometry()
  const lightMaterial = new ShaderMaterial({
    uniforms: { sun: { value: sun }, color: { value: new Color(LIGHT_COLOR) }, pixelRatio: { value: 1 } },
    vertexShader: `
      uniform vec3 sun;
      uniform float pixelRatio;
      attribute float size;
      varying float glow;
      ${NIGHT_GLSL}
      void main() {
        glow = nightAt(dot(normalize(position), sun));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = glow > 0.0 ? size * pixelRatio : 0.0;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float glow;
      void main() {
        // A soft round dot
        float edge = 1.0 - smoothstep(0.15, 0.5, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(color, edge * glow * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
  const lights = new Points(lightGeometry, lightMaterial)
  lights.name = 'city-lights'
  lights.renderOrder = 1
  // Points are sized in device pixels
  lights.onBeforeRender = (renderer) => {
    lightMaterial.uniforms.pixelRatio.value = renderer.getPixelRatio()
  }

  const object = new Group()
  object.name = 'day-and-night'
  object.add(shell, lights)

  return {
    object,
    setSun({ lat, lng }) {
      sun.set(...toUnitVector([lng, lat]))
    },
    setPicture(picture) {
      const { uniforms } = shell.material
      uniforms.picture.value = picture
      uniforms.hasPicture.value = picture ? 1 : 0
      uniforms.darkness.value = picture ? PICTURE_DARKNESS : NIGHT_DARKNESS
    },
    setLights(cities) {
      const lightRadius = radius * (1 + NIGHT_LIFT)
      lightGeometry.setAttribute(
        'position',
        new Float32BufferAttribute(cities.flatMap(({ lat, lng }) => toUnitVector([lng, lat]).map((v) => v * lightRadius)), 3),
      )
      lightGeometry.setAttribute('size', new Float32BufferAttribute(cities.map((c) => lightSize(c.population)), 1))
      lightGeometry.computeBoundingSphere()
    },
    dispose() {
      shell.geometry.dispose()
      shell.material.dispose()
      lightGeometry.dispose()
      lightMaterial.dispose()
    },
  }
}
