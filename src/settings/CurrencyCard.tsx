import { useId, type ReactNode } from 'react'
import { CURRENCIES, currencyName, type Rates } from '../data/money'
import Card from '../ui/Card'

type Props = {
  /** The currency chosen, or null for automatic */
  chosen: string | null
  /** Automatic: the guess from where you are */
  guess: string
  onChoose: (currency: string | null) => void
  rates: Rates
  /** A way back, above the rest */
  back?: ReactNode
}

const dayMonthYear = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Your currency, for each country's panel to say what its money is worth in it: automatic, from where you are, or picked */
export default function CurrencyCard({ chosen, guess, onChoose, rates, back }: Props) {
  const id = useId()
  return (
    <Card label="Currency" meta={chosen ?? guess}>
      {back}
      <p className="muted">Each country's panel says what its money is worth in yours, and what time it is there.</p>
      <label className="field-label" htmlFor={id}>
        Your currency
      </label>
      <select id={id} className="currency-select" value={chosen ?? ''} onChange={(e) => onChoose(e.target.value || null)}>
        <option value="">
          Automatic: {guess}, {currencyName(guess)} (from your time zone)
        </option>
        {CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {code}, {currencyName(code)}
          </option>
        ))}
      </select>
      <p className="muted small">
        Rates of {dayMonthYear.format(new Date(rates.date))}, from the open currency-api. The day's rates are fetched
        once a day, when you open a country's panel and are online; that's all the app asks for from the internet.
      </p>
    </Card>
  )
}
