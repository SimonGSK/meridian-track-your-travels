import { Color } from 'three'
import earthImage from '../assets/earth-blue-marble.jpg'
import earthWater from '../assets/earth-water.png'
import earthRelief from '../assets/earth-topology.png'

/** A visual design for the globe. */
export type Theme = {
  id: string
  name: string
  ocean: string
  oceanShininess: number
  /** One color for all land, or at least 5 so neighboring countries always differ */
  land: string | readonly string[]
  border: string
  borderOpacity: number
  hover: string
  selected: string
  visited: string
  /** Countries on your wishlist */
  wishlist: string
  /** Pins on visited cities */
  pin: string
  /** Lines for flights taken */
  flight: string
  /** Game feedback */
  correct: string
  wrong: string
  background: string
  atmosphere: string
  /**
   * A picture of the Earth on the globe, instead of colored land on a colored
   * sea: only places colored (visited, picked…) are painted over it, letting
   * `tint` of their color through. `water` marks the sea, to shine; and
   * `relief` is how high the land is, for mountains to catch the light. Its
   * night is dark as from space, under the Earth's lights.
   */
  imagery?: { map: string; water?: string; relief?: string; tint: number }
}

export const MIDNIGHT: Theme = {
  id: 'midnight',
  name: 'Midnight',
  ocean: '#0c1b2b',
  oceanShininess: 10,
  land: '#1f3a52',
  border: '#07111b',
  borderOpacity: 0.75,
  hover: '#f2843a',
  selected: '#f5be5b',
  visited: '#e1a03e',
  wishlist: '#9b8cf2',
  pin: '#e5553a',
  flight: '#9fd3ff',
  correct: '#8fd694',
  wrong: '#ff5f56',
  background: '#08131e',
  atmosphere: '#3b82c8',
}

export const CLASSIC: Theme = {
  id: 'classic',
  name: 'Classic',
  ocean: '#0b2a4a',
  oceanShininess: 12,
  land: '#48a078',
  border: '#0a1e19',
  borderOpacity: 0.8,
  hover: '#ffc850',
  selected: '#ff7846',
  visited: '#5b8def',
  wishlist: '#c084fc',
  pin: '#ff4757',
  flight: '#ffffff',
  correct: '#b4f25c',
  wrong: '#ff5a5f',
  background: '#02040a',
  atmosphere: '#5fb3ff',
}

export const POLITICAL: Theme = {
  id: 'political',
  name: 'Political',
  ocean: '#8ec3e6',
  oceanShininess: 6,
  land: ['#f3d58b', '#b9d98f', '#f2b39b', '#c3b1e1', '#94d2c4'],
  border: '#4a4a4a',
  borderOpacity: 0.55,
  hover: '#ff8a00',
  selected: '#e63946',
  visited: '#2f6fdb',
  wishlist: '#8e44c9',
  pin: '#b5179e',
  flight: '#1d3557',
  correct: '#15803d',
  wrong: '#dc2626',
  background: '#050a14',
  atmosphere: '#bfe3ff',
}

export const NIGHT: Theme = {
  id: 'night',
  name: 'Night',
  ocean: '#03060d',
  oceanShininess: 30,
  land: '#0d1b2a',
  border: '#38e1ff',
  borderOpacity: 0.9,
  hover: '#ff4fd8',
  selected: '#ffd166',
  visited: '#7b5cff',
  wishlist: '#20b8a0',
  pin: '#ff9f1c',
  flight: '#ffd166',
  correct: '#39ff88',
  wrong: '#ff3b5c',
  background: '#000000',
  atmosphere: '#38e1ff',
}

export const VINTAGE: Theme = {
  id: 'vintage',
  name: 'Vintage',
  ocean: '#9fb5a4',
  oceanShininess: 2,
  land: '#ead9b0',
  border: '#6b4f2a',
  borderOpacity: 0.7,
  hover: '#d9824b',
  selected: '#9c3d22',
  visited: '#5f8f6e',
  wishlist: '#7189b8',
  pin: '#a4161a',
  flight: '#6b3a1d',
  correct: '#2f7d3a',
  wrong: '#b83227',
  background: '#120d08',
  atmosphere: '#e8c78f',
}

