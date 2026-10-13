import { useEffect, useState } from 'react'
import { usePersistentState } from '../storage'
import { BUNDLED_RATES, CURRENCIES, guessCurrency, type Rates } from '../data/money'

/** Your currency, as chosen in Settings; none saved is automatic, from where you are */
export const CURRENCY_KEY = 'countries-app.currency'
/** The day's rates, as last fetched, and when */
export const RATES_KEY = 'countries-app.rates'

/** Fetched once a day at most */
const DAY_MS = 24 * 60 * 60 * 1000

/** The open currency-api (fawazahmed0/exchange-api, public domain), and its mirror, per euro */
export const RATE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/eur.min.json',
]

export const isCurrencyOrNone = (value: unknown): value is string | null =>
  value === null || (typeof value === 'string' && CURRENCIES.includes(value))

/** Your currency: the one chosen in Settings, or the guess from where you are */
export function useHomeCurrency() {
  const [chosen, choose] = usePersistentState<string | null>(CURRENCY_KEY, null, isCurrencyOrNone)
  const [guess] = useState(() => guessCurrency())
  return { currency: chosen ?? guess, chosen, guess, choose }
}

type FetchedRates = Rates & { fetchedAt: number }

const isFetchedRates = (value: unknown): value is FetchedRates | null => {
  if (value === null) return true
  if (typeof value !== 'object') return false
  const { date, rates, fetchedAt } = value as Partial<FetchedRates>
  return (
    typeof date === 'string' &&
    typeof fetchedAt === 'number' &&
    typeof rates === 'object' &&
    rates !== null &&
    Object.values(rates).every((rate) => typeof rate === 'number' && rate > 0)
  )
}

/** The day's rates, for the currencies places use, from the first source that answers; null offline */
export async function fetchRates(): Promise<Rates | null> {
  for (const source of RATE_SOURCES) {
    try {
      const response = await fetch(source)
      if (!response.ok) continue
      const data = (await response.json()) as { date: string; eur: Record<string, number> }
      const rates = Object.fromEntries(CURRENCIES.flatMap((code) => (data.eur[code.toLowerCase()] > 0 ? [[code, data.eur[code.toLowerCase()]]] : [])))
      return { date: data.date, rates }
    } catch {
      // Offline, or the source is down: try the next
    }
  }
  return null
}

/**
 * The rates to convert with: those bundled with the app, or the day's,
 * fetched at most once a day, and only while `wanted` (a country's panel is
 * open), so nothing is asked for until you look
 */
export function useRates(wanted: boolean): Rates {
  const [fetched, setFetched] = usePersistentState<FetchedRates | null>(RATES_KEY, null, isFetchedRates)
  useEffect(() => {
    if (!wanted || (fetched && Date.now() - fetched.fetchedAt < DAY_MS)) return
    let gone = false
    void fetchRates().then((rates) => {
      if (!gone && rates) setFetched({ ...rates, fetchedAt: Date.now() })
    })
    return () => {
      gone = true
    }
  }, [wanted, fetched, setFetched])
  return fetched && fetched.date >= BUNDLED_RATES.date ? fetched : BUNDLED_RATES
}
