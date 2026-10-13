// Exchange rates for the currencies places use, bundled with the app so it
// can convert straight away and offline; the app fetches the day's own once
// a day when online (src/data/rates.ts). From the open currency-api
// (fawazahmed0/exchange-api, public domain), per euro.
//
//   npm run data:rates
import { readFile, writeFile } from 'node:fs/promises'

const SOURCES = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.min.json',
  'https://latest.currency-api.pages.dev/v1/currencies/eur.min.json',
]
const OUTPUT = new URL('../src/data/rates.json', import.meta.url)
const places = JSON.parse(await readFile(new URL('../src/data/currencies.json', import.meta.url), 'utf8'))
const wanted = [...new Set(Object.values(places).flat())].sort()

let data
for (const source of SOURCES) {
  const response = await fetch(source).catch(() => null)
  if (response?.ok) {
    data = await response.json()
    break
  }
}
if (!data) throw new Error('No rates from any source')

const rates = Object.fromEntries(wanted.flatMap((code) => (data.eur[code.toLowerCase()] ? [[code, data.eur[code.toLowerCase()]]] : [])))
await writeFile(OUTPUT, JSON.stringify({ date: data.date, rates }) + '\n')
const missing = wanted.filter((code) => !(code in rates))
console.log(`Wrote ${Object.keys(rates).length} rates of ${data.date} to ${OUTPUT.pathname}${missing.length ? `; none for ${missing.join(', ')}` : ''}`)
