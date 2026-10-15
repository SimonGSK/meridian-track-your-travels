import type { CountryFeature } from '../countries'
import { placeKey } from './facts'
import data from './languages.json'

/**
 * The languages spoken in each place, from the Unicode CLDR (languages.json,
 * by scripts/fetch-languages.mjs): the official ones first, then those
 * official in a part of it (Catalan in Spain), each by how many speak it; or,
 * for a place with none official, the most spoken.
 */

const byPlace = data as Record<string, string[]>
const names = new Intl.DisplayNames(['en'], { type: 'language' })

/** A place's languages, by name; those without an English one left out */
export const languagesOf = (country: CountryFeature): string[] =>
  (byPlace[placeKey(country)] ?? []).flatMap((code) => {
    const name = names.of(code)
    return name && name !== code ? [name] : []
  })
