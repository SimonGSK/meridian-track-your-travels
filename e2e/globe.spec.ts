import { expect, test, type Locator, type Page } from '@playwright/test'

// These run against the real WebGL globe. The app starts looking at North
// Africa, so the middle of the screen is always over land on load.

async function openGlobe(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
  await page.goto('/')
  await expect(page.locator('.globe canvas')).toBeVisible()
  await expect(page.getByTestId('globe')).toHaveAttribute('aria-busy', 'false')
  return { errors }
}

const center = (page: Page) => {
  const { width, height } = page.viewportSize()!
  return { x: width / 2, y: height / 2 }
}
const tooltip = (page: Page) => page.getByRole('tooltip')

/**
 * Points at a spot on a still globe, so the same country stays under the
 * pointer: grabbing the globe (here, a click in the space beside it) stops
 * the idle spin, and the test waits out the last of the drift. The top bar
 * shows where the globe looks.
 */
async function pointAt(page: Page, x: number, y: number) {
  await page.mouse.click(24, page.viewportSize()!.height / 2)
  await page.mouse.move(x, y)
  const readings: string[] = []
  await expect
    .poll(
      async () => {
        const where = await page.locator('.view-center').textContent()
        const what = await tooltip(page).textContent()
        readings.push(`${where} ${what}`)
        return readings.length >= 3 && readings.slice(-3).every((r) => r === readings.at(-1))
      },
      { intervals: [400], timeout: 20_000 },
    )
    .toBe(true)
}
const panel = (page: Page) => page.locator('aside.panel')

test.describe('mouse', () => {
  test('loads the globe without errors', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await expect(page.getByRole('heading', { name: 'Meridian' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('hovering a country names it, clicking opens its panel', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)

    await pointAt(page, x, y)
    await expect(tooltip(page)).toBeVisible()
    const name = (await tooltip(page).textContent())!.trim()
    expect(name.length).toBeGreaterThan(0)

    await page.mouse.click(x, y)
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('heading', { level: 2 })).toHaveText(name)
  })

  test('hovering a country shows its flag in the corner', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)
    const flag = page.getByRole('img', { name: /^Flag of/ })

    await pointAt(page, x, y)
    await expect(tooltip(page)).toBeVisible()
    const name = (await tooltip(page).textContent())!.trim()
    await expect(flag).toHaveAccessibleName(`Flag of ${name}`)
    await expect(flag).toBeInViewport()
    // The SVG actually loaded
    await expect.poll(() => flag.evaluate((img) => (img as { naturalWidth: number }).naturalWidth)).toBeGreaterThan(0)

    const box = (await flag.boundingBox())!
    const viewport = page.viewportSize()!
    expect(box.x).toBeGreaterThan(viewport.width / 2)
    expect(box.y).toBeGreaterThan(viewport.height / 2)

    await page.mouse.move(8, 8) // outer space
    await expect(flag).toBeHidden()
  })

  test('the panel closes with the close button and with Escape', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)

    await page.mouse.move(x, y)
    await expect(tooltip(page)).toBeVisible()
    await page.mouse.click(x, y)
    await expect(panel(page)).toBeVisible()
    await panel(page).getByRole('button', { name: 'Close' }).click()
    await expect(panel(page)).toBeHidden()

    await page.mouse.move(x, y)
    await expect(tooltip(page)).toBeVisible()
    await page.mouse.click(x, y)
    await expect(panel(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
  })

  test('clicking empty space closes the panel', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)

    await page.mouse.move(x, y)
    await expect(tooltip(page)).toBeVisible()
    await page.mouse.click(x, y)
    await expect(panel(page)).toBeVisible()

    const viewport = page.viewportSize()!
    await page.mouse.click(viewport.width - 8, viewport.height - 8) // corner, outside the globe
    await expect(panel(page)).toBeHidden()
  })

  test('dragging spins the globe without selecting a country', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)

    await page.mouse.move(x, y)
    await expect(tooltip(page)).toBeVisible()
    const before = await tooltip(page).textContent()

    await page.mouse.down()
    await page.mouse.move(x + 300, y, { steps: 15 })
    await page.mouse.up()
    await expect(panel(page)).toBeHidden()

    // A different part of the world is now under the pointer
    await page.mouse.move(x, y)
    await expect(async () => {
      const hidden = await tooltip(page).isHidden()
      expect(hidden || (await tooltip(page).textContent()) !== before).toBe(true)
    }).toPass()
  })
})