export const MINIMAL: Theme = {
  id: 'minimal',
  name: 'Minimal',
  ocean: '#dfe6ee',
  oceanShininess: 4,
  land: '#aab6c3',
  border: '#ffffff',
  borderOpacity: 0.9,
  hover: '#1f2937',
  selected: '#2563eb',
  visited: '#0ea5a4',
  wishlist: '#f0a33b',
  pin: '#e11d48',
  flight: '#1f2937',
  correct: '#16a34a',
  wrong: '#dc2626',
  background: '#0b0f14',
  atmosphere: '#ffffff',
}

/**
 * The Earth as seen from space: NASA's Blue Marble, with its sea to shine, its mountains in relief, and its
 * lights at night (all by way of three-globe; the lights kept from its Earth at night by make-night-lights)
 */
export const REALISTIC: Theme = {
  id: 'realistic',
  name: 'Realistic',
  ocean: '#0b2342',
  oceanShininess: 18,
  // Not painted over the picture: it's for the rings around small islands, and what the heat map shades from
  land: '#d8cfb8',
  border: '#ffffff',
  borderOpacity: 0.3,
  hover: '#ffd166',
  selected: '#ffc857',
  visited: '#ff9f1c',
  wishlist: '#c3a6ff',
  pin: '#ff4d4d',
  // Light blue, so places you're going to (tinted with it) stand out from the land
  flight: '#9fd8ff',
  correct: '#7dff9b',
  wrong: '#ff5c5c',
  background: '#02060d',
  atmosphere: '#6fb3ff',
  imagery: { map: earthImage, water: earthWater, relief: earthRelief, tint: 0.45 },
}

export const THEMES: readonly Theme[] = [MIDNIGHT, CLASSIC, VINTAGE, POLITICAL, NIGHT, MINIMAL, REALISTIC]
export const DEFAULT_THEME = MIDNIGHT

export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? DEFAULT_THEME

const darker = (color: string) => '#' + new Color(color).multiplyScalar(0.68).getHexString()

/** Visited states and provinces: a darker shade of the visited color */
export const visitedRegionColor = (theme: Theme) => darker(theme.visited)

/** Visited states of the country pointed at: a darker shade of the hover color */
export const hoveredRegionColor = (theme: Theme) => darker(theme.hover)

/** A place you're going to, not been to yet: its land tinted with the flight color */
export const plannedColor = (theme: Theme, land: string) =>
  '#' + new Color(land).lerp(new Color(theme.flight), 0.5).getHexString()

/** In the replay, places visited again in a year: a darker shade of the color for those first visited then */
export const revisitColor = (theme: Theme) => darker(theme.correct)

/** How far from the land color to the visited color, for 1, 2, 3, and 4 or more visits */
const HEAT_STEPS = [0.35, 0.6, 0.8, 1]
/** The most visits the heat map tells apart: more are shown as many */
export const HEAT_MAX_VISITS = HEAT_STEPS.length

/** A visited country on the heat map: nearer the visited color the more visits it's had */
export function heatColor(theme: Theme, land: string, visits: number) {
  const step = HEAT_STEPS[Math.min(Math.max(visits, 1), HEAT_MAX_VISITS) - 1]
  return '#' + new Color(land).lerp(new Color(theme.visited), step).getHexString()
}

/** The heat map's colors in this design, for 1 visit up to the most it tells apart */
export const heatColors = (theme: Theme) =>
  HEAT_STEPS.map((_, i) => heatColor(theme, typeof theme.land === 'string' ? theme.land : theme.land[0], i + 1))

/** A country's plain land color in this design. */
export function landColor(theme: Theme, mapColor: number) {
  return typeof theme.land === 'string' ? theme.land : theme.land[mapColor % theme.land.length]
}
