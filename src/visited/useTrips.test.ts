import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { TripItem } from '../data/savedTrips'
import { TRIPS_KEY, useTrips } from './useTrips'

const japan: TripItem = { kind: 'visit', place: 'Japan', date: '2024-04' }
const korea: TripItem = { kind: 'visit', place: 'South Korea', date: null }
const flight: TripItem = { kind: 'flight', flight: 'a' }
const saved = () => JSON.parse(localStorage.getItem(TRIPS_KEY)!)

describe('useTrips', () => {
  afterEach(() => localStorage.clear())

  it("is null before any trips are made, so they're made from the flights once", () => {
    const { result } = renderHook(() => useTrips())
    expect(result.current.trips).toBeNull()
    act(() => result.current.start([{ id: 'old', name: 'From flights', items: [flight] }]))
    act(() => result.current.start([]))
    expect(result.current.trips).toEqual([{ id: 'old', name: 'From flights', items: [flight] }])
    expect(saved()).toEqual(result.current.trips)
  })

  it('makes trips, and puts each visit or flight in one at a time', () => {
    const { result } = renderHook(() => useTrips())
    let first = ''
    let second = ''
    act(() => {
      first = result.current.create('Asia', [japan, flight])
    })
    act(() => {
      second = result.current.create('Later', [flight])
    })
    expect(result.current.trips!.map((t) => [t.name, t.items])).toEqual([
      ['Asia', [japan]],
      ['Later', [flight]],
    ])
    act(() => result.current.add(first, korea, 0))
    act(() => result.current.add(first, flight, 1))
    expect(result.current.trips!.find((t) => t.id === first)!.items).toEqual([korea, flight, japan])
    expect(result.current.trips!.find((t) => t.id === second)!.items).toEqual([])
  })

  it('takes things out, and moves them about', () => {
    const { result } = renderHook(() => useTrips())
    let id = ''
    act(() => {
      id = result.current.create('Asia', [japan, flight, korea])
    })
    act(() => result.current.move(id, [japan, flight, korea], 2, 0))
    expect(result.current.trips![0].items).toEqual([korea, japan, flight])
    act(() => result.current.takeOut('flight:a'))
    expect(result.current.trips![0].items).toEqual([korea, japan])
  })

  it('keeps a visit in its trip when its date changes', () => {
    const { result } = renderHook(() => useTrips())
    act(() => {
      result.current.create('Asia', [japan, korea])
    })
    act(() => result.current.redate('South Korea', null, '2024-04'))
    act(() => result.current.redate('Japan', '2024-04', '2024-05'))
    expect(result.current.trips![0].items).toEqual([
      { kind: 'visit', place: 'Japan', date: '2024-05' },
      { kind: 'visit', place: 'South Korea', date: '2024-04' },
    ])
  })

  it('names and notes a trip, and removes one, to be put back', () => {
    const { result } = renderHook(() => useTrips())
    let id = ''
    act(() => {
      id = result.current.create('', [japan])
    })
    act(() => result.current.rename(id, { name: 'Tokyo', note: 'Spring' }))
    expect(result.current.trips![0]).toMatchObject({ name: 'Tokyo', note: 'Spring' })
    act(() => result.current.rename(id, { name: 'Tokyo', note: '' }))
    expect(result.current.trips![0]).not.toHaveProperty('note')
    let undo = () => {}
    act(() => {
      undo = result.current.remove(id)
    })
    expect(result.current.trips).toEqual([])
    act(() => undo())
    expect(result.current.trips![0]).toMatchObject({ id, name: 'Tokyo', items: [japan] })
  })
})