test.describe('visited', () => {
  test('adding a visited country keeps it after reloading', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Add a country' }).fill('Denmark')
    await page.keyboard.press('Enter')
    // Its continent opens, to see it there
    const list = page.getByRole('list', { name: 'Visited in Europe' })
    await expect(list).toContainText('Denmark')

    await page.reload()
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('button', { name: 'Europe', exact: true }).click()
    await expect(list).toContainText('Denmark')
    await expect(page.getByLabel('Your atlas')).toContainText('1 / 197')
  })

  test('marking the clicked country as visited', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)
    await pointAt(page, x, y)
    await expect(tooltip(page)).toBeVisible()
    await page.mouse.click(x, y)
    const name = (await panel(page).getByRole('heading', { level: 2 }).textContent())!
    const continent = (await panel(page).locator('.panel-meta').textContent())!.split(' · ')[0]

    await panel(page).getByRole('button', { name: 'Add to visited atlas' }).click()
    await expect(panel(page).getByRole('button', { name: 'In visited atlas' })).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'Visited', exact: true }).first().click()
    await page.getByRole('button', { name: continent, exact: true }).click()
    await expect(page.getByRole('list', { name: `Visited in ${continent}` })).toContainText(name)
  })
})

test.describe('visited states', () => {
  test('ticking a state marks the country too, and both stay after reloading', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Add a country' }).fill('Australia')
    await page.getByRole('button', { name: /^Australia/ }).first().click()
    await page.getByRole('button', { name: /^Australia/ }).first().click() // show it
    await expect(panel(page).getByRole('heading', { name: 'Australia' })).toBeVisible()

    const statesLine = panel(page).getByRole('button', { name: /explored$/ })
    await statesLine.click()
    await panel(page).getByRole('checkbox', { name: 'Tasmania' }).check()
    await expect(statesLine).toHaveText('1 of 9 states and territories explored')
    await expect(panel(page).getByRole('button', { name: 'In visited atlas' })).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('button', { name: 'Oceania', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Australia/ })).toContainText('1 of 9 states and territories')
    await page.getByRole('button', { name: /^Australia/ }).click()
    await statesLine.click()
    await expect(panel(page).getByRole('checkbox', { name: 'Tasmania' })).toBeChecked()
  })
})

test.describe('visited cities', () => {
  test('adding a city pins it and marks the country, and both stay after reloading', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Add a country' }).fill('Japan')
    await page.getByRole('button', { name: /^Japan/ }).first().click()
    await page.getByRole('button', { name: /^Japan/ }).first().click() // show it
    await expect(panel(page).getByRole('heading', { name: 'Japan' })).toBeVisible()

    const addCity = panel(page).getByRole('searchbox', { name: 'Add a city' })
    await addCity.fill('Kyoto')
    await addCity.press('Enter')
    await addCity.fill('osa')
    await panel(page).getByRole('button', { name: 'Osaka' }).click()
    const visitedCities = panel(page).getByRole('list', { name: 'Visited cities' })
    await expect(visitedCities).toHaveText(/Kyoto.*Osaka|Osaka.*Kyoto/)
    await expect(panel(page).getByRole('button', { name: 'In visited atlas' })).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('button', { name: 'Asia', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Japan/ })).toContainText('2 cities')
    await page.getByRole('button', { name: /^Japan/ }).click()
    await expect(visitedCities).toContainText('Kyoto')
    // The pins' shader compiled and drew without complaints
    expect(errors).toEqual([])
  })
})

