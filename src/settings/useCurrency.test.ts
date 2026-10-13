import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { BUNDLED_RATES } from '../data/money'
import { CURRENCY_KEY, RATES_KEY, RATE_SOURCES, useHomeCurrency, useRates } from './useCurrency'

const answer = (data: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) } as Response)
const TODAY = { date: '2099-01-02', eur: { dkk: 7.4, jpy: 180, usd: 1.1, xyz: 3 } }

describe('your currency', () => {
  it('is the guess from your time zone until you choose one, kept from then on', () => {
    const { result } = renderHook(() => useHomeCurrency())
    expect(result.current.chosen).toBeNull()
    expect(result.current.currency).toBe(result.current.guess)
    act(() => result.current.choose('JPY'))
    expect(result.current.currency).toBe('JPY')
    expect(localStorage.getItem(CURRENCY_KEY)).toBe('"JPY"')
    act(() => result.current.choose(null))
    expect(result.current.currency).toBe(result.current.guess)
  })
})

describe('the rates', () => {
  afterEach(() => vi.mocked(fetch).mockReset())

  it("are the bundled ones, and nothing's fetched, until wanted", () => {
    const { result } = renderHook(() => useRates(false))
    expect(result.current).toBe(BUNDLED_RATES)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("fetch the day's when wanted, for the currencies places use, and keep them a day", async () => {
    vi.mocked(fetch).mockImplementation(() => answer(TODAY))
    const { result, rerender } = renderHook(({ wanted }) => useRates(wanted), { initialProps: { wanted: true } })
    await waitFor(() => expect(result.current.date).toBe('2099-01-02'))
    expect(fetch).toHaveBeenCalledWith(RATE_SOURCES[0])
    expect(result.current.rates).toEqual({ DKK: 7.4, JPY: 180, USD: 1.1 }) // not those no place uses
    expect(JSON.parse(localStorage.getItem(RATES_KEY)!)).toMatchObject({ date: '2099-01-02', fetchedAt: expect.any(Number) })
    // Not again the same day
    rerender({ wanted: false })
    rerender({ wanted: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('try the mirror when the first source fails, and stay with the bundled ones offline', async () => {
    vi.mocked(fetch).mockImplementation((url) => (url === RATE_SOURCES[0] ? Promise.reject(new TypeError('down')) : answer(TODAY)))
    const { result } = renderHook(() => useRates(true))
    await waitFor(() => expect(result.current.date).toBe('2099-01-02'))
    expect(fetch).toHaveBeenLastCalledWith(RATE_SOURCES[1])

    localStorage.clear()
    vi.mocked(fetch).mockImplementation(() => Promise.reject(new TypeError('offline')))
    const offline = renderHook(() => useRates(true))
    await act(async () => {})
    expect(offline.result.current).toBe(BUNDLED_RATES)
  })

  it('fetch again after a day', async () => {
    localStorage.setItem(RATES_KEY, JSON.stringify({ date: '2099-01-01', rates: { DKK: 7 }, fetchedAt: Date.now() - 25 * 3_600_000 }))
    vi.mocked(fetch).mockImplementation(() => answer(TODAY))
    const { result } = renderHook(() => useRates(true))
    expect(result.current.date).toBe('2099-01-01')
    await waitFor(() => expect(result.current.date).toBe('2099-01-02'))
  })
})
