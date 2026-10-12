import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import AchievementsPanel from './AchievementsPanel'
import { ACHIEVEMENTS, GROUPS, type Atlas } from './achievements'

const atlas = (changes: Partial<Atlas> = {}): Atlas => ({
  visited: new Set(),
  regions: new Set(),
  cities: [],
  flights: [],
  visitsTo: () => 0,
  trips: [],
  ...changes,
})
const group = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const item = (title: string) => screen.getByText(title, { selector: '.achievement-title' }).closest('li')!

describe('AchievementsPanel', () => {
  it('shows every achievement, by group', () => {
    render(<AchievementsPanel atlas={atlas()} />)
    for (const name of GROUPS) expect(group(name)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(ACHIEVEMENTS.length)
  })

  it('counts what is earned, in all and per group', () => {
    render(<AchievementsPanel atlas={atlas({ visited: new Set(['Denmark', 'Norway', 'Sweden']) })} />)
    const stat = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling
    expect(stat('Earned')).toHaveTextContent(`2 / ${ACHIEVEMENTS.length}`) // First stamp and Scandinavia
    expect(stat('Regions')).toHaveTextContent(/^1 \/ \d+$/)
    expect(within(group('Milestones')).getByRole('heading')).toHaveTextContent(/^Milestones 1 \/ 7$/)
  })

  it('marks earned achievements', () => {
    render(<AchievementsPanel atlas={atlas({ visited: new Set(['Denmark', 'Norway', 'Sweden']) })} />)
    expect(item('Scandinavia')).toHaveClass('earned')
    expect(within(item('Scandinavia')).getByLabelText('Earned')).toBeInTheDocument()
    expect(item('The Nordics')).not.toHaveClass('earned')
    expect(within(item('The Nordics')).queryByLabelText('Earned')).not.toBeInTheDocument()
  })

  it('shows how far along the others are', () => {
    render(<AchievementsPanel atlas={atlas({ visited: new Set(['Denmark', 'Norway', 'Sweden']), flights: [{ km: 12_000.4 }] })} />)
    expect(item('The Nordics')).toHaveTextContent('3 of 5')
    expect(item('Around the world')).toHaveTextContent('12,000 km of 40,075 km')
    const bar = item('The Nordics').querySelector<HTMLElement>('.progress > span')!
    expect(bar.style.width).toBe('60%')
  })

  it('shows no count for an achievement that takes just one', () => {
    render(<AchievementsPanel atlas={atlas()} />)
    expect(item('Wheels up')).not.toHaveTextContent(/of/)
    expect(item('Wheels up').querySelector('.achievement-progress')).toBeNull()
  })
})
