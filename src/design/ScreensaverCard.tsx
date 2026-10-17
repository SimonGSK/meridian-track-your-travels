import { useState, type ReactNode } from 'react'
import { SETTINGS_KEY, type Settings } from '../explore/useSettings'
import { EyeIcon, EyeOffIcon } from '../icons'
import { SCREENSAVER_FILE, packPlaces, screensaverAddress } from '../screensaver'
import Card from '../ui/Card'

type Props = {
  /** Shows it in the app, to have a look */
  onPreview: () => void
  /** The settings, for the screensaver's own: whether it replays your timeline */
  settings: Settings
  onChange: (changes: Partial<Settings>) => void
  /** A way back, above the rest */
  back?: ReactNode
}

/** How to make the globe your Mac's screensaver, what it shows, and its address with your places in it */
export default function ScreensaverCard({ onPreview, settings, onChange, back }: Props) {
  const [copied, setCopied] = useState(false)
  // Read when shown, so it has the places added since, and the settings as they are, saved or not yet
  const places = packPlaces(localStorage, { [SETTINGS_KEY]: JSON.stringify(settings) })
  const address = screensaverAddress(places)
  // The replay needs the flights, which it flies
  const canReplay = settings.showFlights
  const replays = canReplay && settings.showScreensaverReplay

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
    } catch {
      setCopied(false) // no clipboard here: the address can be copied from the box
    }
  }

  return (
    <Card label="Screensaver" meta="MAC">
      {back}
      <p className="muted">Your Mac can show the spinning globe, with your places on it, as its screensaver.</p>
      <button
        type="button"
        role="switch"
        aria-checked={replays}
        aria-describedby="screensaver-replay-note"
        className="row-button layer screensaver-replay"
        disabled={!canReplay}
        onClick={() => onChange({ showScreensaverReplay: !settings.showScreensaverReplay })}
      >
        <span className="dot replay-dot" aria-hidden="true" />
        <span>Replay timeline</span>
        <span className="eye" aria-hidden="true">
          {replays ? <EyeIcon /> : <EyeOffIcon />}
        </span>
      </button>
      <p id="screensaver-replay-note" className="muted small screensaver-replay-note">
        {canReplay
          ? 'Every so often, your trips come back one by one, oldest first, as the globe spins on.'
          : 'Turn on Flights in the layers to replay your timeline.'}
      </p>
      <ol className="steps">
        <li>
          In the project, run <code>npm run build:screensaver</code>. It puts the globe in{' '}
          <code>{SCREENSAVER_FILE.replace(/\/[^/]+$/, '')}</code>, where screensavers may read it.
        </li>
        <li>
          Install WebViewScreenSaver, which shows a web page as a screensaver: <code>brew install --cask webviewscreensaver</code>
        </li>
        <li>
          Open System Settings › Wallpaper and click Screen Saver…. Scroll down to Other, all the way to the right,
          and pick WebViewScreenSaver.
        </li>
        <li>The first time, macOS blocks it: in System Settings › Privacy & Security, allow it on the message there.</li>
        <li>Back in Screen Saver, click Options and paste this address:</li>
      </ol>
      <input className="address" readOnly aria-label="Screensaver address" value={address} onFocus={(e) => e.target.select()} />
      <div className="card-actions">
        <button type="button" className="primary-button" onClick={copy}>
          {copied ? 'Copied' : 'Copy address'}
        </button>
        <button type="button" className="link-button" onClick={onPreview}>
          Preview
        </button>
      </div>
      <p className="muted small">
        It doesn't update by itself. The address carries your places, trips, design, layers and replay: after changing them,
        copy it again and paste it in Options. After updating the app, run the build again, or the screensaver won't
        know what's new.
      </p>
    </Card>
  )
}