test.describe('trips', () => {
  /** Opens the Trips list, and a new trip in it */
  async function newTrip(page: Page, name: string) {
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('tab', { name: 'Trips' }).click()
    await page.getByRole('button', { name: 'New trip' }).click()
    await page.getByRole('textbox', { name: 'Name of the new trip' }).fill(name)
    await page.keyboard.press('Enter')
  }
  /** Adds a flight in the trip open, From and To found by what's typed */
  async function addFlight(page: Page, from: string | null, to: string) {
    for (const [label, query] of [['From', from], ['To', to]] as const) {
      if (!query) continue
      await page.getByRole('searchbox', { name: label, exact: true }).fill(query)
      await page.getByRole('list', { name: `${label} airports` }).getByRole('button').first().click()
    }
    await page.getByRole('button', { name: 'Add flight' }).click()
  }

  test('a flight added to a trip draws it, and it stays after reloading', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await newTrip(page, 'Bangkok')
    await page.getByRole('button', { name: 'Flight', exact: true }).click()
    await addFlight(page, 'copenhagen', 'bkk')
    const trip = page.getByRole('list', { name: 'What the trip Bangkok was' })
    await expect(trip).toContainText('Copenhagen → Bangkok')

    await page.reload()
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('tab', { name: 'Trips' }).click()
    await page.locator('.trip-header', { hasText: 'Bangkok' }).click()
    await expect(trip).toContainText('CPH → BKK')
    await trip.getByRole('button', { name: /^Copenhagen → Bangkok/ }).click()
    // The routes and their planes drew without complaints
    await page.waitForTimeout(1000)
    expect(errors).toEqual([])
  })

  test('the flight back starts where the last landed, and a place goes between, the trip shown on the globe', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await newTrip(page, 'Paris')
    await page.getByRole('button', { name: 'Flight', exact: true }).click()
    await addFlight(page, 'cph', 'cdg')
    // From starts in Paris, where the flight landed
    await addFlight(page, null, 'cph')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Place', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Place to add' }).fill('france')
    await page.getByRole('list', { name: 'Places found' }).getByRole('button', { name: /^France/ }).click()
    await page.getByRole('button', { name: 'Add place' }).click()

    const trip = page.getByRole('list', { name: 'What the trip Paris was' })
    await expect(trip.getByRole('listitem')).toHaveText([/^Copenhagen → Paris/, /^France/, /^Paris → Copenhagen/])
    await page.getByRole('button', { name: 'Show on globe' }).click()
    await page.waitForTimeout(1000)
    expect(errors).toEqual([])
  })
})

test.describe('screensaver', () => {
  test('shows just the globe, with the places the address brings', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()))
    const places = Buffer.from(
      JSON.stringify({
        'countries-app.visited': JSON.stringify(['Denmark', 'Japan']),
        'countries-app.flights': JSON.stringify([{ id: 'a', from: 'CPH', to: 'HND' }]),
      }),
    ).toString('base64url')
    await page.goto(`/?screensaver#places=${places}`)
    await expect(page.getByTestId('globe')).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByRole('heading')).toHaveCount(0)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('countries-app.visited')!))).toEqual(['Denmark', 'Japan'])
    await page.waitForTimeout(1000)
    expect(errors).toEqual([])
  })
})

test.describe('screensaver preview on a phone', { tag: '@touch' }, () => {
  test('shows its way out on a tap, and the button goes back to More', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'More', exact: true }).tap()
    await page.getByRole('button', { name: 'Screensaver' }).tap()
    await page.getByRole('button', { name: 'Preview' }).tap()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
    const exit = page.getByRole('button', { name: 'Exit preview' }) // no Esc on a phone
    await expect(exit).toHaveCSS('opacity', '0', { timeout: 10_000 })
    await page.touchscreen.tap(180, 400)
    await expect(exit).toHaveCSS('opacity', '1')
    // Tap it straight away, before it fades again: waiting for the page to hold still takes animation frames, which
    // the globe makes slow on test machines, long enough for the button to fade and the tap to miss it
    await page.touchscreen.tap(180, 400)
    await exit.tap({ force: true })
    await expect(page.getByRole('region', { name: 'Screensaver' })).toBeVisible()
  })
})

