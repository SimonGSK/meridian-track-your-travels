import { useEffect, useState, type MouseEvent } from 'react'
import { searchCountries, type CountryFeature } from '../countries'
import { countryOfCity, findCities, type City } from '../data/cities'
import { normalizeName } from '../data/names'
import DesignPanel from '../design/DesignPanel'
import type { Theme } from '../globe/themes'
import { LayersIcon, SearchIcon } from '../icons'
import Card from '../ui/Card'
import LayerList from './LayerList'
import type { Settings } from './useSettings'
import { noAutofill } from '../ui/noAutofill'

type Props = {
  settings: Settings
  onChange: (changes: Partial<Settings>) => void
  theme: Theme
  onThemeChange: (id: string) => void
  /** Shows a country found by searching */
  onFind: (country: CountryFeature) => void
  cities: readonly City[] | null
}

type Tool = 'search' | 'layers'

/**
 * The Explore tab: two round buttons in the corner, so the globe has the
 * room. The magnifying glass opens a search of the atlas, and the layers
 * button the designs and the layers, one at a time.
 */
export default function ExplorePanel({ settings, onChange, theme, onThemeChange, onFind, cities }: Props) {
  const [open, setOpen] = useState<Tool | null>(null)
  const toggle = (tool: Tool) => setOpen((current) => (current === tool ? null : tool))
  // Keeps the focus in the search, so it doesn't put itself away just before its button toggles it
  const keepFocus = (e: MouseEvent) => e.preventDefault()

  // Escape closes what's open before anything else
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(null)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  return (
    // The open tab's panel, as the tabs say, though only buttons in a corner
    <section id="side-panel" className="explore-tools" aria-label="Explore">
      <div className="tool-row">
        {open === 'search' && <AtlasSearch cities={cities} onFind={onFind} onClose={() => setOpen(null)} />}
        <button
          type="button"
          className="tool-button"
          aria-label="Search the atlas"
          aria-expanded={open === 'search'}
          title="Search the atlas"
          onMouseDown={keepFocus}
          onClick={() => toggle('search')}
        >
          <SearchIcon size={20} />
        </button>
      </div>
      <button
        type="button"
        className="tool-button"
        aria-label="Style and layers"
        aria-expanded={open === 'layers'}
        title="Style and layers"
        onMouseDown={keepFocus}
        onClick={() => toggle('layers')}
      >
        <LayersIcon size={20} />
      </button>
      {open === 'layers' && (
        <Card label="Style" className="layers-card">
          <DesignPanel theme={theme} onChange={onThemeChange} />
          <h3>Layers</h3>
          <LayerList settings={settings} theme={theme} onChange={onChange} />
        </Card>
      )}
    </section>
  )
}

type Result = { key: string; name: string; note: string; country: CountryFeature }

/** Countries by any of their names, and cities, each showing its country */
function AtlasSearch({
  cities,
  onFind,
  onClose,
}: Pick<Props, 'cities' | 'onFind'> & {
  /** After finding a place, or leaving the box empty */
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const wanted = normalizeName(query)
  const results: Result[] = wanted
    ? [
        ...searchCountries(query, undefined, 5).map(({ country, matchedAlias }) => ({
          key: country.properties.name,
          name: country.properties.name,
          note: matchedAlias ? `“${matchedAlias}”` : country.properties.continent,
          country,
        })),
        // From the start of any word: "nelspruit" finds "Mbombela (Nelspruit)"
        ...findCities(cities ?? [], query, 4).flatMap((city) => {
          const country = countryOfCity(city)
          return country ? [{ key: `city-${city.id}`, name: city.name, note: country.properties.name, country }] : []
        }),
      ]
    : []

  const find = (result: Result) => {
    onFind(result.country)
    setQuery('')
    onClose()
  }

  return (
    <div
      className="atlas-search"
      role="search"
      // Clicking away from an empty box puts it away
      onBlur={(e) => !query && !e.currentTarget.contains(e.relatedTarget) && onClose()}
    >
      <input
        {...noAutofill('atlas')}
        type="search"
        aria-label="Search the atlas"
        placeholder="Search the atlas"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && results[0] && find(results[0])}
      />
      {wanted && (
        <ul className="suggestions" aria-label="Places found">
          {results.map((result) => (
            <li key={result.key}>
              <button type="button" onClick={() => find(result)}>
                <span>{result.name}</span>
                <span className="row-meta">{result.note}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted">Nothing called “{query.trim()}”.</li>}
        </ul>
      )}
    </div>
  )
}
