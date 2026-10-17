import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ScreensaverCard from './ScreensaverCard'
import { DEFAULT_SETTINGS, SETTINGS_KEY, type Settings } from '../explore/useSettings'
import { unpackPlaces } from '../screensaver'

const settings = (changes: Partial<Settings> = {}) => ({ settings: { ...DEFAULT_SETTINGS, ...changes }, onChange: vi.fn() })

describe('ScreensaverCard', () => {
  it('explains the steps', () => {
    render(<ScreensaverCard onPreview={vi.fn()} {...settings()} />)
    expect(screen.getByText('npm run build:screensaver')).toBeInTheDocument()
    expect(screen.getByText('brew install --cask webviewscreensaver')).toBeInTheDocument()
  })

  it('gives an address for the shared folder that carries your places', () => {
    localStorage.setItem('countries-app.visited', JSON.stringify(['Fiji']))
    render(<ScreensaverCard onPreview={vi.fn()} {...settings()} />)
    const address = (screen.getByRole('textbox', { name: 'Screensaver address' }) as HTMLInputElement).value
    expect(address).toMatch(/^file:\/\/\/Users\/Shared\/Meridian\/index\.html\?screensaver#places=[\w-]+$/)

    localStorage.clear()
    unpackPlaces(address.slice(address.indexOf('#')))
    expect(localStorage.getItem('countries-app.visited')).toBe('["Fiji"]')
  })

  it('copies the address', async () => {
    const user = userEvent.setup()
    render(<ScreensaverCard onPreview={vi.fn()} {...settings()} />)
    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(
      (screen.getByRole('textbox', { name: 'Screensaver address' }) as HTMLInputElement).value,
    )
  })

  it('leaves the address in the box to copy by hand when there is no clipboard', async () => {
    const user = userEvent.setup()
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'))
    render(<ScreensaverCard onPreview={vi.fn()} {...settings()} />)
    await user.click(screen.getByRole('button', { name: 'Copy address' }))
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument()
    expect((screen.getByRole('textbox', { name: 'Screensaver address' }) as HTMLInputElement).value).toMatch(/^file:/)
  })

  it('selects the whole address when you click into it, to copy by hand', async () => {
    render(<ScreensaverCard onPreview={vi.fn()} {...settings()} />)
    const box = screen.getByRole('textbox', { name: 'Screensaver address' }) as HTMLInputElement
    await userEvent.click(box)
    expect([box.selectionStart, box.selectionEnd]).toEqual([0, box.value.length])
  })

  it('previews the screensaver in the app', async () => {
    const onPreview = vi.fn()
    render(<ScreensaverCard onPreview={onPreview} {...settings()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(onPreview).toHaveBeenCalled()
  })

  it('replays your timeline, switched on and off here, and only with the flights shown', async () => {
    const props = settings()
    const { rerender } = render(<ScreensaverCard onPreview={vi.fn()} {...props} />)
    const replay = screen.getByRole('switch', { name: 'Replay timeline' })
    expect(replay).toBeChecked()
    expect(replay).toHaveAccessibleDescription(/^Every so often, your trips come back one by one/)
    await userEvent.click(replay)
    expect(props.onChange).toHaveBeenCalledWith({ showScreensaverReplay: false })

    rerender(<ScreensaverCard onPreview={vi.fn()} {...settings({ showFlights: false })} />)
    expect(replay).not.toBeChecked()
    expect(replay).toBeDisabled()
    expect(replay).toHaveAccessibleDescription('Turn on Flights in the layers to replay your timeline.')
  })

  it('carries the settings as they are in the address, even before they are saved', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showScreensaverReplay: true }))
    render(<ScreensaverCard onPreview={vi.fn()} {...settings({ showScreensaverReplay: false })} />)
    const address = (screen.getByRole('textbox', { name: 'Screensaver address' }) as HTMLInputElement).value
    localStorage.clear()
    unpackPlaces(address.slice(address.indexOf('#')))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toMatchObject({ showScreensaverReplay: false })
  })
})