test.describe('screensaver preview', () => {
  test('opened from More, shows just the globe with a way out, and Escape goes back', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('button', { name: 'Screensaver', exact: true }).click()
    await page.getByRole('button', { name: 'Preview' }).click()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden()
    const exit = page.getByRole('button', { name: /^Exit preview/ })
    // Shown as it opens, then gone until the mouse moves
    await expect(exit).toHaveCSS('opacity', '1')
    await expect(exit).toHaveCSS('opacity', '0', { timeout: 10_000 })
    await page.mouse.move(200, 200)
    await page.mouse.move(260, 240)
    await expect(exit).toHaveCSS('opacity', '1')
    // The app's own Escape handler runs first; the preview's must still get the key, which only a real browser shows
    await page.keyboard.press('Escape')
    await expect(page.getByRole('region', { name: 'Screensaver' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
    expect(page.isClosed()).toBe(false)
    expect(errors).toEqual([])
  })
})

test.describe('explore', () => {
  test('layers switch off, and stay off after reloading', async ({ page }) => {
    await openGlobe(page)
    // Explore is open from the start on big screens, as a magnifying glass and a layers button
    const layersButton = page.getByRole('button', { name: 'Style and layers' })
    const visitedSwitch = page.getByRole('switch', { name: /Visited countries/ })
    const markerSwitch = page.getByRole('switch', { name: /Small islands/ })
    const pinSwitch = page.getByRole('switch', { name: /City pins/ })
    await layersButton.click()
    await expect(visitedSwitch).toBeChecked()
    await visitedSwitch.click()
    await markerSwitch.click()
    await pinSwitch.click()

    await page.reload()
    await layersButton.click()
    await expect(visitedSwitch).not.toBeChecked()
    await expect(markerSwitch).not.toBeChecked()
    await expect(pinSwitch).not.toBeChecked()
  })

  test('the magnifying glass opens a search of the atlas, which shows the country found', async ({ page }) => {
    await openGlobe(page)
    await expect(page.getByRole('region', { name: /Games/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Search the atlas' }).click()
    const search = page.getByRole('searchbox', { name: 'Search the atlas' })
    await expect(search).toBeFocused()
    await search.fill('kyoto')
    await page.getByRole('button', { name: /^Kyoto/ }).click()
    await expect(panel(page).getByRole('heading', { name: 'Japan' })).toBeVisible()
    await expect(search).toHaveCount(0)
  })
})

test.describe('achievements', () => {
  test('visiting all of Scandinavia earns it, with a note that opens the achievements', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    const add = page.getByRole('searchbox', { name: 'Add a country' })
    for (const name of ['Denmark', 'Norway']) {
      await add.fill(name)
      await add.press('Enter')
    }
    const note = page.getByRole('button', { name: /^Achievement unlocked/ })
    await expect(note).toContainText('First stamp')
    await add.fill('Sweden')
    await add.press('Enter')
    await expect(note).toContainText('Scandinavia')

    await note.click()
    await expect(page.getByRole('region', { name: 'Achievements' })).toBeVisible()
    const achievement = (title: string) => page.locator('li.achievement', { has: page.getByText(title, { exact: true }) })
    await expect(achievement('Scandinavia')).toHaveClass(/earned/)
    await expect(achievement('The Nordics')).toContainText('3 of 5')
  })
})

test.describe('undo', () => {
  test('a country removed by mistake comes back with Undo', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    const add = page.getByRole('searchbox', { name: 'Add a country' })
    for (const name of ['Japan', 'Peru']) {
      await add.fill(name)
      await add.press('Enter')
    }
    await page.getByRole('button', { name: 'Asia', exact: true }).click()
    const list = page.getByRole('list', { name: 'Visited in Asia' })
    await expect(list).toContainText('Japan')
    await page.getByRole('button', { name: 'Remove Japan' }).click()
    await expect(page.getByRole('button', { name: 'Remove Japan' })).toBeHidden()
    await expect(page.getByText('Removed Japan')).toBeVisible()
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(list).toContainText('Japan')
    await expect(page.getByText('Removed Japan')).toBeHidden()
  })
})

test.describe('comparing with a friend', () => {
  test("opening a friend's link shows how you compare, and keeps them", async ({ page }) => {
    const code = Buffer.from(JSON.stringify({ v: 1, name: 'Anna', places: ['Japan', 'Peru'] })).toString('base64url')
    await page.goto(`/#compare=${code}`)
    await expect(page.getByTestId('globe')).toHaveAttribute('aria-busy', 'false')
    await expect(page.getByRole('region', { name: 'Compare' })).toContainText('with Anna')
    await expect(page.getByRole('list', { name: 'Only Anna' })).toContainText('Japan')
    await expect(page.getByRole('figure', { name: 'Compare' })).toBeVisible()
    expect(page.url()).not.toContain('compare=') // the address is tidied
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('countries-app.friend')!))).toEqual({
      name: 'Anna',
      places: ['Japan', 'Peru'],
    })
  })
})

test.describe('wishlist', () => {
  test('a starred country goes on the wishlist, and "Been there" moves it to the visited atlas', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Add a country' }).fill('peru')
    await page.getByRole('button', { name: 'Add Peru to your wishlist' }).click()
    const wishlist = page.getByRole('list', { name: 'Wishlist' })
    await expect(wishlist).toContainText('Peru')
    await expect(page.getByText('0 visited')).toBeVisible()

    await wishlist.getByRole('button', { name: 'Been to Peru: add it to your visited atlas' }).click()
    await expect(wishlist).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Visited in South America' })).toContainText('Peru')
    await expect(page.getByText('1 visited')).toBeVisible()
  })
})

