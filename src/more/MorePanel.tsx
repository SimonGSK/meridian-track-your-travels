import { useId, type ComponentProps, type ReactNode } from 'react'
import ScreensaverCard from '../design/ScreensaverCard'
import { ChevronIcon, DownloadIcon, MoneyIcon, MonitorIcon, PeopleIcon, PhoneIcon, TrophyIcon } from '../icons'
import { useInstall } from '../pwa/install'
import AppCard from '../settings/AppCard'
import BackupCard from '../settings/BackupCard'
import CurrencyCard from '../settings/CurrencyCard'
import Card from '../ui/Card'

export type MoreId = 'achievements' | 'compare' | 'currency' | 'backup' | 'app' | 'screensaver'

type Props = {
  /** What's opened, or null for the list of all of it */
  open: MoreId | null
  onOpen: (id: MoreId | null) => void
  /** Achievements earned, out of how many there are, and the list of them */
  earned: number
  achievementCount: number
  achievements: ReactNode
  /** The friend you compare with, by name, if any, and the comparison */
  friend: string | null
  compare: ReactNode
  /** Shows the screensaver in the app, to have a look */
  onPreview: () => void
  /** Your currency: chosen, or automatic from where you are, and the rates */
  currency: Omit<ComponentProps<typeof CurrencyCard>, 'back'>
}

/**
 * The More tab: your achievements, comparing with a friend, and the
 * settings, each a small card opening to all of it, with a way back
 */
export default function MorePanel(props: Props) {
  const { open, onOpen, earned, achievementCount, achievements, friend, compare, onPreview, currency } = props
  const { installed } = useInstall()

  const back = (
    <button type="button" className="text-button more-back" onClick={() => onOpen(null)}>
      ← Back
    </button>
  )
  if (open === 'achievements') {
    return (
      <Card label="Achievements" meta={`${earned} / ${achievementCount}`}>
        {back}
        {achievements}
      </Card>
    )
  }
  if (open === 'compare') {
    return (
      <Card label="Compare" meta={friend ? `with ${friend}` : 'a friend'}>
        {back}
        {compare}
      </Card>
    )
  }
  if (open === 'currency') return <CurrencyCard {...currency} back={back} />
  if (open === 'backup') return <BackupCard back={back} />
  if (open === 'app') return <AppCard back={back} />
  if (open === 'screensaver') return <ScreensaverCard onPreview={onPreview} back={back} />

  return (
    <>
      <ul className="more-list" aria-label="More">
        <Item icon={<TrophyIcon size={18} />} title="Achievements" onOpen={() => onOpen('achievements')}>
          {earned} of {achievementCount} earned
        </Item>
        <Item icon={<PeopleIcon size={18} />} title="Compare with a friend" onOpen={() => onOpen('compare')}>
          {friend ? `Where you and ${friend} have been` : "See where you've both been"}
        </Item>
      </ul>
      <h3 className="more-heading">Settings</h3>
      <ul className="more-list" aria-label="Settings">
        <Item icon={<MoneyIcon size={18} />} title="Currency" onOpen={() => onOpen('currency')}>
          {currency.chosen ?? `${currency.guess}, from your time zone`}
        </Item>
        <Item icon={<DownloadIcon size={18} />} title="Backup" onOpen={() => onOpen('backup')}>
          Keep your places safe in a file
        </Item>
        <Item icon={<PhoneIcon size={18} />} title="App" onOpen={() => onOpen('app')}>
          {installed ? 'Installed, and works offline' : 'Install Meridian, and use it offline'}
        </Item>
        <Item icon={<MonitorIcon size={18} />} title="Screensaver" onOpen={() => onOpen('screensaver')}>
          The globe as a Mac screensaver
        </Item>
      </ul>
    </>
  )
}

/** One small card: its name, a line on what's in it, and an arrow in */
function Item({ icon, title, onOpen, children }: {
  icon: ReactNode
  title: string
  onOpen: () => void
  children: ReactNode
}) {
  const name = useId()
  const about = useId()
  return (
    <li>
      <button type="button" className="more-option" aria-labelledby={name} aria-describedby={about} onClick={onOpen}>
        <span className="more-icon">{icon}</span>
        <span className="more-text">
          <strong id={name}>{title}</strong>
          <span id={about} className="muted">
            {children}
          </span>
        </span>
        <ChevronIcon size={16} />
      </button>
    </li>
  )
}
