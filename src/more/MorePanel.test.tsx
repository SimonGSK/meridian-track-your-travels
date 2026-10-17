import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import MorePanel, { type MoreId } from './MorePanel'
import { BUNDLED_RATES } from '../data/money'
import { DEFAULT_SETTINGS } from '../explore/useSettings'

/** The panel, keeping what's open, and the currency chosen, as the app does */
function Panel({ onPreview = vi.fn(), friend = null }: { onPreview?: () => void; friend?: string | null }) {
  const [open, setOpen] = useState<MoreId | null>(null)
  const [chosen, choose] = useState<string | null>(null)
  return (
    <MorePanel
      open={open}
      onOpen={setOpen}
      earned={3}
      achievementCount={50}
      achievements={<p>the achievements</p>}
      friend={friend}
      compare={<p>the comparison</p>}
      onPreview={onPreview}
      settings={DEFAULT_SETTINGS}
      onSettingsChange={vi.fn()}
      currency={{ chosen, guess: 'DKK', onChoose: choose, rates: BUNDLED_RATES }}
    />
  )
}

const back = () => userEvent.click(screen.getByRole('button', { name: '← Back' }))

describe('MorePanel', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList)
  })
  afterEach(() => Reflect.deleteProperty(window, 'matchMedia'))

  it('shows each thing as a small card, named, with a line on what it is', () => {
    render(<Panel />)
    expect(screen.getByRole('button', { name: 'Achievements' })).toHaveAccessibleDescription('3 of 50 earned')
    expect(screen.getByRole('button', { name: 'Compare with a friend' })).toHaveAccessibleDescription(
      "See where you've both been",
    )
    expect(screen.getByRole('button', { name: 'Backup' })).toHaveAccessibleDescription('Keep your places safe in a file')
    expect(screen.getByRole('button', { name: 'App' })).toHaveAccessibleDescription('Install Meridian, and use it offline')
    expect(screen.getByRole('button', { name: 'Screensaver' })).toHaveAccessibleDescription('The globe as a Mac screensaver')
    // Only the cards, not what's in them
    expect(screen.queryByText('the achievements')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Download backup' })).not.toBeInTheDocument()
  })

  it('has the settings apart, under their own heading', () => {
    render(<Panel />)
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    const settings = within(screen.getByRole('list', { name: 'Settings' }))
    expect(settings.getAllByRole('button')).toHaveLength(4)
    for (const name of ['Currency', 'Backup', 'App', 'Screensaver']) expect(settings.getByRole('button', { name })).toBeInTheDocument()
    expect(settings.queryByRole('button', { name: 'Achievements' })).not.toBeInTheDocument()
  })

  it('picks your currency, automatic from your time zone at first', async () => {
    render(<Panel />)
    expect(screen.getByRole('button', { name: 'Currency' })).toHaveAccessibleDescription('DKK, from your time zone')
    await userEvent.click(screen.getByRole('button', { name: 'Currency' }))
    const select = screen.getByRole('combobox', { name: 'Your currency' })
    expect(select).toHaveDisplayValue('Automatic: DKK, Danish Krone (from your time zone)')
    expect(screen.getByRole('region', { name: 'Currency' })).toHaveTextContent(/Rates of \d+ \w+ \d{4}, from the open currency-api/)
    await userEvent.selectOptions(select, 'JPY')
    expect(select).toHaveDisplayValue('JPY, Japanese Yen')
    await back()
    expect(screen.getByRole('button', { name: 'Currency' })).toHaveAccessibleDescription('JPY')
  })

  it('names the friend you compare with', () => {
    render(<Panel friend="Anna" />)
    expect(screen.getByRole('button', { name: 'Compare with a friend' })).toHaveAccessibleDescription(
      'Where you and Anna have been',
    )
  })

  it('opens the achievements, counting those earned, and goes back', async () => {
    render(<Panel />)
    await userEvent.click(screen.getByRole('button', { name: 'Achievements' }))
    expect(screen.getByRole('region', { name: 'Achievements' })).toHaveTextContent('the achievements')
    expect(screen.getByText('3 / 50')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Backup' })).not.toBeInTheDocument()
    await back()
    expect(screen.getByRole('button', { name: 'Backup' })).toBeInTheDocument()
  })

  it('opens the comparison, named for the friend', async () => {
    render(<Panel friend="Anna" />)
    await userEvent.click(screen.getByRole('button', { name: 'Compare with a friend' }))
    expect(screen.getByRole('region', { name: 'Compare' })).toHaveTextContent('the comparison')
    expect(screen.getByRole('region', { name: 'Compare' })).toHaveTextContent('with Anna')
  })

  it('opens a setting to all of it, and goes back to the rest', async () => {
    render(<Panel />)
    await userEvent.click(screen.getByRole('button', { name: 'Backup' }))
    expect(screen.getByRole('region', { name: 'Backup' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download backup' })).toBeInTheDocument()
    await back()
    await userEvent.click(screen.getByRole('button', { name: 'App' }))
    expect(screen.getByRole('region', { name: 'App' })).toHaveTextContent('works without internet too')
  })

  it('previews the screensaver from its card', async () => {
    const onPreview = vi.fn()
    render(<Panel onPreview={onPreview} />)
    await userEvent.click(screen.getByRole('button', { name: 'Screensaver' }))
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(onPreview).toHaveBeenCalledOnce()
  })

  it("says when it's installed already", () => {
    window.matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList)
    render(<Panel />)
    expect(screen.getByRole('button', { name: 'App' })).toHaveAccessibleDescription('Installed, and works offline')
  })
})