test.describe('year in review', () => {
  test('the time-lapse plays the years in order on the globe', async ({ page }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('countries-app.visited')) return
      localStorage.setItem('countries-app.visited', JSON.stringify(['France', 'Japan']))
      localStorage.setItem('countries-app.visit-dates', JSON.stringify({ France: ['2019-07'], Japan: ['2024-04'] }))
    })
    const { errors } = await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('tab', { name: 'Years' }).click()
    await page.getByRole('button', { name: '▶ Replay your travels, 2019–2024' }).click()
    await expect(page.getByRole('heading', { name: '2019', exact: true })).toBeVisible()
    await expect(page.getByRole('list', { name: 'New in 2019' })).toContainText('France')
    await expect(page.getByRole('heading', { name: '2024', exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('list', { name: 'New in 2024' })).toContainText('Japan')
    await page.getByRole('button', { name: 'Back to the years' }).click()
    await expect(page.getByRole('list', { name: 'Month by month' })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('a dated visit gets its year, with the country under its month', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    const add = page.getByRole('searchbox', { name: 'Add a country' })
    await add.fill('Japan')
    await add.press('Enter')
    await page.getByRole('tab', { name: 'Years' }).click()
    await expect(page.getByText(/^No dates yet/)).toBeVisible()

    await page.getByRole('tab', { name: 'Countries' }).click()
    await page.getByRole('button', { name: 'Asia', exact: true }).click()
    await page.getByRole('button', { name: /^Japan/ }).click()
    const visits = panel(page).getByRole('region', { name: 'Visits' })
    await visits.getByRole('combobox', { name: 'Year' }).selectOption('2023')
    await visits.getByRole('combobox', { name: 'Month' }).selectOption('April')
    await visits.getByRole('button', { name: 'Add visit' }).click()
    await panel(page).getByRole('button', { name: 'Close' }).click()

    await page.getByRole('tab', { name: 'Years' }).click()
    await expect(page.getByRole('heading', { name: '2023' })).toBeVisible()
    await expect(page.getByText('1 country on 1 continent, 1 new place.')).toBeVisible()
    const april = page.getByRole('list', { name: 'April' })
    await expect(april).toContainText('Japan')
    await expect(april).toContainText('First visit')
  })
})

test.describe('settings', () => {
  test('a backup downloaded and restored brings the places back', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    for (const name of ['Denmark', 'Japan']) {
      await page.getByRole('searchbox', { name: 'Add a country' }).fill(name)
      await page.keyboard.press('Enter')
    }
    await expect(page.getByText('2 visited')).toBeVisible()

    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('button', { name: 'Backup', exact: true }).click()
    await expect(page.getByText('In this browser: 2 places.')).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download backup' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^meridian-backup-\d{4}-\d{2}-\d{2}\.json$/)
    const file = await download.path()

    // As in a new browser
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByText('0 visited')).toBeVisible()

    await page.getByRole('button', { name: 'More', exact: true }).click()
    await page.getByRole('button', { name: 'Backup', exact: true }).click()
    await page.getByLabel('Backup file').setInputFiles(file)
    await expect(page.getByRole('alertdialog')).toContainText('2 places')
    await page.getByRole('button', { name: 'Replace with this backup' }).click()
    // The page starts over with the backup
    await expect(page.getByText('2 visited')).toBeVisible()
    await page.getByRole('button', { name: 'Visited', exact: true }).click()
    await page.getByRole('button', { name: 'Asia', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Visited in Asia' })).toContainText('Japan')
  })
})

test.describe('design', () => {
  test('switching design repaints the globe and is remembered', async ({ page }) => {
    test.slow() // compares screenshots of the software-rendered globe
    await openGlobe(page)
    const { x, y } = center(page)
    const globeArea = { x: x - 150, y: y - 150, width: 300, height: 300 }
    // Hold the pointer still over the globe so the spin pauses between shots
    await page.mouse.move(x, y)
    await expect(tooltip(page)).toBeVisible()

    const before = await page.screenshot({ clip: globeArea })
    await page.getByRole('button', { name: 'Style and layers' }).click()
    await page.getByRole('button', { name: /Night/ }).click()
    await expect(page.getByRole('button', { name: /Night/ })).toHaveAttribute('aria-pressed', 'true')
    await page.mouse.move(x, y)
    await expect.poll(async () => (await page.screenshot({ clip: globeArea })).equals(before)).toBe(false)

    await page.reload()
    await page.getByRole('button', { name: 'Style and layers' }).click()
    await expect(page.getByRole('button', { name: /Night/ })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('games', () => {
  const feedback = (page: Page) => page.getByRole('status')

  test('find the country: clicking the globe answers the round', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Find the country/ }).click()
    await page.getByRole('button', { name: /^Easy/ }).click()
    await expect(page.getByText('Round 1 of 10')).toBeVisible()

    // The middle of the globe, which sits beside the side panel
    const box = (await page.locator('.globe canvas').boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await expect(tooltip(page)).toBeHidden() // no giveaways
    await page.mouse.click(x, y)
    // Right away, or a miss with two tries left
    await expect(feedback(page)).toHaveText(/Correct! \+3 points|Try again: 2 tries left/)
    await expect(panel(page)).toBeHidden()
  })

  test('find the city: a click anywhere on the globe is scored by how far off it is', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Find the city/ }).click()
    await page.getByRole('button', { name: /^Medium/ }).click()
    await expect(page.getByText('Round 1 of 10')).toBeVisible()

    const box = (await page.locator('.globe canvas').boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(feedback(page)).toHaveText(/^(Off by [\d,]+ km|Spot on! \d+ km away)\. \+\d+ points?$/)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Round 2 of 10')).toBeVisible()
    // The pin, the line and the plane drew without complaints
    expect(errors).toEqual([])
  })

  test('neighbours: naming countries that border the one lit up', async ({ page }) => {
    const { errors } = await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Neighbours/ }).click()
    await page.getByRole('button', { name: /^Medium/ }).click()
    await expect(page.getByText('Country 1 of 5')).toBeVisible()

    // Not a neighbour of any country, being an island far out: always a mistake
    const answer = page.getByRole('textbox', { name: 'A neighbour' })
    await answer.fill('New Zealand')
    await answer.press('Enter')
    await expect(feedback(page)).toHaveText(/^New Zealand doesn't border .+\.$/)
    await expect(page.getByText('1 mistake')).toBeVisible()
    await page.getByRole('button', { name: 'Show the rest' }).click()
    await expect(page.getByRole('list', { name: 'Missed' })).toBeVisible()
    await page.getByRole('button', { name: 'Next country' }).click()
    await expect(page.getByText('Country 2 of 5')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('flag quiz: picking a country gives feedback', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Flag quiz/ }).click()
    await page.getByRole('button', { name: /^Easy/ }).click()
    const flag = page.getByRole('img', { name: 'The flag to identify' })
    await expect.poll(() => flag.evaluate((img) => (img as { naturalWidth: number }).naturalWidth)).toBeGreaterThan(0)

    await page.locator('.option').first().click()
    await expect(feedback(page)).toHaveText(/Correct!|The answer is/)
    await expect(page.locator('.option.correct')).toHaveCount(1)
  })

  test('letter hunt: clicking the globe checks the letter', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Letter hunt/ }).click()
    await page.getByRole('button', { name: /^K:/ }).click()
    await expect(page.getByText('Found 0 of 6')).toBeVisible()

    const box = (await page.locator('.globe canvas').boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(feedback(page)).toHaveText(/✓|doesn't start with|territory/)

    await page.getByRole('button', { name: 'Give up and show the rest' }).click()
    await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
    await page.getByRole('button', { name: 'Another letter' }).click()
    await expect(page.getByRole('button', { name: /^K:/ })).toContainText(/K\d\/6/)
  })

  test('shape quiz on medium: type an answer', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Shape quiz/ }).click()
    await page.getByRole('button', { name: /^Medium/ }).click()
    await expect(page.getByRole('img', { name: 'The outline to identify' })).toBeVisible()

    const input = page.getByRole('textbox', { name: 'Your answer' })
    await expect(input).toBeFocused()
    await input.fill('Swaziland')
    await expect(page.getByRole('option')).toHaveCount(0) // no suggestions
    await input.press('Enter')
    await expect(feedback(page)).toHaveText(/Correct|The answer is/)
    await expect(page.getByRole('button', { name: 'Next' })).toBeFocused()
  })

  test('capital quiz: pick a capital on easy, type one on medium', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Capital quiz/ }).click()
    await page.getByRole('button', { name: /^Easy/ }).click()
    await expect(page.getByText("What's the capital of")).toBeVisible()
    await page.locator('.options .option').first().click()
    await expect(feedback(page)).toHaveText(/The capital of .+ is .+\./)
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Round 2 of 10')).toBeVisible()

    await page.getByRole('button', { name: 'Quit game' }).click()
    await page.getByRole('button', { name: '← All games' }).click()
    await page.getByRole('button', { name: /Capital quiz/ }).click()
    await page.getByRole('button', { name: /^Medium/ }).click()
    const input = page.getByRole('textbox', { name: 'Your answer' })
    await expect(input).toBeFocused()
    await input.fill('kiev')
    await input.press('Enter')
    await expect(feedback(page)).toHaveText(/Correct|is the capital of Ukraine/)
  })

  test('whose capital: pick the country from its capital', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Whose capital/ }).click()
    await page.getByRole('button', { name: /^Easy/ }).click()
    await expect(page.getByText('Which country has this capital?')).toBeVisible()
    await page.locator('.options .option').first().click()
    await expect(feedback(page)).toHaveText(/is the capital of/)
  })

  test("daily challenge: today's five rounds, once, with the result to share", async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /^Daily challenge/ }).click()
    await page.getByRole('button', { name: "Play today's challenge" }).click()
    await expect(page.getByText('Find this country on the globe')).toBeVisible()
    for (let round = 0; round < 5; round++) {
      await page.getByRole('button', { name: "I don't know" }).click()
      await page.getByRole('button', { name: round === 4 ? 'See results' : 'Next' }).click()
    }
    await expect(page.getByText('0 / 7')).toBeVisible()
    await expect(page.getByLabel('Rounds: 🟥🟥🟥🟥🟥')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy result' })).toBeVisible()

    // One go a day, kept after reloading
    await page.reload()
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Daily challenge/ })).toContainText('Today: 0 / 7')
    await page.getByRole('button', { name: /^Daily challenge/ }).click()
    await expect(page.getByRole('button', { name: "Play today's challenge" })).toHaveCount(0)
    await expect(page.getByText(/Next challenge in \d+h \d+m/)).toBeVisible()
  })

  test('higher or lower: guess until the run ends', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Higher or lower/ }).click()
    await page.getByRole('button', { name: /^Population/ }).click()
    const over = page.getByText('in a row')
    // Always "more": right about half the time, so the run soon ends. The game's button, not the More tab's
    for (let i = 0; i < 40 && !(await over.isVisible()); i++) {
      await page.locator('#side-panel').getByRole('button', { name: 'More', exact: true }).click()
      const next = page.getByRole('button', { name: 'Next', exact: true })
      if (await next.isVisible()) await next.click()
    }
    await expect(over).toBeVisible()
    await page.getByRole('button', { name: 'All games' }).click()
    await page.getByRole('button', { name: /Higher or lower/ }).click()
    await expect(page.getByRole('button', { name: /^Population/ })).toContainText('in a row')
  })

  test('name them all: type countries until giving up', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Name them all/ }).click()
    await page.getByRole('button', { name: /^Oceania/ }).click()
    const input = page.getByRole('textbox', { name: 'Name a country' })
    await expect(input).toBeFocused()
    for (const name of ['Australia', 'New Zealand', 'fiji']) {
      await input.fill(name)
      await input.press('Enter')
    }
    await expect(page.getByText('3 / 14')).toBeVisible()
    await page.getByRole('button', { name: 'Give up and show the rest' }).click()
    // Giving up is no perfect run, so its time sets no record
    await expect(page.getByText(/^Time \d+:\d\d\.\d\. Only perfect runs/)).toBeVisible()
    await expect(page.getByText(/^Kiribati, /)).toBeVisible()
  })

  test('all countries: 197 rounds, which can be stopped early', async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Flag quiz/ }).click()
    await page.getByRole('button', { name: /^All countries/ }).click()
    await expect(page.getByText('Round 1 of 197')).toBeVisible()
    const input = page.getByRole('textbox', { name: 'Your answer' })
    await input.fill('Denmark')
    await input.press('Enter')
    await expect(feedback(page)).toHaveText(/Correct|The answer is/)
    await page.getByRole('button', { name: 'Stop and see results' }).click()
    await expect(page.getByText('Stopped after 1 of 197 countries')).toBeVisible()
  })

  test('name that country: can be played to the end', async ({ page }) => {
    test.slow() // ten rounds, each with a camera flight
    await openGlobe(page)
    await page.getByRole('button', { name: 'Games', exact: true }).click()
    await page.getByRole('button', { name: /Name that country/ }).click()
    await page.getByRole('button', { name: /^Easy/ }).click()
    for (let round = 1; round <= 10; round++) {
      await expect(page.getByText(`Round ${round} of 10`)).toBeVisible()
      await page.locator('.option').first().click()
      await page.getByRole('button', { name: round < 10 ? 'Next' : 'See results' }).click()
    }
    await expect(page.getByText(/^\d+ \/ 10$/)).toBeVisible()
    await page.getByRole('button', { name: 'All games' }).click()
    await page.getByRole('button', { name: /Name that country/ }).click()
    await expect(page.getByRole('button', { name: /^Easy/ })).toContainText('Best:')
  })
})

