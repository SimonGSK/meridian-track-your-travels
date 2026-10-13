// Which currency each place uses, for its panel to say what yours is worth
// there: from the Unicode CLDR (Unicode License), the locale data browsers
// are built on, which lists every currency each country and territory has
// used, and since and until when. Only those in use today, and legal tender,
// are kept.
//
//   npm run data:currencies
import { readFile, writeFile } from 'node:fs/promises'

const SOURCE = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/currencyData.json'
const OUTPUT = new URL('../src/data/currencies.json', import.meta.url)
const facts = JSON.parse(await readFile(new URL('../src/data/country-facts.json', import.meta.url), 'utf8'))

/** Places whose currencies are under other codes: on the map by name, or as one where the data has two (Jersey and Guernsey) */
const CURRENCIES_OF = { 'Indian Ocean Ter.': ['CX', 'CC'], JG: ['JE', 'GG'] }

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`${SOURCE}: ${response.status}`)
const { region } = (await response.json()).supplemental.currencyData

/** A region's currencies today, as legal tender, in the order CLDR lists them */
const currenciesOf = (code) =>
  (region[code] ?? []).flatMap((entry) =>
    Object.entries(entry).flatMap(([currency, { _to, _tender }]) => (_to || _tender === 'false' ? [] : [currency])),
  )

const result = {}
const missing = []
for (const place of Object.keys(facts)) {
  const currencies = [...new Set((CURRENCIES_OF[place] ?? [place]).flatMap(currenciesOf))]
  if (currencies.length) result[place] = currencies
  else missing.push(place)
}

await writeFile(OUTPUT, JSON.stringify(result) + '\n')
console.log(`Wrote the currencies of ${Object.keys(result).length} places to ${OUTPUT.pathname}; none for ${missing.join(', ')}`)
