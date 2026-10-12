import { useState, type ReactNode } from 'react'
import { SCREENSAVER_FILE, packPlaces, screensaverAddress } from '../screensaver'
import Card from '../ui/Card'

/** How to make the globe your Mac's screensaver, and its address with your places in it */
/** `onPreview` shows it in the app, to have a look. `back` is a way back, above the rest. */
export default function ScreensaverCard({ onPreview, back }: { onPreview: () => void; back?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  // Read when shown, so it has the places added since
  const places = packPlaces()
  const address = screensaverAddress(places)

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
        It doesn't update by itself. The address carries your places, trips, design and layers: after changing them,
        copy it again and paste it in Options. After updating the app, run the build again, or the screensaver won't
        know what's new.
      </p>
    </Card>
  )
}
