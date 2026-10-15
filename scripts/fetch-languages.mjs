// The languages spoken in each place, for its panel: from the Unicode CLDR
// (Unicode License), which has, for each country and territory, its
// languages, how many speak each, and whether each is official there, all
// over or in part of it. Kept: the official ones, then those official in a
// part of it (Catalan in Spain), each by how many speak it; or, for a place
// with none official, the most spoken.
//
//   npm run data:languages
import { readFile, writeFile } from 'node:fs/promises'

const SOURCE = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-core/supplemental/territoryInfo.json'
const OUTPUT = new URL('../src/data/languages.json', import.meta.url)
const facts = JSON.parse(await readFile(new URL('../src/data/country-facts.json', import.meta.url), 'utf8'))

/** Places whose languages are under other codes: on the map by name, or as one where the data has two (Jersey and Guernsey) */
const LANGUAGES_OF = { 'Indian Ocean Ter.': ['CX', 'CC'], JG: ['JE', 'GG'] }

const response = await fetch(SOURCE)
if (!response.ok) throw new Error(`${SOURCE}: ${response.status}`)
const { territoryInfo } = (await response.json()).supplemental

const OFFICIAL = new Set(['official', 'de_facto_official'])
/** "No language", or one not known: not one to name (Antarctica's) */
const NONE = new Set(['und', 'zxx'])

/** A place's languages: each by its code, the share who speak it, and whether it's official all over, or in part */
const languagesIn = (code) =>
  Object.entries(territoryInfo[code]?.languagePopulation ?? {}).flatMap(([tag, info]) => {
    // "sr_Latn" is Serbian all the same, and "zh_Hant" Chinese
    const language = tag.split('_')[0]
    if (NONE.has(language)) return []
    const share = Number(info._populationPercent ?? 0)
    return [{ language, share, official: OFFICIAL.has(info._officialStatus), regional: info._officialStatus === 'official_regional' }]
  })

const result = {}
const missing = []
for (const place of Object.keys(facts)) {
  const all = (LANGUAGES_OF[place] ?? [place]).flatMap(languagesIn)
  const bySpeakers = (list) => [...list].sort((a, b) => b.share - a.share)
  const chosen = [...bySpeakers(all.filter((l) => l.official)), ...bySpeakers(all.filter((l) => l.regional))]
  const shown = chosen.length ? chosen : bySpeakers(all).slice(0, 1)
  const languages = [...new Set(shown.map((l) => l.language))]
  if (languages.length) result[place] = languages
  else missing.push(place)
}

await writeFile(OUTPUT, JSON.stringify(result) + '\n')
console.log(`Wrote the languages of ${Object.keys(result).length} places to ${OUTPUT.pathname}; none for ${missing.join(', ')}`)
