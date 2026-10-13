import type { CountryFeature } from '../countries'
import { placeKey } from './facts'
import { placeOfZone } from './localTime'
import places from './currencies.json'
import bundled from './rates.json'

/**
 * Each place's currency, from the Unicode CLDR (currencies.json, by
 * scripts/fetch-currencies.mjs), and what it's worth in yours, by rates per
 * euro: those bundled with the app (rates.json, by scripts/fetch-rates.mjs),
 * or the day's, fetched when online (src/settings/useCurrency.ts).
 */

/** Rates of a day, per euro, by currency code */
export type Rates = { date: string; rates: Record<string, number> }

export const BUNDLED_RATES: Rates = bundled

const currenciesByPlace = places as Record<string, string[]>

/** The currencies a place uses today, its main one first; none for a place nobody lives (Antarctica) */
export const currenciesOf = (country: CountryFeature): readonly string[] => currenciesByPlace[placeKey(country)] ?? []

/** Every currency a place uses, A to Z */
export const CURRENCIES: readonly string[] = [...new Set(Object.values(currenciesByPlace).flat())].sort()

const names = new Intl.DisplayNames(['en'], { type: 'currency' })
/** "Japanese Yen" */
export const currencyName = (code: string) => names.of(code) ?? code

/**
 * What a sum in one currency is worth in another: a round sum (1, 10,
 * 100…), the smallest worth at least 1 of the other, as "100 JPY = 4.23 DKK"
 * reads best. Null without a rate for either.
 */
export function exchange(from: string, to: string, { rates }: Rates): { amount: number; worth: number } | null {
  const [perEuroFrom, perEuroTo] = [rates[from], rates[to]]
  if (!perEuroFrom || !perEuroTo) return null
  const rate = perEuroTo / perEuroFrom
  let amount = 1
  while (amount * rate < 1 && amount < 1e12) amount *= 10
  return { amount, worth: amount * rate }
}

const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** A round sum: "100", "10,000" */
export const formatSum = (sum: number) => whole.format(sum)
/** What it's worth: "4.23", "0.95", "1,234" */
export const formatWorth = (worth: number) => (worth >= 1000 ? whole : cents).format(worth)

/**
 * A guess at your currency, from where you are: your device's time zone
 * ("Europe/Copenhagen" is Denmark's, so DKK), set by where it is; else the
 * region of your language ("da-DK"); else the US dollar
 */
export function guessCurrency(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  languages: readonly string[] = navigator.languages ?? [navigator.language],
) {
  const place = placeOfZone.get(timeZone)
  const regions = languages.flatMap((language) => {
    try {
      return new Intl.Locale(language).region ?? []
    } catch {
      return []
    }
  })
  for (const key of [place, ...regions]) {
    const currency = key ? currenciesByPlace[key]?.[0] : undefined
    if (currency) return currency
  }
  return 'USD'
}
