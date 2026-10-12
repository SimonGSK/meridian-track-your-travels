// Copies the screensaver build to /Users/Shared/Meridian, where the Mac's
// screensaver may read it (it can't read Documents, Desktop or Downloads).
// Part of `npm run build:screensaver`.
import { copyFile, mkdir } from 'node:fs/promises'
import { platform } from 'node:os'

const SOURCE = new URL('../screensaver/index.html', import.meta.url)
const FOLDER = '/Users/Shared/Meridian'

if (platform() !== 'darwin') {
  console.log(`Built ${SOURCE.pathname}; copy it wherever your screensaver can read it.`)
} else {
  await mkdir(FOLDER, { recursive: true })
  await copyFile(SOURCE, `${FOLDER}/index.html`)
  console.log(`Copied the screensaver to ${FOLDER}/index.html. Paste the address from More › Screensaver into WebViewScreenSaver.`)
}
