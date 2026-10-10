import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VisitedTab, { type VisitedView } from './VisitedTab'

describe('VisitedTab', () => {
  const show = (view: VisitedView, onViewChange = vi.fn()) =>
    render(
      <VisitedTab
        view={view}
        onViewChange={onViewChange}
        places={5}
        trips={1}
        years={4}
        countries={<p>the countries</p>}
        tripsPanel={<p>the trips</p>}
        yearsPanel={<p>the years</p>}
      />,
    )

  it('shows your countries, counting your places', () => {
    show('countries')
    expect(screen.getByRole('tab', { name: 'Countries' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('the countries')
    expect(screen.getByText('5 places')).toBeInTheDocument()
  })

  it('shows your trips, counting them', () => {
    show('trips')
    expect(screen.getByRole('tabpanel', { name: 'Trips' })).toHaveTextContent('the trips')
    expect(screen.getByText('1 trip')).toBeInTheDocument()
  })

  it('shows your years, counting those with dates', () => {
    show('years')
    expect(screen.getByRole('tabpanel', { name: 'Years' })).toHaveTextContent('the years')
    expect(screen.getByText('4 years')).toBeInTheDocument()
  })

  it('switches with symbols, each named when pointed at and read out', () => {
    show('countries')
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Countries',
      'Trips',
      'Years',
    ])
    for (const tab of tabs) {
      expect(tab).toHaveAttribute('title', tab.getAttribute('aria-label'))
      expect(tab.querySelector('svg')).toBeInTheDocument()
      expect(tab).toHaveTextContent('')
    }
  })

  it('switches between them', async () => {
    const onViewChange = vi.fn()
    show('countries', onViewChange)
    await userEvent.click(screen.getByRole('tab', { name: 'Trips' }))
    expect(onViewChange).toHaveBeenCalledWith('trips')
  })
})
