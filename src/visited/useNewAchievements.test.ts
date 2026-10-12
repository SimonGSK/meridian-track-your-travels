import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNewAchievements } from './useNewAchievements'
import type { Atlas } from './achievements'

const atlas = (visited: string[], cities: { capital?: boolean }[] = []): Atlas => ({
  visited: new Set(visited),
  regions: new Set(),
  cities,
  flights: [],
  visitsTo: () => 0,
  trips: [],
})

function setup(first: Atlas, loaded = true) {
  return renderHook(({ atlas, loaded }) => useNewAchievements(atlas, loaded), { initialProps: { atlas: first, loaded } })
}
const ids = (result: { current: ReturnType<typeof useNewAchievements> }) => result.current[0].map((a) => a.id)

describe('useNewAchievements', () => {
  it('says nothing about those earned already when the app opens', () => {
    const { result } = setup(atlas(['Denmark', 'Norway', 'Sweden']))
    expect(ids(result)).toEqual([])
  })

  it('gives the ones just earned, and clears them', () => {
    const { result, rerender } = setup(atlas(['Denmark', 'Norway']))
    rerender({ atlas: atlas(['Denmark', 'Norway', 'Sweden']), loaded: true })
    expect(ids(result)).toEqual(['scandinavia'])
    act(() => result.current[1]())
    expect(ids(result)).toEqual([])
  })

  it('says nothing when one is lost again, or nothing changes', () => {
    const { result, rerender } = setup(atlas(['Denmark', 'Norway', 'Sweden']))
    rerender({ atlas: atlas(['Denmark', 'Norway']), loaded: true })
    rerender({ atlas: atlas(['Denmark', 'Norway']), loaded: true })
    expect(ids(result)).toEqual([])
  })

  it('says nothing when one lost is earned again, as when a removal is undone', () => {
    const { result, rerender } = setup(atlas(['Denmark', 'Norway']))
    rerender({ atlas: atlas(['Denmark', 'Norway', 'Sweden']), loaded: true })
    act(() => result.current[1]())
    rerender({ atlas: atlas(['Denmark', 'Norway']), loaded: true })
    rerender({ atlas: atlas(['Denmark', 'Norway', 'Sweden']), loaded: true })
    expect(ids(result)).toEqual([])
  })

  it('says nothing while the cities and airports load, nor when they arrive', () => {
    const capitals = Array.from({ length: 10 }, () => ({ capital: true }))
    const { result, rerender } = setup(atlas(['Denmark']), false)
    rerender({ atlas: atlas(['Denmark', 'Norway', 'Sweden']), loaded: false })
    // Loaded: the capitals already visited count now, but nothing was done
    rerender({ atlas: atlas(['Denmark', 'Norway', 'Sweden'], capitals), loaded: true })
    expect(ids(result)).toEqual([])
    rerender({ atlas: atlas(['Denmark', 'Norway', 'Sweden', 'Finland', 'Iceland'], capitals), loaded: true })
    expect(ids(result)).toEqual(['nordics'])
  })
})
