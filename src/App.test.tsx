import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { GlobeProps } from 'react-globe.gl'
import App from './App'
import { countries, findCountryAt, tinyPlaces, type CountryFeature } from './countries'
import { LETTER_HUNT_RINGS, TINY_COUNTRIES } from './games/globeView'
import { subsolarPoint } from './globe/sun'
import { capitalOf } from './data/capitals'
import { valueOf } from './games/higherLower'
import { ACHIEVEMENTS } from './visited/achievements'
import { SUN_UPDATE_MS } from './globe/hooks'
import { SETTINGS_KEY } from './explore/useSettings'
import { loadCities } from './data/cities'
import { loadAirports } from './data/airports'
import { loadRegions } from './data/regions'
import {
  DEFAULT_THEME,
  NIGHT,
  POLITICAL,
  REALISTIC,
  heatColor,
  hoveredRegionColor,
  plannedColor,
  revisitColor,
  visitedRegionColor,
} from './globe/themes'
import { dayOf } from './data/plans'
import { INITIAL_VIEW, SCREENSAVER_VIEW } from './globe/interaction'
import { SCREENSAVER_PIN_FADE } from './globe/pinLayer'
import { UPDATE_READY } from './pwa/update'

// WebGL doesn't exist in jsdom, so the globe is replaced by a stand-in that
// exposes what the app passes to it. Screen positions map to places by x.
const { PLACES, PIN_AT, globe, layer, regionLayer, pinLayer, flightLayer, nightLayer, planLayer, sceneObjects } = vi.hoisted(() => {
  const listeners = new Map<string, Set<() => void>>()
  const sceneObjects = new Set<object>()
  const controls = {
    autoRotate: false,
    autoRotateSpeed: 0,
    minDistance: 0,
    addEventListener: (type: string, fn: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
  }
  return {
    PLACES: {
      100: { lat: 56.17, lng: 9.55 }, // Denmark
      200: { lat: 46.6, lng: 2.4 }, // France
      300: { lat: 30, lng: -40 }, // Atlantic Ocean
      400: { lat: -10.49, lng: 105.62 }, // Christmas Island, an Australian territory without a flag
      500: { lat: -10, lng: -52 }, // Brazil
      600: { lat: 36.2, lng: 138.25 }, // Japan
      700: { lat: 0, lng: 37.9 }, // Kenya
      800: { lat: 36.7, lng: -119.4 }, // California, United States
      // Not next to another place: neighboring pixels set how far a pixel is on the globe
      810: { lat: 31, lng: -99 }, // Texas, United States
      // anything else: outer space
    } as Record<number, { lat: number; lng: number }>,
    /** Where pins are, by x, when their city is pinned */
    PIN_AT: { 900: 'Copenhagen' } as Record<number, string>,
    globe: {
      controls: () => controls,
      pointOfView: vi.fn((..._args: unknown[]) => ({ lat: 25, lng: 10, altitude: 1.9 })),
      scene: () => ({ add: (o: object) => sceneObjects.add(o), remove: (o: object) => sceneObjects.delete(o) }),
      camera: () => ({ position: { length: () => 290 }, near: 0.05, updateProjectionMatrix: () => {} }),
      renderer: () => ({ domElement: document.createElement('canvas') }),
      getGlobeRadius: () => 100,
    },
    sceneObjects,
    layer: {
      object: {},
      paint: vi.fn(),
      setSeeThrough: vi.fn(),
      setBorders: vi.fn(),
      setRings: vi.fn(),
      emphasize: vi.fn(),
      dispose: vi.fn(),
    },
    regionLayer: { object: {}, show: vi.fn(), setOutlineColor: vi.fn(), setFillOpacity: vi.fn(), dispose: vi.fn() },
    pinLayer: { object: {}, show: vi.fn(), setColor: vi.fn(), setFade: vi.fn(), dispose: vi.fn() },
    flightLayer: { object: {}, show: vi.fn(), setColors: vi.fn(), tick: vi.fn(), dispose: vi.fn() },
    nightLayer: { object: { night: true }, setSun: vi.fn(), setLights: vi.fn(), setPicture: vi.fn(), dispose: vi.fn() },
    planLayer: { object: {}, show: vi.fn(), setColor: vi.fn(), dispose: vi.fn() },
  }
})

vi.mock('react-globe.gl', () => ({
  default: function FakeGlobe({ ref, onGlobeReady }: GlobeProps & { ref: Ref<unknown> }) {
    useImperativeHandle(ref, () => globe)
    // Like the real globe, fires once after mounting
    const onReady = useRef(onGlobeReady)
    useEffect(() => onReady.current?.(), [])
    return <canvas />
  },
}))
vi.mock('./globe/picking', () => ({
  // x from 2000 to 2400 is a strip across the Caribbean, 0.02° per pixel, where neighboring pixels are neighboring places
  screenToLatLng: (_: unknown, x: number) =>
    PLACES[x] ?? (x >= 2000 && x < 2400 ? { lat: 12.3, lng: -64 + (x - 2000) * 0.02 } : null),
}))
vi.mock('./globe/regionLayer', () => ({ createRegionLayer: () => regionLayer }))
vi.mock('./globe/planLayer', () => ({ createPlanLayer: () => planLayer }))
vi.mock('./globe/nightLayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./globe/nightLayer')>()),
  createNightLayer: () => nightLayer,
}))
vi.mock('./globe/flightLayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./globe/flightLayer')>()),
  createFlightLayer: () => flightLayer,
}))
vi.mock('./globe/pinLayer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./globe/pinLayer')>()),
  createPinLayer: () => pinLayer,
  pinAt: (_: unknown, pins: { city: { name: string } }[], { x }: { x: number }) =>
    pins.find((pin) => pin.city.name === PIN_AT[x]) ?? null,
}))
vi.mock('./globe/countryLayer', () => ({
  createCountryLayer: () => layer,
  createRaisedCountry: (country: { properties: { name: string } }) => ({
    object: { raised: country.properties.name, scale: { setScalar: () => {} } },
    setColor: () => {},
    dispose: () => {},
  }),
}))
// Games ask about a small, known set of countries in a fixed order
// Games ask about a small, known set of countries in a fixed order
const { lastRoundGame } = vi.hoisted(() => ({
  lastRoundGame: { current: null as import('./games/games').RoundGameState | null },
}))
vi.mock('./games/games', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./games/games')>()
  const { countries } = await import('./countries')
  const pool = ['Denmark', 'France', 'Brazil', 'Japan', 'Kenya'].map(
    (name) => countries.find((c) => c.properties.name === name)!,
  )
  return {
    ...actual,
    newRoundGame: (id: import('./games/games').RoundGameId, difficulty: import('./games/games').Difficulty) =>
      (lastRoundGame.current = actual.newRoundGame(id, difficulty, () => 0.5, pool)),
  }
})
const PLACE_OF: Record<string, number> = { Denmark: 100, France: 200, Brazil: 500, Japan: 600, Kenya: 700 }
// "Find the city" asks about the capitals of those countries, in a fixed order
vi.mock('./games/cityGame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./games/cityGame')>()
  const capitals = ['Copenhagen', 'Paris', 'Brasília', 'Tokyo', 'Nairobi']
  return {
    ...actual,
    newCityGame: (level: import('./games/cityGame').CityLevel, cities: import('./data/cities').City[]) =>
      actual.newCityGame(level, cities.filter((c) => c.capital && capitals.includes(c.name)), () => 0.5),
  }
})
/** Where on the stand-in globe each capital's country is */
const CAPITAL_AT: Record<string, number> = { Copenhagen: 100, Paris: 200, Brasília: 500, Tokyo: 600, Nairobi: 700 }

const at = (x: number) => ({ clientX: x, clientY: 0 })
const surface = () => screen.getByTestId('globe')
const hover = (x: number) => fireEvent.pointerMove(surface(), { ...at(x), pointerType: 'mouse' })
const click = (x: number) => {
  fireEvent.pointerDown(surface(), { ...at(x), button: 0 })
  fireEvent.pointerUp(surface(), at(x))
}
const tooltip = () => screen.queryByRole('tooltip')
const countryPanel = () => screen.queryByRole('complementary')
const panelHeading = () => countryPanel()?.querySelector('h2') ?? null
const sidePanel = () => document.getElementById('side-panel')
/** Opens a continent's places under its bar, in the Visited tab */
const openContinent = (continent: string) => userEvent.click(within(sidePanel()!).getByRole('button', { name: continent }))
/** Explore's layers button, opening the designs and the layers, with Explore opened first if it isn't */
const openLayers = async () => {
  if (!screen.queryByRole('button', { name: 'Style and layers' })) await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
  await userEvent.click(screen.getByRole('button', { name: 'Style and layers' }))
}
/** Opens a trip in the Trips list, by what's read out for it: when, its name, and the countries of its flags */
const openTrip = async (name: RegExp) => {
  const header = await waitFor(() => {
    const found = screen.getAllByRole('button', { name }).find((b) => b.classList.contains('trip-header'))
    if (!found) throw new Error(`No trip ${name}`)
    return found
  })
  await userEvent.click(header)
}
/** Opens one of the small cards in the More tab */
const openMore = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'More' }))
  await userEvent.click(within(sidePanel()!).getByRole('button', { name }))
}
/** Names of countries currently raised on the globe */
const raised = () => [...sceneObjects].flatMap((o) => ('raised' in o ? [o.raised as string] : []))
const flag = () => screen.queryByRole('img', { name: /^Flag of/ })

/** Countries currently not in the plain land color, replayed from paint() calls */
function painted() {
  const colors: Record<string, string> = {}
  for (const [country, color] of layer.paint.mock.calls) colors[country.properties.name] = color
  return Object.fromEntries(Object.entries(colors).filter(([, color]) => color !== DEFAULT_THEME.land))
}

const denmark = countries.find((c) => c.properties.name === 'Denmark')!

