import { describe, expect, it } from 'vitest'
import { findCountryByName } from '../countries'
import { BUNDLED_RATES, CURRENCIES, currenciesOf, currencyName, exchange, formatSum, formatWorth, guessCurrency } from './money'

const country = (name: string) => findCountryByName(name)!
const RATES = { date: '2026-10-13', rates: { EUR: 1, DKK: 7.5, JPY: 175, IDR: 18_000, KWD: 0.34 } }

describe('money', () => {
  it("knows each place's currency today, its main one first", () => {
    expect(currenciesOf(country('Japan'))).toEqual(['JPY'])
    expect(currenciesOf(country('Germany'))).toEqual(['EUR'])
    expect(currenciesOf(country('Kosovo'))).toEqual(['EUR'])
    expect(currenciesOf(country('Ecuador'))).toEqual(['USD'])
    expect(currenciesOf(country('Panama'))).toEqual(['PAB', 'USD'])
    expect(currenciesOf(country('Antarctica'))).toEqual([])
  })

  it('has a bundled rate for every currency a place uses', () => {
    for (const code of CURRENCIES) expect(BUNDLED_RATES.rates[code]).toBeGreaterThan(0)
    expect(BUNDLED_RATES.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('names currencies', () => {
    expect(currencyName('JPY')).toBe('Japanese Yen')
    expect(currencyName('DKK')).toBe('Danish Krone')
  })

  it('compares a round sum, the smallest worth at least one of yours', () => {
    expect(exchange('JPY', 'DKK', RATES)).toEqual({ amount: 100, worth: expect.closeTo(100 * (7.5 / 175), 6) })
    expect(exchange('EUR', 'DKK', RATES)).toEqual({ amount: 1, worth: 7.5 })
    expect(exchange('IDR', 'DKK', RATES)!.amount).toBe(10_000)
    expect(exchange('KWD', 'DKK', RATES)!.amount).toBe(1)
    expect(exchange('XYZ', 'DKK', RATES)).toBeNull()
  })

  it('writes sums and what they are worth', () => {
    expect(formatSum(10_000)).toBe('10,000')
    expect(formatWorth(4.2857)).toBe('4.29')
    expect(formatWorth(22.06)).toBe('22.06')
    expect(formatWorth(1234.5)).toBe('1,235')
  })

  it('guesses your currency from your time zone, else your language, else the dollar', () => {
    expect(guessCurrency('Europe/Copenhagen', ['en-US'])).toBe('DKK')
    expect(guessCurrency('Asia/Tokyo', [])).toBe('JPY')
    expect(guessCurrency('Etc/UTC', ['da-DK', 'en'])).toBe('DKK')
    expect(guessCurrency('Etc/UTC', ['fr'])).toBe('USD')
    expect(guessCurrency('Europe/Skopje', [])).toBe('MKD') // not Kosovo, which borrows Skopje's zone
  })
})