test.describe('touch', { tag: '@touch' }, () => {
  test('the menu is a tab bar and panels open as bottom sheets', async ({ page }) => {
    await openGlobe(page)
    const viewport = page.viewportSize()!
    const nav = (await page.getByRole('navigation', { name: 'Main' }).boundingBox())!
    expect(nav.y + nav.height).toBeCloseTo(viewport.height, 0)
    expect(nav.width).toBeCloseTo(viewport.width, 0)
    // Each tab: its symbol over its name, in the middle of the tab
    for (const tab of await page.getByRole('navigation', { name: 'Main' }).getByRole('button').all()) {
      const box = (await tab.boundingBox())!
      const icon = (await tab.locator('svg').boundingBox())!
      const label = (await tab.locator('span').boundingBox())!
      expect(icon).not.toBeNull()
      expect(icon.y + icon.height).toBeLessThanOrEqual(label.y + 1)
      expect(Math.abs((icon.y + label.y + label.height) / 2 - (box.y + box.height / 2))).toBeLessThan(3)
    }

    await page.getByRole('button', { name: 'Visited' }).tap()
    const sheet = page.getByRole('region', { name: 'Visited', exact: true })
    // Let it finish sliding in before measuring
    await sheet.evaluate((el) =>
      Promise.all((el as unknown as { getAnimations(): { finished: Promise<unknown> }[] }).getAnimations().map((a) => a.finished)),
    )
    const box = (await sheet.boundingBox())!
    expect(box.width).toBeCloseTo(viewport.width, 0)
    expect(box.y + box.height).toBeCloseTo(nav.y, 0)
  })

  test("the sheet's close button stays above what scrolls, never over it", async ({ page }) => {
    await openGlobe(page)
    await page.getByRole('button', { name: 'Visited' }).tap()
    const add = page.getByRole('searchbox', { name: 'Add a country' })
    for (const name of ['Denmark', 'Norway', 'Sweden', 'Finland', 'Iceland', 'Japan', 'Peru', 'Kenya']) {
      await add.fill(name)
      await add.press('Enter')
    }
    const close = page.getByRole('button', { name: 'Close panel' })
    const cards = page.locator('.side-panel-body')
    await cards.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    const button = (await close.boundingBox())!
    const scrolling = (await cards.boundingBox())!
    expect(button.y + button.height).toBeLessThanOrEqual(scrolling.y)
    // And it still closes the sheet
    await close.tap()
    await expect(page.getByRole('region', { name: 'Visited', exact: true })).toHaveCount(0)
  })

  test('tapping a country opens its panel', async ({ page }) => {
    await openGlobe(page)
    const { x, y } = center(page)
    await page.touchscreen.tap(x, y)
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('heading', { level: 2 })).not.toBeEmpty()
    await expect(tooltip(page)).toBeHidden()
  })

  test("a sheet swiped down closes, a tab's or a country's", async ({ page }) => {
    await openGlobe(page)
    /** A finger down from an element's top, `by` pixels, quickly */
    const swipeDown = (sheet: Locator, by = 250) =>
      sheet.evaluate(async (el, by) => {
        // The page's own, which the tests' types (for Node) don't know
        const { Touch, TouchEvent } = globalThis as unknown as {
          Touch: new (init: { identifier: number; target: EventTarget; clientX: number; clientY: number }) => object
          TouchEvent: new (type: string, init: { bubbles: boolean; cancelable: boolean; touches: object[]; changedTouches: object[] }) => Event
        }
        const { left, top, width } = el.getBoundingClientRect()
        const x = left + width / 2
        const at = (y: number) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })]
        const fire = (type: string, y: number) =>
          el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : at(y), changedTouches: at(y) }))
        fire('touchstart', top + 10)
        for (let step = 1; step <= 5; step++) {
          fire('touchmove', top + 10 + (by * step) / 5)
          await new Promise((done) => setTimeout(done, 16))
        }
        fire('touchend', top + 10 + by)
      }, by)

    await page.getByRole('button', { name: 'Visited' }).tap()
    const sheet = page.getByRole('region', { name: 'Visited', exact: true })
    await expect(sheet).toBeVisible()
    await swipeDown(sheet)
    await expect(sheet).toBeHidden()
    // The globe slides back down from where the sheet pushed it: tap once it's there
    await page
      .getByTestId('globe')
      .evaluate((el) =>
        Promise.all((el as unknown as { getAnimations(): { finished: Promise<unknown> }[] }).getAnimations().map((a) => a.finished)),
      )

    const { x, y } = center(page)
    await page.touchscreen.tap(x, y)
    await expect(panel(page)).toBeVisible()
    await swipeDown(panel(page))
    await expect(panel(page)).toBeHidden()
  })
})