describe('App', () => {
  // The region shapes are big; load them once up front rather than inside the first test that needs them
  beforeAll(() => Promise.all([loadRegions(), loadCities()]), 20_000)

  beforeEach(() => {
    globe.pointOfView.mockClear()
    layer.paint.mockClear()
    layer.setBorders.mockClear()
    regionLayer.show.mockClear()
    pinLayer.show.mockClear()
  })

  it("keeps password managers off every text box: none of them is a login", async () => {
    render(<App />)
    for (const tab of ['Visited', 'Games', 'More']) {
      await userEvent.click(screen.getByRole('button', { name: tab }))
      for (const box of document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])')) {
        if ((box as HTMLInputElement).readOnly) continue
        expect(box, box.outerHTML).toHaveAttribute('autocomplete', 'off')
        expect(box.getAttribute('name'), box.outerHTML).toMatch(/-search$/)
      }
    }
  })

  it('shows the brand and how to use the globe', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Meridian' })).toBeInTheDocument()
    expect(screen.getByText('drag to spin')).toBeInTheDocument()
  })

  it('starts from the initial view', () => {
    render(<App />)
    expect(globe.pointOfView).toHaveBeenCalledWith({ lat: 25, lng: 10, altitude: 2.2 })
  })

  describe('hovering', () => {
    it('shows the country name and colors it without raising it', async () => {
      render(<App />)
      hover(100)
      await waitFor(() => expect(tooltip()).toHaveTextContent('Denmark'))
      await waitFor(() => expect(painted()).toEqual({ Denmark: DEFAULT_THEME.hover }))
      expect(raised()).toEqual([])
      expect(surface()).toHaveStyle({ cursor: 'pointer' })
    })

    it("shows the country's flag", async () => {
      render(<App />)
      expect(flag()).not.toBeInTheDocument()
      hover(100)
      await waitFor(() => expect(flag()).toHaveAccessibleName('Flag of Denmark'))
      expect(flag()).toHaveAttribute('src', expect.stringMatching(/dk\.svg/))
    })

    it('shows no flag for places without one', async () => {
      render(<App />)
      hover(400)
      await waitFor(() => expect(tooltip()).toHaveTextContent('Australian Indian Ocean Territories'))
      expect(flag()).not.toBeInTheDocument()
    })

    it('follows the pointer from country to country', async () => {
      render(<App />)
      hover(100)
      await waitFor(() => expect(tooltip()).toHaveTextContent('Denmark'))
      hover(200)
      await waitFor(() => expect(tooltip()).toHaveTextContent('France'))
      await waitFor(() => expect(painted()).toEqual({ France: DEFAULT_THEME.hover }))
      expect(flag()).toHaveAccessibleName('Flag of France')
    })

    it('shows nothing over the ocean or when leaving the globe', async () => {
      render(<App />)
      hover(100)
      await waitFor(() => expect(tooltip()).toBeVisible())
      hover(300)
      await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
      await waitFor(() => expect(painted()).toEqual({}))
      expect(flag()).not.toBeInTheDocument()

      hover(100)
      await waitFor(() => expect(tooltip()).toBeVisible())
      fireEvent.pointerLeave(surface())
      await waitFor(() => expect(tooltip()).not.toBeInTheDocument())
      expect(surface()).toHaveStyle({ cursor: 'grab' })
    })

    it('forgives a near miss on a tiny island', async () => {
      const grenada = countries.find((c) => c.properties.name === 'Grenada')!
      const [lng] = grenada.properties.centroid
      // 7 pixels east of Grenada's marker (its ring is 12 px across), over the sea
      const x = 2000 + Math.round((lng + 64) / 0.02) + 7
      expect(findCountryAt(12.3, -64 + (x - 2000) * 0.02)).toBeNull()
      render(<App />)
      hover(x)
      await waitFor(() => expect(tooltip()).toHaveTextContent('Grenada'))
      click(x)
      expect(panelHeading()).toHaveTextContent('Grenada')
    })

    it('does not reach islands too far from the pointer', async () => {
      render(<App />)
      hover(2000) // 64°W, open sea between the islands
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(tooltip()).not.toBeInTheDocument()
    })

    it('ignores touch, which has no hover', async () => {
      render(<App />)
      fireEvent.pointerMove(surface(), { ...at(100), pointerType: 'touch' })
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(tooltip()).not.toBeInTheDocument()
    })
  })

  describe('clicking', () => {
    it('opens the panel for the clicked country', () => {
      render(<App />)
      click(100)
      expect(panelHeading()).toHaveTextContent('Denmark')
    })

    it('flies the camera to the country', () => {
      render(<App />)
      click(100)
      const [lng, lat] = denmark.properties.centroid
      expect(globe.pointOfView).toHaveBeenLastCalledWith(
        { lat, lng, altitude: 1.8 },
        expect.any(Number),
      )
    })

    it('raises only the selected country, not the hovered one', async () => {
      render(<App />)
      click(100)
      hover(200)
      await waitFor(() => expect(painted()).toEqual({ France: DEFAULT_THEME.hover }))
      expect(raised()).toEqual(['Denmark'])
    })

    it('lowers the country again when it is deselected', () => {
      render(<App />)
      click(100)
      expect(raised()).toEqual(['Denmark'])
      click(300)
      expect(raised()).toEqual([])
    })

    it('switches to another country', () => {
      render(<App />)
      click(100)
      click(200)
      expect(panelHeading()).toHaveTextContent('France')
    })

    it('does not select anything when dragging to spin the globe', () => {
      render(<App />)
      fireEvent.pointerDown(surface(), { ...at(100), button: 0 })
      fireEvent.pointerUp(surface(), at(200))
      expect(panelHeading()).not.toBeInTheDocument()
      expect(globe.pointOfView).not.toHaveBeenCalledWith(expect.anything(), expect.any(Number))
    })

    it('ignores right clicks', () => {
      render(<App />)
      fireEvent.pointerDown(surface(), { ...at(100), button: 2 })
      fireEvent.pointerUp(surface(), at(100))
      expect(panelHeading()).not.toBeInTheDocument()
    })
  })

  describe('closing the panel', () => {
    it.each([
      ['clicking the ocean', () => click(300)],
      ['clicking outer space', () => click(999)],
      ['the close button', () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))],
      ['pressing Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
    ])('closes on %s', (_, close) => {
      render(<App />)
      click(100)
      expect(panelHeading()).toBeInTheDocument()
      act(close)
      expect(panelHeading()).not.toBeInTheDocument()
    })
  })

  describe('top bar and Explore', () => {
    it('starts with Explore open, as a magnifying glass and a layers button', () => {
      render(<App />)
      expect(sidePanel()).toHaveAccessibleName('Explore')
      expect(screen.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByRole('button', { name: 'Search the atlas' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Style and layers' })).toBeInTheDocument()
      expect(within(sidePanel()!).queryByRole('switch')).not.toBeInTheDocument()
      expect(screen.queryByRole('region', { name: /Games/ })).not.toBeInTheDocument()
    })

    it('shows where the globe is looking, and how many places are visited', async () => {
      render(<App />)
      expect(await screen.findByText('25.0°N · 10.0°E')).toBeInTheDocument()
      expect(screen.getByText('0 visited')).toBeInTheDocument()
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      expect(screen.getByText('1 visited')).toBeInTheDocument()
    })

    it('finds a country with the atlas search and shows it', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Search the atlas' }))
      await userEvent.type(screen.getByRole('searchbox', { name: 'Search the atlas' }), 'denm{Enter}')
      expect(panelHeading()).toHaveTextContent('Denmark')
      expect(globe.pointOfView).toHaveBeenLastCalledWith(expect.objectContaining({ lat: expect.any(Number) }), expect.any(Number))
    })

    it("has the designs and the layers under Explore's layers button, and no Design tab", async () => {
      render(<App />)
      expect(screen.getAllByRole('button', { name: /^(Explore|Visited|Games|Design|More)$/ }).map((b) => b.textContent)).toEqual([
        'Explore',
        'Visited',
        'Games',
        'More',
      ])
      expect(within(sidePanel()!).queryByRole('group', { name: 'Design' })).not.toBeInTheDocument()
      await openLayers()
      expect(within(sidePanel()!).getByRole('group', { name: 'Design' })).toBeInTheDocument()
      expect(within(sidePanel()!).getByRole('switch', { name: /City pins/ })).toBeChecked()
    })

    it('has the achievements, comparing and the settings in the More tab, and only the design and layers in Design', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'More' }))
      expect(sidePanel()).toHaveAccessibleName('More')
      const panel = within(sidePanel()!)
      await userEvent.click(panel.getByRole('button', { name: 'Achievements' }))
      expect(panel.getByRole('region', { name: 'Achievements' })).toHaveTextContent('First stamp')
      await userEvent.click(panel.getByRole('button', { name: '← Back' }))
      await userEvent.click(panel.getByRole('button', { name: 'Compare with a friend' }))
      expect(panel.getByRole('textbox', { name: "Your friend's link" })).toBeInTheDocument()
      await userEvent.click(panel.getByRole('button', { name: '← Back' }))
      await userEvent.click(panel.getByRole('button', { name: 'Backup' }))
      expect(panel.getByRole('button', { name: 'Download backup' })).toBeInTheDocument()
      await userEvent.click(panel.getByRole('button', { name: '← Back' }))
      await userEvent.click(panel.getByRole('button', { name: 'App' }))
      expect(panel.getByRole('region', { name: 'App' })).toHaveTextContent('works without internet')
      await userEvent.click(panel.getByRole('button', { name: '← Back' }))
      await userEvent.click(panel.getByRole('button', { name: 'Screensaver' }))
      expect(panel.getByRole('region', { name: /Screensaver/ })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      expect(within(sidePanel()!).queryByRole('region', { name: /Screensaver/ })).not.toBeInTheDocument()
      expect(within(sidePanel()!).queryByRole('region', { name: /Backup/ })).not.toBeInTheDocument()
    })

    it('has just your countries, trips and years in the Visited tab', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      expect(within(sidePanel()!).getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual([
        'Countries',
        'Trips',
        'Years',
      ])
    })

    it('opens More to the list again after another tab', async () => {
      render(<App />)
      await openMore('Backup')
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('button', { name: 'More' }))
      expect(within(sidePanel()!).getByRole('list', { name: 'Settings' })).toHaveTextContent('Backup')
      expect(within(sidePanel()!).queryByRole('button', { name: 'Download backup' })).not.toBeInTheDocument()
    })

    it('switches design with the tiny globes', async () => {
      render(<App />)
      await openLayers()
      await userEvent.click(within(screen.getByRole('group', { name: 'Design' })).getByRole('button', { name: 'Night' }))
      expect(layer.setBorders).toHaveBeenLastCalledWith(NIGHT.border, NIGHT.borderOpacity)
      expect(screen.getByRole('region', { name: 'Style' })).toHaveTextContent(NIGHT.name)
    })
  })

  describe("the screensaver's preview", () => {
    const openPreview = async () => {
      await openMore('Screensaver')
      await userEvent.click(screen.getByRole('button', { name: 'Preview' }))
    }

    it('shows just the globe, from the screensaver\'s view, with a way out shown as it opens', async () => {
      render(<App />)
      await openPreview()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(sidePanel()).not.toBeInTheDocument()
      expect(screen.getByTestId('globe').parentElement).toHaveClass('screensaver')
      expect(globe.pointOfView).toHaveBeenLastCalledWith(SCREENSAVER_VIEW, 1000)
      expect(pinLayer.setFade).toHaveBeenLastCalledWith(SCREENSAVER_PIN_FADE)
      expect(screen.getByRole('button', { name: /^Exit preview/ })).toHaveClass('shown')
    })

    it('goes back to More, as it was, with the button or Escape, and closes nothing', async () => {
      const close = vi.spyOn(window, 'close')
      render(<App />)
      await openPreview()
      await userEvent.click(screen.getByRole('button', { name: /^Exit preview/ }))
      expect(sidePanel()).toHaveAccessibleName('More')
      expect(screen.getByRole('region', { name: 'Screensaver' })).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Preview' }))
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(sidePanel()).toHaveAccessibleName('More') // Escape left the preview, not the panel
      expect(close).not.toHaveBeenCalled()
    })
  })

  describe('as a screensaver', () => {
    beforeEach(() => window.history.replaceState(null, '', '/?screensaver'))
    afterEach(() => window.history.replaceState(null, '', '/'))

    it('has no way out, as a real screensaver', () => {
      render(<App />)
      expect(screen.queryByRole('button', { name: /Exit preview/ })).not.toBeInTheDocument()
    })

    it('looks at a balanced view, just north of the equator, so the far south shows too', () => {
      render(<App />)
      expect(globe.pointOfView).toHaveBeenCalledWith(SCREENSAVER_VIEW)
      expect(SCREENSAVER_VIEW.lat).toBeLessThan(INITIAL_VIEW.lat)
    })

    it('keeps pins until closer to the edge', () => {
      render(<App />)
      expect(pinLayer.setFade).toHaveBeenLastCalledWith(SCREENSAVER_PIN_FADE)
    })

    it('shows just the globe', () => {
      render(<App />)
      expect(screen.getByTestId('globe')).toBeInTheDocument()
      expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading')).not.toBeInTheDocument()
      expect(sidePanel()).not.toBeInTheDocument()
    })

    it('ignores the pointer', async () => {
      render(<App />)
      hover(100)
      click(100)
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(countryPanel()).not.toBeInTheDocument()
      expect(tooltip()).not.toBeInTheDocument()
    })

    it('shows your visited places', async () => {
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark']))
      render(<App />)
      await waitFor(() => expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited }))
    })
  })

  describe('menu', () => {
    it('opens a side panel and closes it again', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      expect(sidePanel()).toHaveAccessibleName('Visited')
      await userEvent.click(within(sidePanel()!).getByRole('button', { name: 'Close panel' }))
      // Back to Explore: there's always a tab
      expect(sidePanel()).toHaveAccessibleName('Explore')
      expect(screen.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('opens in Explore on a phone too, never with no tab', () => {
      const matchMedia = window.matchMedia
      window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query })) as typeof window.matchMedia
      try {
        render(<App />)
        expect(screen.getByRole('button', { name: 'Explore' })).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('button', { name: 'Search the atlas' })).toBeInTheDocument()
      } finally {
        window.matchMedia = matchMedia
      }
    })

    it('switches between panels', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      expect(sidePanel()).toHaveAccessibleName('Games')
    })

    it('closes the country panel first, then the side panel, on Escape', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      click(100)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(countryPanel()).not.toBeInTheDocument()
      expect(sidePanel()).toHaveAccessibleName('Visited')
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(sidePanel()).toHaveAccessibleName('Explore')
    })
  })

  describe('visited countries', () => {
    it('marks the selected country as visited and colors it on the globe', async () => {
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited })
      expect(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' })).toBeInTheDocument()

      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' }))
      expect(painted()).toEqual({})
    })

    it('adds countries from the Visited panel', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.type(screen.getByRole('searchbox'), 'japan{Enter}')
      expect(within(sidePanel()!).getByRole('list', { name: 'Visited in Asia' })).toHaveTextContent('Japan') // its continent opened
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.visited })
    })

    it('shows a visited country on the globe when picked from the list', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.type(screen.getByRole('searchbox'), 'denmark{Enter}')
      await userEvent.click(within(sidePanel()!).getByRole('button', { name: 'Denmark' }))
      expect(panelHeading()).toHaveTextContent('Denmark')
      expect(globe.pointOfView).toHaveBeenLastCalledWith(expect.objectContaining({ altitude: 1.8 }), expect.any(Number))
    })

    it('keeps when you went, once visited, and shows the latest visit in the Visited list', async () => {
      render(<App />)
      click(100)
      expect(within(countryPanel()!).queryByRole('region', { name: 'Visits' })).not.toBeInTheDocument()
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      const visits = within(within(countryPanel()!).getByRole('region', { name: 'Visits' }))
      await userEvent.selectOptions(visits.getByRole('combobox', { name: 'Year' }), '2019')
      await userEvent.click(visits.getByRole('button', { name: 'Add visit' }))
      await userEvent.selectOptions(visits.getByRole('combobox', { name: 'Month' }), 'June')
      await userEvent.click(visits.getByRole('button', { name: 'Add visit' }))
      expect(visits.getByRole('list', { name: 'Visits' })).toHaveTextContent('Jun 20192019')

      await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Visited' }))
      await openContinent('Europe')
      expect(screen.getByRole('button', { name: /^Denmark/ })).toHaveTextContent('2 visits, last Jun 2019')
    })

    it('keeps a note on a visit, shown in the panel and in that year', async () => {
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark']))
      localStorage.setItem('countries-app.visit-dates', JSON.stringify({ Denmark: ['2019-06'] }))
      const first = render(<App />)
      click(100)
      const visits = within(within(countryPanel()!).getByRole('region', { name: 'Visits' }))
      await userEvent.click(visits.getByRole('button', { name: 'Add a note to the visit in Jun 2019' }))
      await userEvent.type(visits.getByRole('textbox', { name: 'Note on the visit in Jun 2019' }), 'Roskilde Festival{Enter}')
      expect(visits.getByRole('list', { name: 'Visits' })).toHaveTextContent('Jun 2019Roskilde Festival')
      first.unmount()

      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Years' }))
      expect(screen.getByRole('button', { name: /^Denmark/ })).toHaveTextContent('DenmarkFirst visit · Roskilde Festival')
    })

    it('remembers visited countries after a reload', async () => {
      const first = render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      first.unmount()
      layer.paint.mockClear()

      render(<App />)
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited })
    })
  })

  describe('visit heat map', () => {
    const heat = (visits: number) => heatColor(DEFAULT_THEME, DEFAULT_THEME.land as string, visits)
    const legend = () => screen.queryByRole('figure', { name: 'Visits' })
    beforeEach(() => {
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark', 'Japan', 'France']))
      localStorage.setItem(
        'countries-app.visit-dates',
        JSON.stringify({ Denmark: ['2019', '2023-05'], France: ['2016', '2018', '2020', '2022', '2024'] }),
      )
    })

    it('shades visited countries by their visits once switched on, with a legend; no dates counts once', async () => {
      render(<App />)
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited, Japan: DEFAULT_THEME.visited, France: DEFAULT_THEME.visited })
      expect(legend()).not.toBeInTheDocument()

      await openLayers()
      await userEvent.click(screen.getByRole('switch', { name: /Heat map by visits/ }))
      expect(painted()).toEqual({ Denmark: heat(2), Japan: heat(1), France: heat(4) })
      expect(legend()).toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ showVisitHeat: true })
    })

    it('is offered only while visited countries are shown', async () => {
      render(<App />)
      await openLayers()
      await userEvent.click(screen.getByRole('switch', { name: /Visited countries/ }))
      expect(screen.queryByRole('switch', { name: /Heat map by visits/ })).not.toBeInTheDocument()
    })

    it('gives way to a year shown in the Visited tab', async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showVisitHeat: true }))
      render(<App />)
      expect(legend()).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Years' }))
      // 2024, the newest: France, been before, so in the darker green, not a shade of the heat map
      expect(painted()).toEqual({ France: revisitColor(DEFAULT_THEME) })
      expect(legend()).not.toBeInTheDocument()
    })
  })

  describe('comparing with a friend', () => {
    const key = () => screen.queryByRole('figure', { name: 'Compare' })
    beforeEach(() => {
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark', 'France']))
      localStorage.setItem('countries-app.wishlist', JSON.stringify(['Brazil']))
    })

    it("colors where you've both been, and only your friend, from their link pasted in; switches off", async () => {
      const { shareLink } = await import('./visited/friend')
      render(<App />)
      expect(painted()).toMatchObject({ Brazil: DEFAULT_THEME.wishlist })
      await openMore('Compare with a friend')
      await userEvent.type(
        screen.getByRole('textbox', { name: "Your friend's link" }),
        shareLink('Anna', ['Denmark', 'Japan'], 'https://m.test/'),
      )
      await userEvent.click(screen.getByRole('button', { name: 'Compare' }))
      // Both: green; only Anna: her color; only you: yours. Your wishlist steps aside
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.correct, Japan: DEFAULT_THEME.wishlist, France: DEFAULT_THEME.visited })
      expect(key()).toBeInTheDocument()
      expect(JSON.parse(localStorage.getItem('countries-app.friend')!)).toEqual({ name: 'Anna', places: ['Denmark', 'Japan'] })

      await userEvent.click(screen.getByRole('switch', { name: 'Show Anna on the globe' }))
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited, France: DEFAULT_THEME.visited, Brazil: DEFAULT_THEME.wishlist })
      expect(key()).not.toBeInTheDocument()
    })

    it("opens on the comparison when a friend's link was opened", () => {
      localStorage.setItem('countries-app.friend', JSON.stringify({ name: 'Anna', places: ['Japan'] }))
      render(<App compareOnOpen />)
      expect(sidePanel()).toHaveAccessibleName('More')
      expect(screen.getByRole('region', { name: 'Compare' })).toHaveTextContent('with Anna')
      expect(painted()).toMatchObject({ Japan: DEFAULT_THEME.wishlist, Denmark: DEFAULT_THEME.visited })
      expect(key()).toBeInTheDocument()
    })

    it('takes a place off your wishlist from the comparison, as well as putting one on', async () => {
      localStorage.setItem('countries-app.friend', JSON.stringify({ name: 'Anna', places: ['Brazil', 'Japan'] }))
      render(<App />)
      await openMore('Compare with a friend')
      await userEvent.click(screen.getByRole('button', { name: 'Take Brazil off your wishlist' }))
      expect(JSON.parse(localStorage.getItem('countries-app.wishlist')!)).toEqual([])
      await userEvent.click(screen.getByRole('button', { name: 'Add Japan to your wishlist' }))
      expect(JSON.parse(localStorage.getItem('countries-app.wishlist')!)).toEqual(['Japan'])
    })

    it('shows only countries while comparing is open, and your friend only there', async () => {
      const copenhagen = (await loadCities()).find((c) => c.name === 'Copenhagen' && c.place === 'DK')!
      await loadAirports()
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark', 'France', 'United States']))
      localStorage.setItem('countries-app.visited-regions', JSON.stringify(['US-CA']))
      localStorage.setItem('countries-app.visited-cities', JSON.stringify([copenhagen.id]))
      localStorage.setItem('countries-app.flights', JSON.stringify([{ id: 'a', from: 'CPH', to: 'CDG' }]))
      localStorage.setItem('countries-app.friend', JSON.stringify({ name: 'Anna', places: ['Japan'] }))
      const states = () =>
        [...((regionLayer.show.mock.calls.at(-1)?.[0] ?? new Map()) as Map<{ properties: { name: string } }, string>).keys()].map(
          (r) => r.properties.name,
        )
      const pins = () => ((pinLayer.show.mock.calls.at(-1)?.[0] ?? []) as { city: { name: string } }[]).map((p) => p.city.name)
      const flights = () =>
        ((flightLayer.show.mock.calls.at(-1)?.[0] ?? []) as { from: { code: string }; to: { code: string } }[]).map(
          (line) => `${line.from.code}-${line.to.code}`,
        )
      /** Your states, city pins and flights all on the globe, and Anna not */
      const yoursShown = () => {
        expect(states()).toEqual(['California'])
        expect(pins()).toEqual(['Copenhagen'])
        expect(flights()).toEqual(['CPH-CDG'])
        expect(painted().Japan).toBeUndefined()
        expect(key()).not.toBeInTheDocument()
      }
      render(<App />)
      await waitFor(() => expect(flights()).toEqual(['CPH-CDG']))
      yoursShown()

      // Comparing shows just countries, with Anna switched off as well
      await openMore('Compare with a friend')
      expect(states()).toEqual([])
      expect(pins()).toEqual([])
      expect(flights()).toEqual([])
      expect(painted()).toEqual({
        Denmark: DEFAULT_THEME.visited,
        France: DEFAULT_THEME.visited,
        'United States': DEFAULT_THEME.visited,
        Brazil: DEFAULT_THEME.wishlist,
      })
      await userEvent.click(screen.getByRole('switch', { name: 'Show Anna on the globe' }))
      expect(painted().Japan).toBe(DEFAULT_THEME.wishlist)
      expect(key()).toBeInTheDocument()

      // Going back, or another tab, puts Anna away, though she stays switched on for comparing
      await userEvent.click(screen.getByRole('button', { name: '← Back' }))
      yoursShown()
      await userEvent.click(within(sidePanel()!).getByRole('button', { name: 'Compare with a friend' }))
      expect(painted().Japan).toBe(DEFAULT_THEME.wishlist)
      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      yoursShown()
      await openMore('Compare with a friend')
      expect(painted().Japan).toBe(DEFAULT_THEME.wishlist)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(sidePanel()).toHaveAccessibleName('Explore')
      yoursShown()
    })

    it('keeps your friend after a reload, but off the globe until switched on', () => {
      localStorage.setItem('countries-app.friend', JSON.stringify({ name: 'Anna', places: ['Japan'] }))
      render(<App />)
      expect(painted().Japan).toBeUndefined()
      expect(key()).not.toBeInTheDocument()
    })
  })

  describe('a new version', () => {
    afterEach(() => Reflect.deleteProperty(navigator, 'serviceWorker'))

    it('says when a new version is ready, and reloads into it, or not now', async () => {
      const pages = new EventTarget()
      Object.defineProperty(navigator, 'serviceWorker', { value: pages, configurable: true })
      const worker = { postMessage: vi.fn() }
      render(<App />)
      expect(screen.queryByText('A new version is ready')).not.toBeInTheDocument()
      act(() => {
        window.dispatchEvent(new CustomEvent(UPDATE_READY, { detail: worker }))
      })
      expect(screen.getByText('A new version is ready')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
      expect(worker.postMessage).toHaveBeenCalledWith('skip-waiting')

      await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
      expect(screen.queryByText('A new version is ready')).not.toBeInTheDocument()
    })
  })

  describe('undo', () => {
    const note = () => screen.queryByText(/^(Removed|Took) /)
    const saved = (key: string) => JSON.parse(localStorage.getItem(`countries-app.${key}`) ?? 'null')
    beforeAll(() => loadAirports(), 20_000)
    beforeEach(() => localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark', 'France'])))

    it('puts a country removed from the list back, from the note or with Cmd+Z', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await openContinent('Europe')
      await userEvent.click(screen.getByRole('button', { name: 'Remove Denmark' }))
      expect(note()).toHaveTextContent('Removed Denmark')
      expect(painted()).toEqual({ France: DEFAULT_THEME.visited })
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited, France: DEFAULT_THEME.visited })
      expect(note()).not.toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'Remove France' }))
      fireEvent.keyDown(window, { key: 'z', metaKey: true })
      expect(saved('visited')).toEqual(expect.arrayContaining(['Denmark', 'France']))
      expect(note()).not.toBeInTheDocument()
    })

    it("puts back a country unmarked in its panel, and a place taken off the wishlist", async () => {
      localStorage.setItem('countries-app.wishlist', JSON.stringify(['Peru']))
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' }))
      expect(note()).toHaveTextContent('Removed Denmark')
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' })).toHaveAttribute('aria-pressed', 'true')

      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('button', { name: 'Take Peru off your wishlist' }))
      expect(note()).toHaveTextContent('Took Peru off your wishlist')
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('wishlist')).toEqual(['Peru'])
    })

    it('puts back a visit with its note', async () => {
      localStorage.setItem('countries-app.visit-dates', JSON.stringify({ Denmark: ['2019-06', '2023'] }))
      localStorage.setItem('countries-app.visit-notes', JSON.stringify({ Denmark: { '2019-06': 'Midsummer' } }))
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Remove the visit in Jun 2019' }))
      expect(note()).toHaveTextContent('Removed the visit to Denmark in Jun 2019')
      expect(saved('visit-notes')).toEqual({})
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('visit-dates').Denmark).toEqual(expect.arrayContaining(['2019-06', '2023']))
      expect(saved('visit-notes')).toEqual({ Denmark: { '2019-06': 'Midsummer' } })
    })

    it('puts back a city', async () => {
      const copenhagen = (await loadCities()).find((c) => c.name === 'Copenhagen' && c.place === 'DK')!
      localStorage.setItem('countries-app.visited-cities', JSON.stringify([copenhagen.id]))
      render(<App />)
      click(100)
      await userEvent.click(await within(countryPanel()!).findByRole('button', { name: 'Remove Copenhagen' }))
      expect(note()).toHaveTextContent('Removed Copenhagen')
      expect(saved('visited-cities')).toEqual([])
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('visited-cities')).toEqual([copenhagen.id])
    })

    it('puts a flight back where it was in the order, which trips are told apart by', async () => {
      const flights = [
        { id: 'a', from: 'CPH', to: 'BKK' },
        { id: 'b', from: 'BKK', to: 'LHR' },
        { id: 'c', from: 'LHR', to: 'CPH' },
      ]
      localStorage.setItem('countries-app.flights', JSON.stringify(flights))
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Trips' }))
      await openTrip(/Thailand United Kingdom/)
      await userEvent.click(await screen.findByRole('button', { name: 'Remove the flight from Bangkok to London' }))
      expect(note()).toHaveTextContent('Removed the flight from Bangkok to London')
      expect(saved('flights').map((f: { id: string }) => f.id)).toEqual(['a', 'c'])
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('flights')).toEqual(flights)
    })

    it('puts back a friend removed', async () => {
      localStorage.setItem('countries-app.friend', JSON.stringify({ name: 'Anna', places: ['Japan'] }))
      render(<App />)
      await openMore('Compare with a friend')
      await userEvent.click(screen.getByRole('button', { name: 'Remove Anna' }))
      expect(saved('friend')).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('friend')).toEqual({ name: 'Anna', places: ['Japan'] })
    })

    it('offers to undo only the last removal', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await openContinent('Europe')
      await userEvent.click(screen.getByRole('button', { name: 'Remove Denmark' }))
      await userEvent.click(screen.getByRole('button', { name: 'Remove France' }))
      expect(note()).toHaveTextContent('Removed France')
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('visited')).toEqual(['France'])
    })
  })

  describe('upcoming trips', () => {
    const saved = (key: string) => JSON.parse(localStorage.getItem(`countries-app.${key}`) ?? 'null')
    /** A day this many days from now */
    const inDays = (n: number) => {
      const now = new Date()
      return dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n))
    }
    const outlined = () => ((planLayer.show.mock.calls.at(-1)?.[0] ?? []) as CountryFeature[]).map((c) => c.properties.name)
    beforeAll(() => loadAirports(), 20_000)
    beforeEach(() => planLayer.show.mockClear())

    it('plans a visit from its panel: tinted and outlined on the globe, counted down to in the Visited tab', async () => {
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Plan a visit' }))
      fireEvent.change(within(countryPanel()!).getByLabelText("The day you're going"), { target: { value: inDays(23) } })
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Done' }))
      expect(within(countryPanel()!).getByText(/^Going/)).toHaveTextContent(/in 23 days$/)
      expect(saved('plans')).toEqual({ Denmark: inDays(23) })
      expect(painted()).toEqual({ Denmark: plannedColor(DEFAULT_THEME, DEFAULT_THEME.land as string) })
      expect(outlined()).toEqual(['Denmark'])

      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      expect(screen.getByRole('list', { name: 'Upcoming' })).toHaveTextContent(/Denmark.*in 23 days/)
      await userEvent.click(screen.getByRole('button', { name: 'Not going to Denmark after all' }))
      expect(saved('plans')).toEqual({})
      expect(outlined()).toEqual([])
      expect(screen.getByText('Not going to Denmark')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('plans')).toEqual({ Denmark: inDays(23) })
    })

    it('puts a place in your atlas when the day comes, with the visit, or takes it back if you did not go', async () => {
      localStorage.setItem('countries-app.plans', JSON.stringify({ Peru: inDays(0), Japan: inDays(5) }))
      localStorage.setItem('countries-app.wishlist', JSON.stringify(['Peru']))
      render(<App />)
      await waitFor(() => expect(saved('plans')).toEqual({ Japan: inDays(5) }))
      expect(saved('visited')).toEqual(['Peru'])
      expect(saved('visit-dates')).toEqual({ Peru: [inDays(0).slice(0, 7)] })
      expect(saved('wishlist')).toEqual([])
      expect(screen.getByText('Welcome to Peru! In your visited atlas now')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(saved('visited')).toEqual([])
      expect(saved('visit-dates')).toEqual({})
      expect(saved('wishlist')).toEqual(['Peru'])
    })

    it("draws a flight booked dashed, with no plane, and doesn't count it yet", async () => {
      const nextYear = new Date().getFullYear() + 1
      localStorage.setItem(
        'countries-app.flights',
        JSON.stringify([
          { id: 'a', from: 'CPH', to: 'BKK' },
          { id: 'b', from: 'CPH', to: 'NRT', date: `${nextYear}-03` },
        ]),
      )
      render(<App />)
      const lines = () =>
        ((flightLayer.show.mock.calls.at(-1)?.[0] ?? []) as { key: string; upcoming?: boolean }[]).map(
          (line) => `${line.key}${line.upcoming ? ' (to come)' : ''}`,
        )
      await waitFor(() => expect(lines()).toEqual(['a', 'upcoming-b (to come)']))
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Trips' }))
      expect(screen.getByText('Flights', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
      // Its trip, first, counted down to, with the flag of where it goes
      const [booked] = document.querySelectorAll<HTMLElement>('.trip-header')
      expect(booked).toHaveTextContent(/^Mar \d{4} · in \d+ months$/)
      expect(within(booked).getByRole('img', { name: 'Japan' })).toBeInTheDocument()
    })
  })

  describe('wishlist', () => {
    const wishes = () => JSON.parse(localStorage.getItem('countries-app.wishlist') ?? '[]')

    it('colors a country put on the wishlist from its panel, and takes it off once visited', async () => {
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to wishlist' }))
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.wishlist })
      expect(within(countryPanel()!).getByRole('button', { name: 'On your wishlist' })).toBeInTheDocument()

      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited })
      expect(wishes()).toEqual([])
      expect(within(countryPanel()!).queryByRole('button', { name: /wishlist/ })).not.toBeInTheDocument()
    })

    it('lists the wishlist in the Visited tab, where "Been there" moves a place to the visited atlas', async () => {
      localStorage.setItem('countries-app.wishlist', JSON.stringify(['Japan', 'Peru']))
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      const list = within(screen.getByRole('list', { name: 'Wishlist' }))
      expect(list.getAllByRole('listitem').map((li) => li.querySelector('.row-name')!.textContent)).toEqual(['Japan', 'Peru'])

      await userEvent.click(list.getByRole('button', { name: 'Been to Japan: add it to your visited atlas' }))
      expect(within(sidePanel()!).getByRole('list', { name: 'Visited in Asia' })).toHaveTextContent('Japan')
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.visited, Peru: DEFAULT_THEME.wishlist })
      expect(wishes()).toEqual(['Peru'])
    })

    it('takes a place off when it is added from the search', async () => {
      localStorage.setItem('countries-app.wishlist', JSON.stringify(['Denmark']))
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.type(screen.getByRole('searchbox', { name: 'Add a country' }), 'denmark{Enter}')
      expect(wishes()).toEqual([])
      expect(screen.queryByRole('list', { name: 'Wishlist' })).not.toBeInTheDocument()
    })

    it('is hidden with its layer off, while a year is shown, and in games', async () => {
      localStorage.setItem('countries-app.wishlist', JSON.stringify(['Peru']))
      localStorage.setItem('countries-app.visited', JSON.stringify(['Japan']))
      localStorage.setItem('countries-app.visit-dates', JSON.stringify({ Japan: ['2024'] }))
      render(<App />)
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.visited, Peru: DEFAULT_THEME.wishlist })

      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Years' }))
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.correct })
      await userEvent.click(screen.getByRole('tab', { name: 'Countries' }))

      await openLayers()
      await userEvent.click(within(sidePanel()!).getByRole('switch', { name: /Wishlist/ }))
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.visited })
      await userEvent.click(within(sidePanel()!).getByRole('switch', { name: /Wishlist/ }))
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.visited, Peru: DEFAULT_THEME.wishlist })

      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Flag quiz/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Easy/ }))
      expect(painted()).toEqual({})
    })
  })

  describe('achievements', () => {
    // The note waits for the cities and airports, so what they make count isn't taken for something you did
    const loaded = async () => {
      await act(() => Promise.all([loadCities(), loadAirports()]))
      await act(async () => {})
    }
    const note = () => screen.queryByRole('button', { name: /^Achievement unlocked/ })

    it('tells you when you earn one, and opens them all from the note', async () => {
      render(<App />)
      await loaded()
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.type(screen.getByRole('searchbox', { name: 'Add a country' }), 'denmark{Enter}')
      expect(note()).toHaveTextContent('Achievement unlockedFirst stampYour first country')

      await userEvent.click(note()!)
      expect(note()).not.toBeInTheDocument()
      expect(sidePanel()).toHaveAccessibleName('More')
      expect(screen.getByRole('region', { name: 'Achievements' })).toBeInTheDocument()
      expect(screen.getByText('First stamp', { selector: '.achievement-title' }).closest('li')).toHaveClass('earned')
    })

    it('says nothing about the ones you had already, but lists them', async () => {
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark', 'Norway', 'Sweden']))
      render(<App />)
      await loaded()
      expect(note()).not.toBeInTheDocument()
      await openMore('Achievements')
      expect(within(sidePanel()!).getByText(new RegExp(`^2 / ${ACHIEVEMENTS.length}$`))).toBeInTheDocument()
      expect(screen.getByText('Scandinavia', { selector: '.achievement-title' }).closest('li')).toHaveClass('earned')
    })

    it('counts states toward their achievements', async () => {
      localStorage.setItem('countries-app.visited-regions', JSON.stringify(['US-CA', 'US-NY']))
      render(<App />)
      await openMore('Achievements')
      expect(screen.getByText('Road trip', { selector: '.achievement-title' }).closest('li')).toHaveTextContent('2 of 10')
    })
  })

  describe('visited states', () => {
    /** Regions last drawn on the globe, by name → color */
    const shownRegions = () => {
      const [fills] = regionLayer.show.mock.calls.at(-1) ?? [new Map()]
      return Object.fromEntries(
        [...(fills as Map<{ properties: { name: string } }, string>)].map(([r, color]) => [r.properties.name, color]),
      )
    }
    const statesLine = () => within(countryPanel()!).getByRole('button', { name: /states explored$/ })
    /** Selects the United States and opens its list of states */
    const openUnitedStates = async () => {
      render(<App />)
      click(800)
      await userEvent.click(await within(countryPanel()!).findByRole('button', { name: /states explored$/ }))
    }

    it('lists the states of a selected country, which stays flat in the selected color', async () => {
      await openUnitedStates()
      expect(panelHeading()).toHaveTextContent('United States')
      expect(within(countryPanel()!).getByRole('checkbox', { name: 'California' })).not.toBeChecked()
      expect(raised()).toEqual([])
      expect(painted()['United States']).toBe(DEFAULT_THEME.selected)
    })

    it('marks a state clicked on the globe, and the country with it', async () => {
      await openUnitedStates()
      click(800)
      expect(within(countryPanel()!).getByRole('checkbox', { name: 'California' })).toBeChecked()
      expect(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' })).toHaveAttribute('aria-pressed', 'true')
      expect(shownRegions()).toEqual({ California: visitedRegionColor(DEFAULT_THEME) })
      click(800)
      expect(within(countryPanel()!).getByRole('checkbox', { name: 'California' })).not.toBeChecked()
    })

    it('marks states from the list', async () => {
      await openUnitedStates()
      await userEvent.click(within(countryPanel()!).getByRole('checkbox', { name: 'Texas' }))
      expect(shownRegions()).toEqual({ Texas: visitedRegionColor(DEFAULT_THEME) })
      expect(statesLine()).toHaveTextContent('1 of 51 states explored')
    })

    it('names and highlights the state pointed at', async () => {
      await openUnitedStates()
      hover(810)
      await waitFor(() => expect(tooltip()).toHaveTextContent('Texas'))
      await waitFor(() => expect(shownRegions()).toEqual({ Texas: DEFAULT_THEME.hover }))
    })

    it('colors visited states a darker hover color with the rest of their country when it is pointed at', async () => {
      await openUnitedStates()
      click(800)
      fireEvent.keyDown(window, { key: 'Escape' })
      hover(800)
      await waitFor(() => expect(painted()['United States']).toBe(DEFAULT_THEME.hover))
      await waitFor(() => expect(shownRegions()).toEqual({ California: hoveredRegionColor(DEFAULT_THEME) }))
      hover(300)
      await waitFor(() => expect(shownRegions()).toEqual({ California: visitedRegionColor(DEFAULT_THEME) }))
    })

    it('keeps showing visited states after closing the country, unless switched off', async () => {
      await openUnitedStates()
      click(800)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(shownRegions()).toEqual({ California: visitedRegionColor(DEFAULT_THEME) })

      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      await openLayers()
      await userEvent.click(screen.getByRole('switch', { name: /Visited states/ }))
      expect(shownRegions()).toEqual({})
    })

    it('notes the states visited in the Visited list', async () => {
      await openUnitedStates()
      click(800)
      fireEvent.keyDown(window, { key: 'Escape' })
      await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Visited' }))
      await openContinent('North America')
      expect(screen.getByRole('button', { name: /^United States/ })).toHaveTextContent('1 of 51 states')
    })

    it('hides states during games', async () => {
      await openUnitedStates()
      click(800)
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Flag quiz/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Easy/ }))
      expect(shownRegions()).toEqual({})
    })
  })

  describe('visited cities', () => {
    /** Cities pinned on the globe last, with "(raised)" when on the raised, selected country */
    const pinned = () =>
      ((pinLayer.show.mock.calls.at(-1)?.[0] ?? []) as { city: { name: string }; raised: boolean }[]).map(
        ({ city, raised }) => city.name + (raised ? ' (raised)' : ''),
      )
    const visitedCities = () =>
      within(countryPanel()!)
        .queryAllByRole('listitem')
        .filter((li) => li.closest('ul')?.getAttribute('aria-label') === 'Visited cities')
        .map((li) => li.querySelector('.city-name')!.textContent)
    const addCity = async (name: string) => {
      await userEvent.type(within(countryPanel()!).getByRole('searchbox', { name: 'Add a city' }), name)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: new RegExp(`^${name}`) }))
    }
    const removeCity = (name: string) =>
      userEvent.click(within(countryPanel()!).getByRole('button', { name: `Remove ${name}` }))
    const openDenmark = async () => {
      render(<App />)
      click(100)
      await within(countryPanel()!).findByRole('searchbox', { name: 'Add a city' }) // once the cities have loaded
    }
    const addAarhusAndClose = async () => {
      await openDenmark()
      await addCity('Aarhus')
      fireEvent.keyDown(window, { key: 'Escape' })
    }

    it('suggests the cities of a selected country, capital first', async () => {
      await openDenmark()
      await userEvent.click(within(countryPanel()!).getByRole('searchbox', { name: 'Add a city' }))
      const suggested = within(within(countryPanel()!).getByRole('list', { name: 'Cities to add' })).getAllByRole('button')
      expect(suggested.slice(0, 2).map((b) => b.textContent)).toEqual(['Copenhagencapital', 'Aarhus'])
    })

    it('marks a city, and its country with it, and pins it on the globe', async () => {
      await openDenmark()
      await addCity('Aarhus')
      expect(visitedCities()).toEqual(['Aarhus'])
      expect(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' })).toHaveAttribute('aria-pressed', 'true')
      expect(pinned()).toEqual(['Aarhus (raised)'])

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(pinned()).toEqual(['Aarhus'])
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited })
    })

    it('unpins a city removed again, keeping its country visited', async () => {
      await openDenmark()
      await addCity('Aarhus')
      await removeCity('Aarhus')
      expect(visitedCities()).toEqual([])
      expect(pinned()).toEqual([])
      expect(within(countryPanel()!).getByRole('button', { name: 'In visited atlas' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('marks the state a city is in', async () => {
      render(<App />)
      click(800)
      await within(countryPanel()!).findByRole('searchbox', { name: 'Add a city' })
      await addCity('Los Angeles')
      expect(within(countryPanel()!).getByRole('button', { name: /states explored$/ })).toHaveTextContent('1 of 51')
      await removeCity('Los Angeles')
      expect(within(countryPanel()!).getByRole('button', { name: /states explored$/ })).toHaveTextContent('1 of 51')
    })

    it('marks the state of a city on the coast, whose point is just off the map\'s outline: New York', async () => {
      render(<App />)
      click(800)
      await within(countryPanel()!).findByRole('searchbox', { name: 'Add a city' })
      await addCity('New York City')
      expect(JSON.parse(localStorage.getItem('countries-app.visited-regions')!)).toEqual(['US-NY'])
      expect(within(countryPanel()!).getByRole('button', { name: /states explored$/ })).toHaveTextContent('1 of 51')
    })

    it("names the city of a pin pointed at, and shows its country's flag", async () => {
      await openDenmark()
      await addCity('Copenhagen')
      fireEvent.keyDown(window, { key: 'Escape' })
      hover(900)
      await waitFor(() => expect(tooltip()).toHaveTextContent('Copenhagen'))
      expect(flag()).toHaveAccessibleName('Flag of Denmark')
    })

    it('opens the country of a pin clicked', async () => {
      await openDenmark()
      await addCity('Copenhagen')
      fireEvent.keyDown(window, { key: 'Escape' })
      click(900)
      expect(panelHeading()).toHaveTextContent('Denmark')
    })

    it('notes the cities visited in the Visited list', async () => {
      await addAarhusAndClose()
      await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Visited' }))
      await openContinent('Europe')
      expect(screen.getByRole('button', { name: /^Denmark/ })).toHaveTextContent('1 city')
    })

    it('hides the pins when switched off, and during games', async () => {
      await addAarhusAndClose()
      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      await openLayers()
      await userEvent.click(screen.getByRole('switch', { name: /City pins/ }))
      expect(pinned()).toEqual([])
      await userEvent.click(screen.getByRole('switch', { name: /City pins/ }))
      expect(pinned()).toEqual(['Aarhus'])

      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Flag quiz/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Easy/ }))
      expect(pinned()).toEqual([])
    })

    it('remembers visited cities after a reload', async () => {
      const first = render(<App />)
      click(100)
      await within(countryPanel()!).findByRole('searchbox', { name: 'Add a city' })
      await addCity('Aarhus')
      first.unmount()
      pinLayer.show.mockClear()

      render(<App />)
      await waitFor(() => expect(pinned()).toEqual(['Aarhus']))
    })
  })

  describe('flights', () => {
    type Line = { key: string; from: { code: string }; to: { code: string }; highlighted: boolean }
    /** The routes the globe last drew, "CPH-BKK", with "!" for the picked one */
    const drawn = () =>
      ((flightLayer.show.mock.calls.at(-1)?.[0] ?? []) as Line[]).map(
        (line) => `${line.from.code}-${line.to.code}${line.highlighted ? '!' : ''}`,
      )
    const fly = (from: string, to: string, id = `${from}-${to}`) => ({ id, from, to })
    const withFlights = (...flights: ReturnType<typeof fly>[]) =>
      localStorage.setItem('countries-app.flights', JSON.stringify(flights))
    const openFlights = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Trips' }))
    }
    beforeAll(() => loadAirports(), 20_000)
    beforeEach(() => flightLayer.show.mockClear())

    it('draws each route once on the globe, however often it was flown, in the flight color', async () => {
      withFlights(fly('CPH', 'BKK'), fly('BKK', 'CPH', 'back'), fly('LHR', 'CDG'))
      render(<App />)
      await waitFor(() => expect(drawn()).toEqual(['CPH-BKK', 'LHR-CDG']))
      expect(flightLayer.setColors).toHaveBeenLastCalledWith(DEFAULT_THEME.flight, DEFAULT_THEME.selected)
    })

    it('flies one plane a trip, its flights in the order flown', async () => {
      withFlights(fly('CPH', 'DXB'), fly('LHR', 'CDG'), fly('DXB', 'BKK'), fly('BKK', 'CPH'))
      render(<App />)
      const planes = () =>
        ((flightLayer.show.mock.calls.at(-1)?.[1] ?? []) as { legs: { from: { code: string }; to: { code: string } }[] }[]).map(
          (journey) => journey.legs.map((leg) => `${leg.from.code}-${leg.to.code}`).join(' '),
        )
      await waitFor(() => expect(planes()).toEqual(['CPH-DXB DXB-BKK BKK-CPH', 'LHR-CDG']))
    })

    it('follows a trip on the globe, flight by flight, then shows it whole', async () => {
      withFlights(fly('CPH', 'DXB'), fly('DXB', 'BKK'), fly('BKK', 'CPH'), fly('LHR', 'CDG'))
      render(<App />)
      await openFlights()
      const follow = await screen.findByRole('button', { name: /^Follow the trip United Arab Emirates → Thailand/ })
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      try {
        const bar = () => screen.queryByRole('status', { name: 'Following a trip' })
        const planes = () => (flightLayer.show.mock.calls.at(-1)?.[1] ?? []) as { key: string; timing?: object }[]
        fireEvent.click(follow)
        expect(bar()).toHaveTextContent('Copenhagen → Dubai1 of 3')
        // Just the trip, its plane flying it once, the first flight standing out
        expect(drawn()).toEqual(['CPH-DXB!', 'DXB-BKK', 'BKK-CPH'])
        expect(planes()).toEqual([expect.objectContaining({ key: 'following', timing: expect.any(Object) })])

        act(() => vi.advanceTimersByTime(6_000)) // landed in Dubai, and straight on
        expect(bar()).toHaveTextContent('Dubai → Bangkok2 of 3')
        expect(drawn()).toEqual(['CPH-DXB', 'DXB-BKK!', 'BKK-CPH'])

        act(() => vi.advanceTimersByTime(60_000)) // home, and a moment after
        expect(bar()).not.toBeInTheDocument()
        expect(drawn()).toEqual(['CPH-DXB!', 'DXB-BKK!', 'BKK-CPH!', 'LHR-CDG']) // all flights again, the trip picked

        // Stopped early with Escape, or Stop
        fireEvent.click(follow)
        expect(bar()).toBeInTheDocument()
        fireEvent.keyDown(window, { key: 'Escape' })
        expect(bar()).not.toBeInTheDocument()
        fireEvent.click(follow)
        fireEvent.click(within(bar()!).getByRole('button', { name: 'Stop' }))
        expect(bar()).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('on a phone, puts the flights away while following a trip, and brings them back at the end', async () => {
      const matchMedia = window.matchMedia
      window.matchMedia = ((query: string) => ({ matches: query.includes('max-width: 640px'), media: query })) as typeof window.matchMedia
      withFlights(fly('CPH', 'DXB'), fly('DXB', 'CPH'))
      try {
        render(<App />)
        await openFlights()
        const follow = await screen.findByRole('button', { name: /^Follow the trip/ })
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        fireEvent.click(follow)
        expect(sidePanel()).toHaveAccessibleName('Explore') // the sheet made way
        act(() => vi.advanceTimersByTime(60_000))
        expect(sidePanel()).toHaveAccessibleName('Visited')
        expect(screen.getByRole('tab', { name: 'Trips' })).toHaveAttribute('aria-selected', 'true')
      } finally {
        vi.useRealTimers()
        window.matchMedia = matchMedia
      }
    })

    it('makes a trip, and adds a place and a flight to it, the place after the flight that lands there', async () => {
      render(<App />)
      await openFlights()
      await userEvent.click(screen.getByRole('button', { name: 'New trip' }))
      await userEvent.type(screen.getByRole('textbox', { name: 'Name of the new trip' }), 'Thailand{Enter}')
      await userEvent.click(screen.getByRole('button', { name: 'Place' }))
      await userEvent.type(screen.getByRole('searchbox', { name: 'Place to add' }), 'thai')
      await userEvent.click(within(screen.getByRole('list', { name: 'Places found' })).getByRole('button', { name: /^Thailand/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Add place' }))
      await userEvent.click(screen.getByRole('button', { name: 'Flight' }))
      for (const [label, query] of [['From', 'cph'], ['To', 'bkk']]) {
        await userEvent.type(await screen.findByRole('searchbox', { name: label }), query)
        await userEvent.click(within(screen.getByRole('list', { name: `${label} airports` })).getAllByRole('button')[0])
      }
      await userEvent.click(screen.getByRole('button', { name: 'Add flight' }))
      const items = within(screen.getByRole('list', { name: 'What the trip Thailand was' })).getAllByRole('listitem')
      expect(items.map((li) => li.querySelector('.row-name')!.textContent)).toEqual(['Copenhagen → Bangkok', 'Thailand'])
      expect(drawn()).toEqual(['CPH-BKK'])
      expect(JSON.parse(localStorage.getItem('countries-app.visited')!)).toContain('Thailand')
      expect(screen.getByText('Flights', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1')
    })

    it('moves flights saved between cities to their airports', async () => {
      const cities = await loadCities()
      const id = (name: string, place: string) => cities.find((c) => c.name === name && c.place === place)!.id
      withFlights({ id: 'old', from: id('Copenhagen', 'DK'), to: id('Dubai', 'AE') } as never)
      render(<App />)
      await waitFor(() => expect(drawn()).toEqual(['CPH-DXB']))
      expect(JSON.parse(localStorage.getItem('countries-app.flights')!)).toEqual([{ id: 'old', from: 'CPH', to: 'DXB' }])
    })

    it('shows a flight picked in the list, highlighted, until Escape', async () => {
      withFlights(fly('CPH', 'BKK'), fly('LHR', 'CDG'))
      render(<App />)
      await openFlights()
      await openTrip(/^Thailand$/)
      await userEvent.click(await screen.findByRole('button', { name: /^Copenhagen → Bangkok/ }))
      const [view] = globe.pointOfView.mock.calls.at(-1) as [{ lat: number; lng: number }]
      expect(view.lat).toBeGreaterThan(13.7)
      expect(view.lat).toBeLessThan(55.6)
      expect(drawn()).toEqual(['CPH-BKK!', 'LHR-CDG'])
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(drawn()).toEqual(['CPH-BKK', 'LHR-CDG'])
      expect(sidePanel()).toBeInTheDocument() // Escape put the route away first
    })

    it('shows a whole trip picked in the list, every leg highlighted, from above its middle', async () => {
      withFlights(fly('CPH', 'DXB'), fly('DXB', 'BKK'), fly('BKK', 'CPH'), fly('LHR', 'CDG'))
      render(<App />)
      await openFlights()
      await openTrip(/^United Arab Emirates Thailand$/)
      await userEvent.click(screen.getByRole('button', { name: 'Show on globe' }))
      expect(drawn()).toEqual(['CPH-DXB!', 'DXB-BKK!', 'BKK-CPH!', 'LHR-CDG'])
      const [view] = globe.pointOfView.mock.calls.at(-1) as [{ lat: number; lng: number; altitude: number }]
      // Between Copenhagen, Dubai and Bangkok, as far out as flights to a place go, to see them all
      expect(view.lng).toBeGreaterThan(12.6)
      expect(view.lng).toBeLessThan(100.7)
      expect(view.altitude).toBe(1.8)

      // Removing a leg puts the trip away
      await userEvent.click(screen.getByRole('button', { name: 'Remove the flight from Dubai to Bangkok' }))
      expect(drawn()).toEqual(['CPH-DXB', 'BKK-CPH', 'LHR-CDG'])
    })

    it('names a trip, kept after a reload, and says what it is called on the globe when picked', async () => {
      withFlights(fly('CPH', 'DXB'), fly('DXB', 'BKK'), fly('BKK', 'CPH'))
      const { unmount } = render(<App />)
      await openFlights()
      await userEvent.click(await screen.findByRole('button', { name: /^Name the trip/ }))
      await userEvent.type(screen.getByRole('textbox', { name: /^Name of the trip/ }), 'Asia loop')
      await userEvent.type(screen.getByRole('textbox', { name: /^Note on the trip/ }), 'Monsoon')
      await userEvent.click(screen.getByRole('button', { name: 'Done' }))
      unmount()

      render(<App />)
      await openFlights()
      await openTrip(/Asia loop/)
      await userEvent.click(screen.getByRole('button', { name: 'Show on globe' }))
      const caption = () => document.querySelector('.globe-caption')
      expect(caption()).toHaveTextContent('Asia loopMonsoon')
      // One of its flights says it too
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(caption()).toBeNull()
      await userEvent.click(screen.getByRole('button', { name: /^Dubai → Bangkok/ }))
      expect(caption()).toHaveTextContent('Asia loop')
    })

    it('hides the flights when switched off, and during games', async () => {
      withFlights(fly('CPH', 'BKK'))
      render(<App />)
      await waitFor(() => expect(drawn()).toEqual(['CPH-BKK']))
      await openLayers()
      await userEvent.click(screen.getByRole('switch', { name: /Flights/ }))
      expect(drawn()).toEqual([])
      await userEvent.click(screen.getByRole('switch', { name: /Flights/ }))
      expect(drawn()).toEqual(['CPH-BKK'])

      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Flag quiz/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Easy/ }))
      expect(drawn()).toEqual([])
    })
  })

  describe('year in review', () => {
    const drawn = () =>
      ((flightLayer.show.mock.calls.at(-1)?.[0] ?? []) as { from: { code: string }; to: { code: string } }[]).map(
        (line) => `${line.from.code}-${line.to.code}`,
      )
    const pinned = () => ((pinLayer.show.mock.calls.at(-1)?.[0] ?? []) as { city: { name: string } }[]).map((p) => p.city.name)
    beforeAll(() => loadAirports(), 20_000)
    beforeEach(async () => {
      flightLayer.show.mockClear()
      const copenhagen = (await loadCities()).find((c) => c.name === 'Copenhagen' && c.place === 'DK')!
      localStorage.setItem('countries-app.visited', JSON.stringify(['Japan', 'France', 'Denmark']))
      localStorage.setItem('countries-app.visited-cities', JSON.stringify([copenhagen.id]))
      localStorage.setItem('countries-app.visit-dates', JSON.stringify({ Japan: ['2024-04'], France: ['2019-07'] }))
      localStorage.setItem(
        'countries-app.flights',
        JSON.stringify([
          { id: 'a', from: 'CPH', to: 'NRT', date: '2024-04' },
          { id: 'b', from: 'CPH', to: 'CDG', date: '2019-07' },
          { id: 'c', from: 'CPH', to: 'BKK' },
        ]),
      )
    })
    const openYears = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Years' }))
    }
    const all = { Japan: DEFAULT_THEME.visited, France: DEFAULT_THEME.visited, Denmark: DEFAULT_THEME.visited }

    it('shows just the year on the globe while it is open: its places, new ones in green, and flights, no city pins', async () => {
      render(<App />)
      await waitFor(() => expect(drawn()).toEqual(['CPH-NRT', 'CPH-CDG', 'CPH-BKK']))
      await waitFor(() => expect(pinned()).toEqual(['Copenhagen']))
      await openYears()
      expect(screen.getByText('2 years')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: '2024' })).toBeInTheDocument()
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.correct })
      expect(screen.getByRole('list', { name: '2024: New, Again' })).toBeInTheDocument() // the key
      expect(drawn()).toEqual(['CPH-NRT'])
      expect(pinned()).toEqual([])

      await userEvent.click(screen.getByRole('button', { name: 'Earlier year' }))
      expect(screen.getByRole('heading', { name: '2019' })).toBeInTheDocument()
      expect(painted()).toEqual({ France: DEFAULT_THEME.correct })
      expect(drawn()).toEqual(['CPH-CDG'])

      // Everything again once the years are left
      await userEvent.click(screen.getByRole('tab', { name: 'Countries' }))
      expect(painted()).toEqual(all)
      expect(screen.queryByRole('figure', { name: /^20/ })).not.toBeInTheDocument()
      expect(drawn()).toEqual(['CPH-NRT', 'CPH-CDG', 'CPH-BKK'])
      expect(pinned()).toEqual(['Copenhagen'])
    })

    it('turns the globe to the year it shows, as the years open, a year is picked, or the tab opens again', async () => {
      const lastView = () => (globe.pointOfView.mock.calls.at(-1) as [{ lat: number; lng: number }])[0]
      render(<App />)
      await openYears()
      // 2024: Japan, and the flight there from Copenhagen, over Siberia
      expect(lastView().lng).toBeGreaterThan(60)
      expect(lastView().lng).toBeLessThan(140)

      await userEvent.click(screen.getByRole('button', { name: 'Earlier year' }))
      // 2019: France, and the flight to Paris
      expect(lastView().lat).toBeGreaterThan(40)
      expect(lastView().lat).toBeLessThan(58)
      expect(lastView().lng).toBeGreaterThan(-5)
      expect(lastView().lng).toBeLessThan(15)

      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      globe.pointOfView.mockClear()
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      expect(lastView().lng).toBeLessThan(15)
    })

    it("replays the years on the globe: all so far, that year's places and flights standing out, new places brightest", async () => {
      localStorage.setItem('countries-app.visit-dates', JSON.stringify({ Japan: ['2024-04'], France: ['2019-07', '2024-08'] }))
      const key = () => screen.queryByRole('figure', { name: /^20/ })
      const lit = () =>
        ((flightLayer.show.mock.calls.at(-1)?.[0] ?? []) as { from: { code: string }; to: { code: string }; highlighted: boolean }[])
          .filter((line) => line.highlighted)
          .map((line) => `${line.from.code}-${line.to.code}`)
      render(<App />)
      await openYears()
      await userEvent.click(screen.getByRole('button', { name: /^▶ Replay your travels, 2019–2024/ }))
      // 2019: France, new, and the flight to Paris
      expect(screen.getByRole('heading', { name: '2019' })).toBeInTheDocument()
      expect(painted()).toEqual({ France: DEFAULT_THEME.correct })
      expect(drawn()).toEqual(['CPH-CDG'])
      expect(lit()).toEqual(['CPH-CDG'])
      expect(key()).toHaveAccessibleName('2019')

      // 2024 comes after a moment: Japan new, and France again, a darker green
      await waitFor(() => expect(screen.getByRole('heading', { name: '2024' })).toBeInTheDocument(), { timeout: 4_000 })
      await waitFor(() => expect(painted()).toEqual({ France: revisitColor(DEFAULT_THEME), Japan: DEFAULT_THEME.correct }))
      expect(key()).toHaveAccessibleName('2024')
      expect(drawn()).toEqual(['CPH-NRT', 'CPH-CDG'])
      expect(lit()).toEqual(['CPH-NRT'])
      expect(screen.getByRole('button', { name: 'Replay' })).toBeInTheDocument()

      // Back to the years: the year picked, as before, with Japan new and France again, but not the years before
      await userEvent.click(screen.getByRole('button', { name: 'Back to the years' }))
      expect(screen.getByRole('list', { name: 'Month by month' })).toBeInTheDocument()
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.correct, France: revisitColor(DEFAULT_THEME) })
      expect(screen.getByRole('list', { name: '2024: New, Again' })).toBeInTheDocument()
    }, 10_000)

    it('wraps the year shown full screen, put away with Escape', async () => {
      render(<App />)
      await openYears()
      await userEvent.click(screen.getByRole('button', { name: '✨ Your 2024, wrapped' }))
      expect(screen.getByRole('dialog', { name: 'Your 2024, wrapped' })).toBeInTheDocument()
      expect(screen.getByRole('img', { name: /^In 2024: 1 country/ })).toBeInTheDocument()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryByRole('dialog', { name: 'Your 2024, wrapped' })).not.toBeInTheDocument()
      expect(sidePanel()).toBeInTheDocument() // Escape put the card away, not the panel
    })

    it('ends the time-lapse on leaving the years', async () => {
      render(<App />)
      await openYears()
      await userEvent.click(screen.getByRole('button', { name: /^▶ Replay your travels/ }))
      await userEvent.click(screen.getByRole('tab', { name: 'Countries' }))
      await userEvent.click(screen.getByRole('tab', { name: 'Years' }))
      expect(screen.getByRole('list', { name: 'Month by month' })).toBeInTheDocument()
    })

    it('keeps the year picked when the tab is opened again, and shows everything with the panel closed', async () => {
      render(<App />)
      await openYears()
      await userEvent.click(screen.getByRole('button', { name: 'Earlier year' }))
      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      expect(painted()).toEqual(all)
      await userEvent.click(screen.getByRole('button', { name: 'Visited' }))
      expect(screen.getByRole('heading', { name: '2019' })).toBeInTheDocument()
      expect(painted()).toEqual({ France: DEFAULT_THEME.correct })
    })

    it("shows the year even with visited places and flights hidden in the layers", async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showVisited: false, showFlights: false }))
      render(<App />)
      await waitFor(() => expect(painted()).toEqual({}))
      expect(drawn()).toEqual([])
      await openYears()
      expect(painted()).toEqual({ Japan: DEFAULT_THEME.correct })
      expect(drawn()).toEqual(['CPH-NRT'])
    })

    it('shows a country of the year in its panel', async () => {
      render(<App />)
      await openYears()
      await userEvent.click(screen.getByRole('button', { name: /^Japan/ }))
      expect(countryPanel()).toHaveAccessibleName(/Japan/)
    })
  })

  describe('explore settings', () => {
    const openExplore = async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Explore' }))
      await openLayers()
    }

    it('hides visited countries on the globe, keeping the list', async () => {
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      expect(painted()).toEqual({ Denmark: DEFAULT_THEME.visited })

      await openExplore()
      await userEvent.click(screen.getByRole('switch', { name: /Visited countries/ }))
      expect(painted()).toEqual({})
      await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Visited' }))
      await openContinent('Europe')
      expect(screen.getByRole('list', { name: 'Visited in Europe' })).toHaveTextContent('Denmark')
    })

    it('hides the island markers, and remembers it', async () => {
      const first = render(<App />)
      expect(layer.setRings).toHaveBeenLastCalledWith(tinyPlaces, null)
      await openExplore()
      await userEvent.click(screen.getByRole('switch', { name: /Small islands/ }))
      expect(layer.setRings).toHaveBeenLastCalledWith([], null)
      first.unmount()

      render(<App />)
      expect(layer.setRings).toHaveBeenLastCalledWith([], null)
    })
  })

  describe('day and night', () => {
    const night = () => sceneObjects.has(nightLayer.object)

    it("is off until switched on, under Explore's layers button", async () => {
      render(<App />)
      expect(night()).toBe(false)
      await openLayers()
      const dayAndNight = screen.getByRole('switch', { name: /Day and night/ })
      await userEvent.click(dayAndNight)
      expect(night()).toBe(true)
      expect(dayAndNight).toBeChecked()
      await userEvent.click(dayAndNight)
      expect(night()).toBe(false)
    })

    it('puts night where the sun has set, lights the cities, and moves on every minute', async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showDayNight: true }))
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], now: new Date('2026-06-21T12:00:00Z') })
      try {
        render(<App />)
        // The cities load as the app starts; waitFor can't poll while the timers stand still
        await act(() => loadCities())
        await act(async () => {})
        expect(night()).toBe(true)
        const [sun] = nightLayer.setSun.mock.lastCall!
        expect(sun).toEqual(subsolarPoint(new Date('2026-06-21T12:00:00Z')))
        expect(sun.lat).toBeCloseTo(23.4, 0)
        expect(nightLayer.setLights.mock.lastCall![0].length).toBeGreaterThan(1000)
        act(() => vi.advanceTimersByTime(SUN_UPDATE_MS))
        expect(nightLayer.setSun.mock.lastCall![0].lng).toBeCloseTo(sun.lng - 0.25, 1) // a quarter degree west
      } finally {
        vi.useRealTimers()
      }
    })

    it('can show night without the city lights', async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showDayNight: true }))
      render(<App />)
      await waitFor(() => expect(nightLayer.setLights.mock.lastCall![0].length).toBeGreaterThan(1000))
      await openLayers()
      await userEvent.click(screen.getByRole('switch', { name: /City lights/ }))
      expect(night()).toBe(true)
      expect(nightLayer.setLights).toHaveBeenLastCalledWith([])
    })

    it('is hidden during games, where it would hide what to find', async () => {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showDayNight: true }))
      render(<App />)
      expect(night()).toBe(true)
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Find the country/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Easy/ }))
      expect(night()).toBe(false)
      await userEvent.click(screen.getByRole('button', { name: 'Quit game' }))
      expect(night()).toBe(true)
    })
  })

  describe('design', () => {
    const lastColors = () => {
      const colors: Record<string, string> = {}
      for (const [country, color] of layer.paint.mock.calls) colors[country.properties.name] = color
      return colors
    }

    it('repaints the globe in the chosen design', async () => {
      render(<App />)
      await openLayers()
      await userEvent.click(screen.getByRole('button', { name: /Night/ }))
      expect(new Set(Object.values(lastColors()))).toEqual(new Set([NIGHT.land]))
      expect(layer.setBorders).toHaveBeenLastCalledWith(NIGHT.border, NIGHT.borderOpacity)
    })

    it('colors neighbors differently in the political design', async () => {
      render(<App />)
      await openLayers()
      await userEvent.click(screen.getByRole('button', { name: /Political/ }))
      const colors = lastColors()
      expect(colors.Denmark).not.toBe(colors.Germany)
      expect(new Set(Object.values(colors))).toEqual(new Set(POLITICAL.land))
    })

    it('shows the Earth from space in the realistic design: plain land not painted, your places see-through', async () => {
      localStorage.setItem('countries-app.visited', JSON.stringify(['Denmark']))
      render(<App />)
      await openLayers()
      await userEvent.click(screen.getByRole('button', { name: /^Realistic/ }))
      const lastPaint = (name: string) => layer.paint.mock.calls.filter(([c]) => c.properties.name === name).at(-1)!.slice(1)
      expect(lastPaint('Denmark')).toEqual([REALISTIC.visited, REALISTIC.imagery!.tint])
      expect(lastPaint('France')).toEqual([REALISTIC.land, 0])
      expect(layer.setSeeThrough).toHaveBeenLastCalledWith(true)
      // The states are drawn once their shapes have loaded, in the background
      await waitFor(() => expect(regionLayer.setFillOpacity).toHaveBeenLastCalledWith(REALISTIC.imagery!.tint))

      await userEvent.click(screen.getByRole('button', { name: /^Midnight/ }))
      expect(lastPaint('France')).toEqual([DEFAULT_THEME.land, 1])
      expect(layer.setSeeThrough).toHaveBeenLastCalledWith(false)
    })

    it('keeps the chosen design after a reload', async () => {
      const first = render(<App />)
      await openLayers()
      await userEvent.click(screen.getByRole('button', { name: /Night/ }))
      first.unmount()
      layer.paint.mockClear()

      render(<App />)
      expect(new Set(Object.values(lastColors()))).toEqual(new Set([NIGHT.land]))
    })
  })

  describe('games', () => {
    const byName = (name: string) => countries.find((c) => c.properties.name === name)!
    const startGame = async (title: RegExp, difficulty = 'Easy') => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: title }))
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${difficulty}`) }))
    }
    const findTarget = () => screen.getByText('Find this country on the globe').nextElementSibling!.textContent!
    const feedback = () => screen.getByRole('status')
    const lastFlight = () => globe.pointOfView.mock.calls.filter((call) => call.length === 2).at(-1)

    it('hides names and flags while playing', async () => {
      await startGame(/Find the country/)
      hover(100)
      await act(() => new Promise((r) => setTimeout(r, 50)))
      expect(tooltip()).not.toBeInTheDocument()
      expect(flag()).not.toBeInTheDocument()
    })

    it('does not show visited countries while playing', async () => {
      render(<App />)
      click(100)
      await userEvent.click(within(countryPanel()!).getByRole('button', { name: 'Add to visited atlas' }))
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Flag quiz/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Easy/ }))
      expect(painted()).toEqual({})
    })

    describe('neighbours', () => {
      it('lights up the country, then the neighbours named, and those missed once shown', async () => {
        const { borderingCountries } = await import('./games/neighboursGame')
        await startGame(/Neighbours/)
        const name = screen.getByText('Name every country bordering').nextElementSibling!.textContent!
        const [first, ...rest] = borderingCountries(byName(name))
        expect(painted()).toEqual({ [name]: DEFAULT_THEME.selected })
        expect(lastFlight()).toBeDefined() // turned to show it

        await userEvent.type(screen.getByRole('textbox', { name: 'A neighbour' }), `${first.properties.name}{Enter}`)
        // Naming the only neighbour ends the round
        expect(feedback()).toHaveTextContent(rest.length ? `${first.properties.name} ✓` : `All of ${name}'s neighbours!`)
        expect(painted()).toMatchObject({ [name]: DEFAULT_THEME.selected, [first.properties.name]: DEFAULT_THEME.correct })

        if (rest.length) {
          await userEvent.click(screen.getByRole('button', { name: 'Show the rest' }))
          expect(painted()).toMatchObject(Object.fromEntries(rest.map((c) => [c.properties.name, DEFAULT_THEME.wrong])))
        }
        await userEvent.click(screen.getByRole('button', { name: 'Next country' }))
        expect(screen.getByText('Country 2 of 5')).toBeInTheDocument()
      })
    })

    describe('find the city', () => {
      const cityTarget = () => screen.getByText('Click where this city is on the globe').nextElementSibling!.textContent!
      const start = async () => {
        await startGame(/Find the city/, 'Medium')
        await screen.findByText('Click where this city is on the globe')
      }
      type Line = { from: { lat: number; lng: number }; to: { name: string }; highlighted: boolean }
      const lines = () => (flightLayer.show.mock.calls.at(-1)?.[0] ?? []) as Line[]
      const pins = () => ((pinLayer.show.mock.calls.at(-1)?.[0] ?? []) as { city: { name: string } }[]).map((p) => p.city.name)

      it('scores a click by how far off it is, then shows the city, a line from the click, and both in view', async () => {
        await start()
        // Countries don't light up: the answer is a point
        hover(100)
        await act(() => new Promise((r) => setTimeout(r, 50)))
        expect(painted()).toEqual({})
        expect(surface()).toHaveStyle({ cursor: 'crosshair' })

        const city = cityTarget()
        globe.pointOfView.mockClear()
        click(CAPITAL_AT[city])
        expect(feedback()).toHaveTextContent(/^Off by [\d,]+ km\. \+\d+ points$/)
        expect(pins()).toEqual([city])
        expect(pinLayer.setColor).toHaveBeenLastCalledWith(DEFAULT_THEME.correct)
        expect(lines()).toEqual([expect.objectContaining({ to: expect.objectContaining({ name: city }), highlighted: true })])
        expect(lastFlight()).toBeDefined()

        // Clicking again does nothing; the next city clears the globe
        click(CAPITAL_AT[city])
        await userEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(cityTarget()).not.toBe(city)
        expect(pins()).toEqual([])
        expect(lines()).toEqual([])
      })

      it("shows the city after \"I don't know\", with no points", async () => {
        await start()
        const city = cityTarget()
        await userEvent.click(screen.getByRole('button', { name: "I don't know" }))
        expect(feedback()).toHaveTextContent(`${city} is marked on the globe`)
        expect(pins()).toEqual([city])
        expect(lines()).toEqual([])
        expect(screen.getByText('0 points')).toBeInTheDocument()
      })

      it('ignores a click off the globe', async () => {
        await start()
        click(0) // outer space
        expect(feedback()).toHaveTextContent('')
        expect(screen.getByRole('button', { name: "I don't know" })).toBeInTheDocument()
      })

      it('scores the game, and keeps the best', async () => {
        await start()
        for (let i = 0; i < 5; i++) {
          click(CAPITAL_AT[cityTarget()])
          await userEvent.click(screen.getByRole('button', { name: i < 4 ? 'Next' : 'See results' }))
        }
        expect(screen.getByRole('list', { name: 'Your cities' }).children).toHaveLength(5)
        const score = Number(screen.getByText(/ \/ 500$/).textContent!.split(' ')[0])
        expect(score).toBeGreaterThan(250)
        expect(JSON.parse(localStorage.getItem('countries-app.best-scores')!)).toEqual({ 'city:medium': score })
      })
    })

    describe('find the country', () => {
      it('scores 3 points for the right country on the first try', async () => {
        await startGame(/Find the country/)
        const target = findTarget()
        click(PLACE_OF[target])
        expect(feedback()).toHaveTextContent('Correct! +3 points')
        expect(screen.getByText('3 points')).toBeInTheDocument()
        expect(painted()).toEqual({ [target]: DEFAULT_THEME.correct })
        expect(countryPanel()).not.toBeInTheDocument()
      })

      it('lets you try again after a miss, for fewer points', async () => {
        await startGame(/Find the country/)
        const target = findTarget()
        const wrong = Object.keys(PLACE_OF).find((name) => name !== target)!
        click(PLACE_OF[wrong])
        expect(feedback()).toHaveTextContent(`That's ${wrong}. Try again: 2 tries left.`)
        expect(painted()).toEqual({ [wrong]: DEFAULT_THEME.wrong })
        click(PLACE_OF[target])
        expect(feedback()).toHaveTextContent('Correct! +2 points')
        expect(painted()).toEqual({ [wrong]: DEFAULT_THEME.wrong, [target]: DEFAULT_THEME.correct })
      })

      it('does not count a territory clicked, nor light it up', async () => {
        await startGame(/Find the country/)
        // A country lights up; moving on to a territory turns it off, and lights nothing
        hover(100)
        await waitFor(() => expect(painted()).toEqual({ Denmark: DEFAULT_THEME.hover }))
        hover(400) // Christmas Island
        await waitFor(() => expect(painted().Denmark).toBeUndefined())
        expect(painted()).toEqual({})
        click(400)
        expect(feedback()).toHaveTextContent('Australian Indian Ocean Territories is a territory, not a country. Try again.')
        expect(screen.getByLabelText(`Try 1 of 3`)).toBeInTheDocument()
        expect(painted()).toEqual({})
      })

      it("shows the answer after \"I don't know\", with no points", async () => {
        await startGame(/Find the country/)
        const target = findTarget()
        await userEvent.click(screen.getByRole('button', { name: "I don't know" }))
        expect(feedback()).toHaveTextContent(`The answer is ${target}.`)
        expect(painted()).toEqual({ [target]: DEFAULT_THEME.correct })
        expect(screen.getByText('0 points')).toBeInTheDocument()
      })

      it('shows the answer and flies there after three misses', async () => {
        await startGame(/Find the country/)
        const target = findTarget()
        const wrong = Object.keys(PLACE_OF).filter((name) => name !== target).slice(0, 3)
        for (const name of wrong) click(PLACE_OF[name])
        expect(feedback()).toHaveTextContent(`The answer is ${target}.`)
        expect(painted()[target]).toBe(DEFAULT_THEME.correct)
        const [lng, lat] = byName(target).properties.centroid
        expect(lastFlight()?.[0]).toMatchObject({ lat, lng })
      })

      it('ignores clicks on the ocean and after answering', async () => {
        await startGame(/Find the country/)
        click(300)
        expect(feedback()).toBeEmptyDOMElement()
        const target = findTarget()
        click(PLACE_OF[target])
        click(PLACE_OF[Object.keys(PLACE_OF).find((name) => name !== target)!])
        expect(screen.getByText('3 points')).toBeInTheDocument()
      })

      it('plays to the end and saves the best score', async () => {
        await startGame(/Find the country/)
        for (let round = 0; round < 5; round++) {
          click(PLACE_OF[findTarget()])
          await userEvent.click(screen.getByRole('button', { name: round < 4 ? 'Next' : 'See results' }))
        }
        expect(screen.getByText('15 / 15')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'All games' }))
        await userEvent.click(screen.getByRole('button', { name: /Find the country/ }))
        expect(screen.getByRole('button', { name: /^Easy/ })).toHaveTextContent('Best: 15 / 30 points')
      })
    })

    describe('flag quiz', () => {
      it('checks the chosen country against the flag', async () => {
        await startGame(/Flag quiz/)
        const src = screen.getByRole('img', { name: 'The flag to identify' }).getAttribute('src')!
        const code = src.match(/\/(\w\w)\.svg/)![1].toUpperCase()
        const target = countries.find((c) => c.properties.isoAlpha2 === code)!.properties.name
        await userEvent.click(screen.getByRole('button', { name: target }))
        expect(feedback()).toHaveTextContent('Correct!')
        expect(painted()).toEqual({ [target]: DEFAULT_THEME.correct })
      })

      it('does not open the country panel when clicking the globe', async () => {
        await startGame(/Flag quiz/)
        click(100)
        expect(countryPanel()).not.toBeInTheDocument()
        expect(feedback()).toBeEmptyDOMElement()
      })
    })

    describe('name that country', () => {
      it('highlights the country in question and flies there, zoomed to fit', async () => {
        await startGame(/Name that country/)
        const highlighted = Object.entries(painted())
        expect(highlighted).toHaveLength(1)
        const [name, color] = highlighted[0]
        expect(color).toBe(DEFAULT_THEME.selected)
        const [lng, lat] = byName(name).properties.centroid
        expect(lastFlight()?.[0]).toMatchObject({ lat, lng })

        await userEvent.click(screen.getByRole('button', { name }))
        expect(feedback()).toHaveTextContent('Correct!')
        expect(painted()).toEqual({ [name]: DEFAULT_THEME.correct })
      })
    })

    describe('difficulty', () => {
      it('asks for typed answers on medium', async () => {
        await startGame(/Shape quiz/, 'Medium')
        const target = lastRoundGame.current!.rounds[0].target.properties.name
        await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), `${target}{Enter}`)
        expect(feedback()).toHaveTextContent('Correct!')
        expect(painted()).toEqual({ [target]: DEFAULT_THEME.correct })
        const [lng, lat] = byName(target).properties.centroid
        expect(lastFlight()?.[0]).toMatchObject({ lat, lng })
      })

      it('plays again at the same difficulty', async () => {
        await startGame(/Shape quiz/, 'Medium')
        for (const [i, round] of lastRoundGame.current!.rounds.entries()) {
          await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), `${round.target.properties.name}{Enter}`)
          await userEvent.click(screen.getByRole('button', { name: i < 4 ? 'Next' : 'See results' }))
        }
        await userEvent.click(screen.getByRole('button', { name: 'Play again' }))
        expect(screen.getByText('Shape quiz · Medium')).toBeInTheDocument()
        expect(screen.getByText('Round 1 of 5')).toBeInTheDocument()
      })
    })

    it('capital quiz: lights up the country, flies there, and takes its capital', async () => {
      await startGame(/Capital quiz/)
      const target = screen.getByText("What's the capital of").nextElementSibling!.textContent!
      expect(painted()).toEqual({ [target]: DEFAULT_THEME.selected })
      expect(lastFlight()![0]).toMatchObject({ lat: expect.any(Number) })
      const capital = capitalOf(countries.find((c) => c.properties.name === target)!)!
      await userEvent.click(screen.getByRole('button', { name: capital }))
      expect(feedback()).toHaveTextContent(`Correct! The capital of ${target} is ${capital}.`)
      expect(painted()).toEqual({ [target]: DEFAULT_THEME.correct })
    })

    it('higher or lower: lights up both countries, and ends at the first wrong guess with the streak', async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /Higher or lower/ }))
      await userEvent.click(screen.getByRole('button', { name: /^Area/ }))
      const pair = () => [...document.querySelectorAll('.higher-country dt')].map((dt) => dt.textContent!)
      const more = () => {
        const [known, next] = pair().map((name) => countries.find((c) => c.properties.name === name)!)
        return valueOf(next, 'area') > valueOf(known, 'area')
      }
      const [known, next] = pair()
      expect(painted()).toEqual({ [known]: DEFAULT_THEME.selected, [next]: DEFAULT_THEME.flight })

      await userEvent.click(screen.getByRole('button', { name: more() ? 'Bigger' : 'Smaller' }))
      await userEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(pair()[0]).toBe(next) // the one just guessed is the one to beat
      await userEvent.click(screen.getByRole('button', { name: more() ? 'Smaller' : 'Bigger' }))
      expect(screen.getByText('1', { selector: '.big-score' })).toBeInTheDocument()
      expect(screen.getByText('in a row')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'All games' }))
      await userEvent.click(screen.getByRole('button', { name: /Higher or lower/ }))
      expect(screen.getByRole('button', { name: /^Area/ })).toHaveTextContent('Best: 1 in a row')
    })

    it("daily challenge: plays today's five rounds once, and keeps the streak", async () => {
      render(<App />)
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      await userEvent.click(screen.getByRole('button', { name: /^Daily challenge/ }))
      await userEvent.click(screen.getByRole('button', { name: "Play today's challenge" }))
      expect(screen.getByText('Find this country on the globe')).toBeInTheDocument()
      for (let round = 0; round < 5; round++) {
        await userEvent.click(screen.getByRole('button', { name: "I don't know" }))
        await userEvent.click(screen.getByRole('button', { name: round === 4 ? 'See results' : 'Next' }))
      }
      expect(screen.getByText('0 / 7')).toBeInTheDocument()
      expect(screen.getByLabelText('Rounds: 🟥🟥🟥🟥🟥')).toBeInTheDocument()

      await userEvent.click(screen.getByRole('button', { name: 'All games' }))
      expect(screen.getByRole('button', { name: /^Daily challenge/ })).toHaveTextContent('Today: 0 / 7 · 1 day in a row')
      await userEvent.click(screen.getByRole('button', { name: /^Daily challenge/ }))
      expect(screen.queryByRole('button', { name: "Play today's challenge" })).not.toBeInTheDocument()
    })

    it('rings no territories in the other games, as they are no part of them', async () => {
      await startGame(/Find the country/)
      expect(layer.setRings).toHaveBeenLastCalledWith(TINY_COUNTRIES, null)
      await userEvent.click(screen.getByRole('button', { name: 'Quit game' }))
      expect(layer.setRings).toHaveBeenLastCalledWith(tinyPlaces, null)
    })

    describe('letter hunt', () => {
      const startLetter = async (letter: string) => {
        render(<App />)
        await userEvent.click(screen.getByRole('button', { name: 'Games' }))
        await userEvent.click(screen.getByRole('button', { name: /Letter hunt/ }))
        await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${letter}:`) }))
      }

      it('colors countries found and wrong clicks, and shows what was missed', async () => {
        await startLetter('D')
        expect(screen.getByText('Found 0 of 5')).toBeInTheDocument()

        click(PLACE_OF.Denmark)
        expect(screen.getByText('Found 1 of 5')).toBeInTheDocument()
        click(PLACE_OF.France)
        expect(feedback()).toHaveTextContent("France doesn't start with D.")
        expect(painted()).toEqual({ Denmark: DEFAULT_THEME.correct, France: DEFAULT_THEME.wrong })
        expect(countryPanel()).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Give up and show the rest' }))
        expect(screen.getByText(/Missed/)).toHaveTextContent('Djibouti')
        const colors = painted()
        expect(colors.Denmark).toBe(DEFAULT_THEME.correct)
        expect(colors.Djibouti).toBe(DEFAULT_THEME.selected)
      })

      it('rings the small islands, even with the rings switched off, until the hunt is over', async () => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showMarkers: false }))
        await startLetter('D')
        // In a color that shows over the sea
        expect(layer.setRings).toHaveBeenLastCalledWith(LETTER_HUNT_RINGS, DEFAULT_THEME.flight)
        await userEvent.click(screen.getByRole('button', { name: 'Give up and show the rest' }))
        expect(layer.setRings).toHaveBeenLastCalledWith(LETTER_HUNT_RINGS, DEFAULT_THEME.flight) // the missed ones
        await userEvent.click(screen.getByRole('button', { name: 'All games' }))
        expect(layer.setRings).toHaveBeenLastCalledWith([], null)
      })

      it('saves the best for the letter and shows it on its tile', async () => {
        await startLetter('D')
        click(PLACE_OF.Denmark)
        await userEvent.click(screen.getByRole('button', { name: 'Give up and show the rest' }))
        await userEvent.click(screen.getByRole('button', { name: 'Another letter' }))
        expect(screen.getByRole('button', { name: /^D:/ })).toHaveTextContent('D1/5')
      })
    })

    describe('name them all', () => {
      it('lights up each country named, and shows the rest when giving up', async () => {
        render(<App />)
        await userEvent.click(screen.getByRole('button', { name: 'Games' }))
        await userEvent.click(screen.getByRole('button', { name: /Name them all/ }))
        await userEvent.click(screen.getByRole('button', { name: /^Europe/ }))
        const input = screen.getByRole('textbox', { name: 'Name a country' })
        await userEvent.type(input, 'Denmark{Enter}')
        await userEvent.type(input, 'Holland{Enter}')
        expect(screen.getByText('2 / 46')).toBeInTheDocument()
        expect(painted()).toEqual({ Denmark: DEFAULT_THEME.correct, Netherlands: DEFAULT_THEME.correct })

        await userEvent.type(input, 'Malta{Enter}')
        const [emphasized] = layer.emphasize.mock.lastCall!
        expect([...(emphasized as Map<{ properties: { name: string } }, string>)].map(([c]) => c.properties.name)).toContain('Malta')

        hover(200) // France: no name while playing, it would give answers away
        await act(() => new Promise((r) => setTimeout(r, 50)))
        expect(tooltip()).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Give up and show the rest' }))
        const colors = painted()
        expect(colors.Denmark).toBe(DEFAULT_THEME.correct)
        expect(colors.France).toBe(DEFAULT_THEME.selected)
        expect(colors.Japan).toBeUndefined() // not in Europe
      })
    })

    it('ends the game when the panel is closed', async () => {
      await startGame(/Name that country/)
      await userEvent.click(screen.getByRole('button', { name: 'Close panel' }))
      expect(painted()).toEqual({})
      await userEvent.click(screen.getByRole('button', { name: 'Games' }))
      expect(screen.getByRole('button', { name: /Name that country/ })).toBeInTheDocument()
    })
  })
})
