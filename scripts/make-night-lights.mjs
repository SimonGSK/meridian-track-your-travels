// The city lights at night, in every design: NASA's Earth at night (by way
// of three-globe's examples) with only its lights kept, on black. In the
// picture they're dots a pixel or two wide on moonlit land and sea, so shrunk
// to fit the globe they'd blur into the blue around them and be lost; on
// black they blur into a glow instead.
//
//   npm run data:night-lights
import { readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const SOURCE = new URL('../node_modules/three-globe/example/img/earth-night.jpg', import.meta.url)
const OUTPUT = new URL('../src/assets/earth-lights.jpg', import.meta.url)

const browser = await chromium.launch()
const page = await browser.newPage()
const picture = (await readFile(SOURCE)).toString('base64')
const lights = await page.evaluate(async (jpeg) => {
  const image = new Image()
  image.src = `data:image/jpeg;base64,${jpeg}`
  await image.decode()
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  const { width, height } = image
  const pixels = context.getImageData(0, 0, width, height)
  const data = pixels.data
  // How bright each pixel is
  const brightness = new Float32Array(width * height)
  for (let i = 0; i < brightness.length; i++) {
    brightness[i] = (0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2]) / 255
  }
  // And around it: the average over a square RADIUS pixels each way, row by row then column by column
  const RADIUS = 6
  const blur = (from, to, step, count, length) => {
    for (let line = 0; line < count; line++) {
      const at = (i) => (step === 1 ? line * length + i : i * count + line)
      let sum = 0
      for (let i = -RADIUS; i <= RADIUS; i++) sum += from[at(Math.min(Math.max(i, 0), length - 1))]
      for (let i = 0; i < length; i++) {
        to[at(i)] = sum / (2 * RADIUS + 1)
        sum += from[at(Math.min(i + RADIUS + 1, length - 1))] - from[at(Math.max(i - RADIUS, 0))]
      }
    }
  }
  const rows = new Float32Array(brightness.length)
  const around = new Float32Array(brightness.length)
  blur(brightness, rows, 1, height, width)
  blur(rows, around, 0, width, height)
  for (let i = 0; i < brightness.length; i++) {
    // Lights are brighter than what's around them; moonlit snow, sand and sea are as bright as theirs. JPEG
    // smears the color of dots this small, so it's no help
    const light = Math.min(1, Math.max(0, brightness[i] - around[i] - 0.06) * 5) * 255
    data[i * 4] = light
    data[i * 4 + 1] = light * 0.78
    data[i * 4 + 2] = light * 0.48
  }
  context.putImageData(pixels, 0, 0)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}, picture)
await browser.close()
await writeFile(OUTPUT, Buffer.from(lights, 'base64'))
console.log(`Kept the lights of ${SOURCE.pathname.split('/').at(-1)} in src/assets/earth-lights.jpg`)
