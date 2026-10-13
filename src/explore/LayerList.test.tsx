import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerList from './LayerList'
import { DEFAULT_SETTINGS, type Settings } from './useSettings'
import { CLASSIC, MIDNIGHT, type Theme } from '../globe/themes'

function setup({ settings = DEFAULT_SETTINGS, theme = MIDNIGHT }: { settings?: Settings; theme?: Theme } = {}) {
  const props = { settings, onChange: vi.fn() }
  render(<LayerList {...props} theme={theme} />)
  return props
}

/** A layer's dot */
const dotOf = (name: string) => screen.getByRole('switch', { name: new RegExp(`^${name}`) }).querySelector('.dot') as HTMLElement
/** A color as the browser gives it back */
const rgb = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

describe('LayerList', () => {
  it('has a switch for each layer, showing its state', () => {
    setup({ settings: { ...DEFAULT_SETTINGS, showMarkers: false } })
    expect(screen.getByRole('switch', { name: /Visited countries/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Visited states/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /City pins/ })).toBeChecked()
    expect(screen.getByRole('switch', { name: /Small islands/ })).not.toBeChecked()
  })

  it('offers city lights only while day and night is on, under it', async () => {
    setup({ settings: { ...DEFAULT_SETTINGS, showDayNight: false } })
    expect(screen.queryByRole('switch', { name: /City lights/ })).not.toBeInTheDocument()
    cleanup()
    const { onChange } = setup({ settings: { ...DEFAULT_SETTINGS, showDayNight: true } })
    const lights = screen.getByRole('switch', { name: /City lights/ })
    expect(lights).toBeChecked()
    expect(lights.closest('li')).toHaveClass('sublayer')
    await userEvent.click(lights)
    expect(onChange).toHaveBeenCalledWith({ showCityLights: false })
  })

  it('lists the layers by color, and by name within a color, a layer offered under another after it', () => {
    setup({ settings: { ...DEFAULT_SETTINGS, showVisitHeat: true, showDayNight: true } })
    expect(screen.getAllByRole('switch').map((s) => s.textContent)).toEqual([
      'City pins',
      'Visited countries',
      'Heat map by visits',
      'Visited states',
      'Flights',
      'Replay in screensaver',
      'Future flights',
      'Future visits',
      'Wishlist',
      'Day and night',
      'City lights',
      'Small islands',
    ])
  })

  it("colors each layer's dot as it is on the globe in the design shown", () => {
    setup()
    expect(dotOf('City pins').style.background).toBe(rgb(MIDNIGHT.pin))
    expect(dotOf('Visited countries').style.background).toBe(rgb(MIDNIGHT.visited))
    expect(dotOf('Flights').style.background).toBe(rgb(MIDNIGHT.flight))
    expect(dotOf('Wishlist').style.background).toBe(rgb(MIDNIGHT.wishlist))
    expect(dotOf('Future flights').style.boxShadow).toContain(MIDNIGHT.flight)
    expect(dotOf('Future visits').style.boxShadow).toContain(MIDNIGHT.flight)
    cleanup()
    setup({ theme: CLASSIC })
    expect(dotOf('City pins').style.background).toBe(rgb(CLASSIC.pin))
    expect(dotOf('Visited countries').style.background).toBe(rgb(CLASSIC.visited))
  })

  it("turns trips to come's flights and visits on and off, each on its own", async () => {
    const { onChange } = setup({ settings: { ...DEFAULT_SETTINGS, showFutureVisits: false } })
    const flights = screen.getByRole('switch', { name: /Future flights/ })
    expect(flights).toBeChecked()
    await userEvent.click(flights)
    expect(onChange).toHaveBeenCalledWith({ showFutureFlights: false })
    const visits = screen.getByRole('switch', { name: /Future visits/ })
    expect(visits).not.toBeChecked()
    await userEvent.click(visits)
    expect(onChange).toHaveBeenCalledWith({ showFutureVisits: true })
  })

  it('offers the replay in the screensaver only while the flights are on, under them', async () => {
    setup({ settings: { ...DEFAULT_SETTINGS, showFlights: false } })
    expect(screen.queryByRole('switch', { name: /Replay in screensaver/ })).not.toBeInTheDocument()
    cleanup()
    const { onChange } = setup()
    const replay = screen.getByRole('switch', { name: /Replay in screensaver/ })
    expect(replay).toBeChecked()
    expect(replay.closest('li')).toHaveClass('sublayer')
    await userEvent.click(replay)
    expect(onChange).toHaveBeenCalledWith({ showScreensaverReplay: false })
  })

  it('turns layers on and off', async () => {
    const { onChange } = setup({ settings: { ...DEFAULT_SETTINGS, showMarkers: false } })
    await userEvent.click(screen.getByRole('switch', { name: /City pins/ }))
    expect(onChange).toHaveBeenCalledWith({ showCities: false })
    await userEvent.click(screen.getByRole('switch', { name: /Small islands/ }))
    expect(onChange).toHaveBeenCalledWith({ showMarkers: true })
  })
})
