import type { CSSProperties } from 'react'
import { Color } from 'three'
import { EyeIcon, EyeOffIcon } from '../icons'
import { LIGHT_COLOR, NIGHT_COLOR } from '../globe/nightLayer'
import { landColor, plannedColor, visitedRegionColor, type Theme } from '../globe/themes'
import type { Settings } from './useSettings'

type Layer = {
  key: keyof Settings
  label: string
  description: string
  /** Its dot, in the color it is on the globe in this design */
  dot: (theme: Theme) => CSSProperties
  /** Only offered while this layer is on, indented under it */
  under?: keyof Settings
}

const land = (theme: Theme) => landColor(theme, 0)
const lit = (color: string) => '#' + new Color(color).lerp(new Color('#ffffff'), 0.15).getHexString()

/**
 * By color, as on the globe in the usual design (red, orange, blue, purple,
 * then the globe's own), and by name within a color; a layer offered under
 * another follows it.
 */
const LAYERS: Layer[] = [
  { key: 'showCities', label: 'City pins', description: "A pin on each city you've visited", dot: (theme) => ({ background: theme.pin }) },
  {
    key: 'showVisited',
    label: 'Visited countries',
    description: "Color the countries you've visited",
    dot: (theme) => ({ background: theme.visited }),
  },
  {
    key: 'showVisitHeat',
    label: 'Heat map by visits',
    description: "Shade visited countries by how many times you've been",
    dot: (theme) => ({ background: `linear-gradient(90deg, ${land(theme)}, ${theme.visited})` }),
    under: 'showVisited',
  },
  {
    key: 'showRegions',
    label: 'Visited states',
    description: "Color the states you've visited, a shade darker",
    dot: (theme) => ({ background: visitedRegionColor(theme) }),
  },
  { key: 'showFlights', label: 'Flights', description: "A line for each flight you've taken", dot: (theme) => ({ background: theme.flight }) },
  {
    key: 'showScreensaverReplay',
    label: 'Replay in screensaver',
    description: 'The screensaver replays your trips every so often, oldest first, each place as it is reached',
    // Played, as the replay is
    dot: (theme) => ({ background: theme.flight, borderRadius: 0, clipPath: 'polygon(15% 0, 100% 50%, 15% 100%)' }),
    under: 'showFlights',
  },
  {
    key: 'showFutureFlights',
    label: 'Future flights',
    description: 'The flights booked for trips to come, dashed',
    // A ring, lighter than a flight taken, as dashes are
    dot: (theme) => ({ background: 'none', boxShadow: `inset 0 0 0 1.5px ${theme.flight}` }),
  },
  {
    key: 'showFutureVisits',
    label: 'Future visits',
    description: 'The places of trips to come, tinted and outlined in dashes',
    // Tinted, and outlined as they are
    dot: (theme) => ({ background: plannedColor(theme, land(theme)), boxShadow: `inset 0 0 0 1.5px ${theme.flight}` }),
  },
  { key: 'showWishlist', label: 'Wishlist', description: 'Color the countries you want to visit', dot: (theme) => ({ background: theme.wishlist }) },
  {
    key: 'showDayNight',
    label: 'Day and night',
    description: 'Night where the sun has set now',
    // Half day, half night, outlined to show on a dark panel
    dot: (theme) => ({
      background: `linear-gradient(90deg, ${land(theme)} 50%, ${NIGHT_COLOR} 50%)`,
      boxShadow: '0 0 0 1px var(--line-strong)',
    }),
  },
  {
    key: 'showCityLights',
    label: 'City lights',
    description: "The Earth's lights at night, as seen from space",
    dot: () => ({ background: LIGHT_COLOR }),
    under: 'showDayNight',
  },
  {
    key: 'showMarkers',
    label: 'Small islands',
    description: 'Rings around small islands and territories',
    // A ring, as they have, in the land's color, lit as it is over the sea
    dot: (theme) => ({ background: 'none', boxShadow: `inset 0 0 0 2px ${lit(land(theme))}` }),
  },
]

/** A switch with an eye for each layer on the globe, its dot in its color there */
export default function LayerList({
  settings,
  theme,
  onChange,
}: {
  settings: Settings
  theme: Theme
  onChange: (changes: Partial<Settings>) => void
}) {
  return (
    <ul className="row-list layers">
      {LAYERS.filter(({ under }) => !under || settings[under]).map(({ key, label, description, dot, under }) => (
        <li key={key} className={under ? 'sublayer' : undefined}>
          <button
            type="button"
            role="switch"
            aria-checked={settings[key]}
            className="row-button layer"
            title={description}
            onClick={() => onChange({ [key]: !settings[key] })}
          >
            <span className="dot" style={dot(theme)} aria-hidden="true" />
            <span>{label}</span>
            <span className="eye" aria-hidden="true">
              {settings[key] ? <EyeIcon /> : <EyeOffIcon />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
