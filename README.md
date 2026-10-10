# Meridian

An interactive 3D globe for keeping track of where you've been. Mark the countries, states and cities you've visited and when, put your visits and flights together into trips, look back on each year or replay them all as a time-lapse, keep a wishlist, compare your travels with a friend's, and test your geography with twelve games.

**Try it at https://simongsk.github.io/meridian-track-your-travels/**. It runs in any browser, on a phone too, can be installed as an app, and works offline. Everything you add stays in your browser.

- **Your travels**: countries out of the world's 197, states and provinces (USA, Canada, Australia, Brazil), cities with pins, each visit by month with a note, a heat map by visits, a wishlist, and 58 achievements to earn.
- **Trips**: your visits and the flights between them, in the order you went, named, rearranged by dragging; flights between 3,244 airports, drawn as arcs with little planes.
- **Years**: a review of each year, the globe showing just that year, and a time-lapse of them all.
- **With a friend**: your places and a friend's on one globe, from a link, with nothing going through a server.
- **Games**: a daily challenge, finding countries and cities on the globe, naming neighbours, flags, shapes, capitals, higher or lower, and more, with best scores and time records.
- **The globe**: seven designs, one of them the Earth as seen from space, day and night from where the sun really is, city lights, and your Mac's screensaver.

## What's in it

Spin the globe, hover a country to see its name and flag, and click it to fly there and see its capital, inhabitants and area.

The design (navy and amber, after a mock-up made in Lovable) has a top bar with the four tabs, where the globe is looking and how many places you've visited. The selected country shows on the left: its ISO code, capital, inhabitants and area, the cities you've visited there, its states, and a button to put it in your visited atlas. The open tab's cards are on the right. On phones the tabs move to the bottom and panels open as sheets (Explore's two buttons stay in the top corner), with the tab's name and a close button above the cards, which scroll under them. A sheet, a tab's or a country's, can also be swiped down to close it: from its top (the little bar), or from anywhere in it once it's scrolled to the top. It follows the finger, and closes once let go a quarter of the way down or flicked; otherwise it springs back.

- **Explore**: two round buttons in the corner, on phones too, so the globe has the room. The magnifying glass opens a search of the whole atlas, countries by any name and cities. The layers button opens the designs and the layers.

  **Designs**: switch the globe between Midnight (the default), Classic, Vintage, Political (neighbors always in different colors), Night, Minimal and Realistic. Realistic shows the Earth as seen from space, with its oceans, forests, deserts, ice and snow, the sea shining in the light, and mountains in relief (zoom in on the Himalayas or the Andes). With Day and night on, its night side is dark as from space, with the cities' real lights glowing on it instead of drawn dots (City lights still switches them off). Only your places (and whatever else is colored, like the wishlist or a game's answers) are painted over it, see-through, so the land still shows under them. Each design is a tiny globe in its colors, all in a row, with the one chosen named under them. Under them are the **layers** to show or hide: visited countries and their heat map by visits, the wishlist, visited states, city pins, flights, rings around small islands, and day and night.

  **Day and night** (off until switched on) darkens the side of the globe where the sun has set, as it is right now, fading through twilight down to 18° below the horizon, and lights the cities there, bigger for more people. **City lights** shows under it while it's on, to have night without the lights. It moves on every minute, and is hidden during games. Where the sun is overhead comes from the Astronomical Almanac's low-precision formulas (`src/globe/sun.ts`), good to about 0.01°.
- **Visited**: three symbols switch between your countries (a flag), trips (a plane) and years (a calendar); pointing at one shows its name. Each has a small box of figures. Keep track of where you've been, out of the world's 197 countries, with the count and percentage for each continent. Territories are counted separately, and also count for the country they belong to: marking just Greenland counts Denmark as a country been to, listed under Europe as "In Greenland" (with nothing to remove, as it isn't marked itself). The globe colors only what you've marked. Click a continent's bar to see your places there, under it (with their visits, states and cities), and again to put them away; adding a place opens its continent. Search to add places (old names like "Swaziland" work too), or click a country and press "Add to visited atlas". They're colored on the globe.

  For the USA, Canada, Australia and Brazil you can also mark the states, provinces and territories you've visited: click "… states explored" in the country's panel and tick them, or click them on the globe. They're drawn over the country in a darker shade.

  Countries you want to visit go on your wishlist: press "Add to wishlist" in a country's panel, or the ☆ next to a search result. They're colored on the globe in their own color (lilac in Midnight), and listed under Wishlist in the Visited tab with their continent. "Been there" moves one to your visited atlas, and visiting a place any other way takes it off the wishlist too.

  **Upcoming trips.** "Plan a visit" in a country's panel takes the day you're going (from tomorrow). Until then the place is tinted with the flight color (light blue in Midnight) and outlined in dashes on the globe, and counted down to in its panel ("Going 18 Nov 2026 · in 40 days") and under Upcoming in the Visited tab, soonest first. On the day, the place goes into your visited atlas with a visit that month, off the wishlist, with a note to take it back if you didn't go after all. Flights can be dated in a month still to come too: they're drawn dashed, with no plane yet, listed under Upcoming in Flights ("next month", "in 3 months"), and don't count in the figures, the years or the achievements until their month comes.

  A visited country's panel has its visits: add each one as a month and year, or just the year if you don't remember the month. The Visited list shows the latest ("3 visits, last May 2023"). The pencil next to a visit adds a note, like "honeymoon" or "rained all week" (up to 200 characters), shown under its date and next to the place in that year's review. Removing a visit removes its note.

  The heat map, a switch under "Visited countries" in the layers, shades your places by how many times you've been instead of one color. The shades go from near the land color for one visit to the full visited color for four or more, with a key at the bottom, beside "drag to spin" (or above it where there isn't room). A place marked visited without dates counts once. It gives way to a year shown in the Years view.

  Every country's panel also has its visited cities, and a box to add more from its big and well-known cities (focus it to see the biggest). Each city you've visited gets a pin on the globe; point at a pin to see the city's name, or click it to open its country. Adding a city also marks its country, and its state, as visited. The state comes with the city (from GeoNames), so a city on a coast or a border gets its own even where the map's simplified outline leaves it just outside (New York City's point is in the harbour).

  Under Trips, your visits and flights come together as you went. Each trip is a card: when, and small flags of the countries it went to, in order (for a trip of only flights, the countries they land in, home left out), after its name if you've given it one. Open one to see its places and flights in order, each with its date. Drag one by its grip (⋮⋮) to move it, with a mouse or a finger, or move it with the arrow keys on its grip. "+ Place" adds a place you went, and when (a place you've been to more than once needs the date, to tell the visits apart); one not in your atlas yet goes in. "+ Flight" adds a flight, from where the trip's last flight landed, and ⇅ swaps From and To for the flight back. Something new goes where it fits: a flight after the place it leaves from, or else before the one it lands in; a place after the flight that lands there, or else before the one that leaves from it. Drag it elsewhere if it's not right. Change a place's or a flight's date from its date, take a place out of a trip with × (it stays visited), or remove a flight with ×. The pencil names the trip ("Interrail 2019") and gives it a note, shown at the bottom of the globe when the trip, or one of its flights, is picked. "Show on globe" shows all of it, every flight highlighted, and ▶ follows it: the globe turns to its first flight and the trip's plane flies it, then straight on to the next as the globe turns with it, briskly (four flights take about 20 seconds), with a bar at the bottom saying which flight of how many ("Nairobi → Cape Town · 2 of 4"). At the end the globe shows the whole trip, and on a phone the Trips list comes back, as it does with Stop. Escape, taking hold of the globe or going to another panel stops it too. "Remove trip" takes the trip apart; what was in it stays, in no trip.

  Trips are newest first, by when they started; those still to come are counted down to ("next month"). Under them, "Not in a trip yet" lists every visit in no trip, newest first (a place you've been to without a date once, last), and any flights in none: date them there, or put them in a trip with "+ Trip", or in a new one. Each visit and flight is in one trip at most. A visit is a place and a month or year, so a country you've been to three times is three visits, which can be in three trips. Dates changed in a trip are the visits' own: the years, the heat map and the country's panel see them too, and a date added in the country's panel to a place in a trip without one stays in that trip.

  Flights are between airports: every international airport, and the regional ones with airline service (3,244 in all). Search by city, airport name or code ("Copenhagen", "Heathrow", "CPH"); each result shows the airport's name and country. A flight can have a month and year ("When"), kept for the next one. Each route is drawn on the globe as a thin arc, rising with the distance; a route flown both ways or more than once is drawn once. A little plane flies each trip, slowly (Copenhagen to Bangkok takes about half a minute) and turned the way it's going: its flights in the trip's order, then over again. It's there only while flying: it goes once it lands, and appears again as it sets off on the next flight. One plane a trip keeps the globe calm however many flights there are. The figures are how many trips, how many flights and how far as the plane flies (pointing at it says how many times around the Earth). Click a flight to see its route from above, highlighted, until you press Escape or click the globe. Adding a flight doesn't mark where it lands as visited: changing planes isn't visiting. (The first flights were saved between cities; they move to the city's main airport by themselves.)

  Trips used to be worked out from the flights, not made by hand. The first time the app opens with trips, it makes them from the flights there are, as they were worked out (legs that each leave from where the last one landed, within 100 km, and within a month of each other, or overland up to 1,000 km, ending back where they started), with the names they had, and as their places the countries landed in where you've a visit then (or one without a date). Flights in no trip are flown by planes grouped that same way.

  Under Years, a review of each year you've dated a visit or a flight, from the newest, with ‹ › for the others. It has:

  - a summary ("6 countries on 4 continents, 5 new places." and "5 flights, 25.6K km."). A territory counts as the country it belongs to, so a year with Iceland and Greenland is 2 countries, Iceland and Denmark. Only places that are no country's (Antarctica, Western Sahara, the Siachen Glacier) are counted apart, as territories. The new places are those first visited that year, territories too, and they're the ones in green: Greenland is new the first time you're there, even if you'd been to Denmark. The time-lapse and the wrapped card count the same way;
  - the countries, first visits (places whose earliest visit is that year) and continents;
  - the flights, how far, and the longest;
  - "Your most travelled year" on the year with the most places.

  The places follow month by month, and those dated only by the year come last; click one to open it, or the longest flight to see its route. While Years is open, the globe shows just that year: its places, those first visited that year in green and those you went back to in a darker green (with a key at the bottom), and its flights, even with those layers off. Picking a year turns the globe to face them, zoomed out enough to see them all (or as far as it goes, for a year all around the world), and the globe stops spinning on its own until you leave. States, city pins and the wishlist are hidden, as they have no dates. Places and flights without a date aren't in any year.

  "✨ Your 2025, wrapped" makes the year a card to keep or share, in the style of a phone's story (1080 × 1920): the year in big type, a small globe turned to its places (those new that year green, as many as the "new" figure, and those visited before in the visited color), how many countries, how many new and on how many continents, the flags of its places (the new ones ringed, up to 18), and its flights (how many, how far, how many times around the Earth, the longest) or else its busiest month. It's drawn on a canvas in the app's own colors. **Save image** downloads it as a PNG, and on a phone **Share** sends it straight to another app; Escape or ✕ puts it away.

  "▶ Replay your travels" plays the years as a time-lapse, from the first with a date to the last, about two seconds each. Each year the globe shows everywhere you'd been by its end, in the visited color, with that year's places standing out: those first visited that year in green, and those you went back to in a darker green, with a key at the bottom. That year's flights stand out among those before. It turns to each year's places, and the panel shows the year, the countries, continents and flights so far, what was new, and where you went back to. Pause, play on, replay, or go back to the years; leaving the Years view ends it.
- **Games**: the daily challenge first, then the others by what they ask about: countries, flags, capitals, cities and facts.
  - *Daily challenge*: five countries, one of each quiz: find it on the globe, then its flag, its capital, its shape, and a country lit up on the globe (picked from four answers after the first). They're picked from the date, so everyone gets the same ones that day, and there's one go a day. The score is out of 7 (3, 2 or 1 for finding it, by try), shown as squares to share like Wordle's (🟩 right, 🟨/🟧 on a later try, 🟥 wrong), with "Copy result". It keeps your streak of days in a row, the longest, and how many you've played, and counts down to the next one.
  - *Find the country*: click the named country on the globe, with three tries (3, 2 or 1 points). Hard leaves out the 49 biggest countries.
  - *Find the city*: a city is named with its country and flag, and you click where it is on the globe, land or sea, zooming in to be precise. Within 20 km is spot on, for 100 points; fewer the farther off (90 at 100 km, 55 at 500, 29 at 1,000). A pin marks the city, and a plane flies from your click to it, both in view. Easy is the capitals of big countries, Medium every country's capital, Hard the cities of a million people or more that aren't capitals. Ten cities, out of 1,000 points, with the points for each city on the results.
  - *Letter hunt*: click every country starting with a letter. Each letter belongs to one difficulty (easy D F H J K R U V Z, medium A E G I L N P T, hard B C M S); pick any letter, or a random one, and see your best for each. Every small island country and tiny country gets a ring, so the ones out in the ocean can be found (all of them, so the rings give nothing away); a ring turns green once found.
  - *Name them all*: type every country you can from memory, for the whole world or one continent, against the clock.
  - *Neighbours*: a country lights up on the globe, and you name every country it shares a land border with, from memory (any known spelling). Each one named turns green; a country that doesn't border it counts as a mistake. "Show the rest" marks those missed in red. Five countries a game, scored by the share of neighbours named. Easy is big countries with up to four neighbours, Medium countries with up to six, Hard those with five or more. Borders are the map's: territories and borders at sea don't count, a country's overseas parts do (France borders Brazil, by French Guiana), and Spain and Morocco don't border here, as Ceuta and Melilla are too small for the map.
  - *Flag quiz*: which country has this flag?
  - *Name that country*: a country lights up on the globe; which one is it?
  - *Shape quiz*: name the country from its outline.
  - *Capital quiz*: what's the capital of the country lit up on the globe? Typed answers take older names ("Kiev") and every capital of countries with several (Pretoria, Cape Town or Bloemfontein). Israel and Palestine are left out, as their capitals are disputed and a quiz would have to take a side.
  - *Whose capital?*: the other way round: a capital, and which country it belongs to. The globe gives nothing away until you've answered.
  - *Higher or lower*: you see one country's population (or area); does the next have more or fewer? Each right guess makes that country the one to beat, and the first wrong one ends the run. Both countries light up on the globe, and the longest streak is kept for population and for area.

  Games played in rounds (all but the letter hunt, "name them all" and higher or lower) are Easy (big countries, four answers to pick from), Medium (all but the smallest), Hard (all 197) or All countries (every one of the 197, one after another; stop whenever you like). Beyond Easy you type answers with no suggestions; any known spelling counts ("East Timor", "Burma", "Ceylon"), punctuation and spacing don't matter, and the answer shows the name used today. Tiny countries that are answers get a dot so you can see them. Rounds have an "I don't know" button that shows the answer; the round counts as wrong. Every game is about the 197 countries only: clicking or typing a territory (Greenland, Puerto Rico…) counts neither way, and territories don't light up under the pointer or get a ring.

  A clock runs while you play. Perfect runs set a time record to beat, next to the best score: every point (in *Find the country*, every country on the first try; in *Find the city*, every city spot on; in *Neighbours*, every neighbour without a mistake), no wrong letters in the letter hunt, and played to the end. Being fast with a mistake doesn't count. The clock stops at the last answer, not when you look at the results. Higher or lower keeps its longest streak instead.
- **More**: a small card for each thing, opening to all of it, with "← Back" to go back: your achievements and comparing with a friend, then, under Settings, backing up everything to a file or restoring a backup (below), installing Meridian as an app that works offline (below), and how to make the globe your Mac's screensaver.

  **Achievements**: 58 to earn from where you've been (a territory counting for its country, so the Faroe Islands are Denmark for Scandinavia), in eight groups: milestones (your first country, then 10 up to all 197), continents (every continent, all of one, Antarctica, all four hemispheres), regions (Scandinavia, the Nordics, the Baltics, Benelux, the Caribbean, the Gulf, the Stans, the G7 and more), islands, states (every US state and D.C., all of Canada, Australia or Brazil), cities and capitals, flights and distance flown (around the world, to the Moon, long haul), and return trips (one country 3 or 5 times). Each shows how far along you are ("3 of 5"), and a note pops up at the bottom when something you add earns one; click it to see them all. They're worked out from what you've saved, so a backup brings them back too.

  **Compare with a friend** puts your places and a friend's on one globe. Each of you copies your link ("Copy my link", with your name if you like) and sends it in any chat. The other pastes it in there, or just opens it on the online version, where you're both at the same address. Only your places go in the link (not your cities, flights or dates), packed into its `#compare=…` part, so nothing goes through a server. The globe then colors where you've both been green, where only you have been in your color, and where only your friend has been in theirs (the wishlist's color, as the wishlist steps aside meanwhile), with a key at the bottom. It shows "You 42 · Both 18 · Anna 24" and the places in each group, and a star puts a place only your friend has been on your wishlist, or takes it off again. Only countries are compared, so while comparing is open the globe shows just countries: your states, city pins and flights step aside, whether your friend is shown or not. Your friend is on the globe only while comparing is open; going back, or another tab or panel, puts them away, and opening it again shows them again. They stay until you remove them, off the globe until switched on.

The globe spins on its own until you touch it, and again once it's been left alone for 30 seconds. Tiny countries and islands get a ring marker, and clicks just beside a small island still count, also with the rings hidden. Zoomed in, tiny places reach 3.5 km around them, so pointing near Vatican City finds it (at this map's scale it's drawn 1.6 km from where it is). Only a pin's head answers to the pointer, so what's under its stem stays clickable. City pins fade out as they near the edge of the globe.

## Online

Meridian is online at **https://simongsk.github.io/meridian-track-your-travels/**, so it opens in any browser, on a phone too, without installing anything. Every push to `main` builds it and puts the new version there with GitHub Pages (`.github/workflows/deploy.yml`, about a minute). It's served over `https://`, so it can be installed as an app and works offline (below), and a friend opening it is at the same address as you, so "Copy my link" works between you.

Your places are kept by the browser for each address, so the online app starts empty even if you've used `npm run dev`. To bring them over, **Download backup** under More at http://localhost:5173 and **Restore from a backup…** online (see Backup).

To set it up the first time, the repository has to be public (GitHub Pages is free only for public repositories), and in its Settings › Pages, **Source** set to **GitHub Actions** (skip the suggested workflows, like Jekyll or Static HTML: the repository has its own). Then run the Deploy workflow from the Actions tab, or push to `main`.

## Screensaver

The globe can be your Mac's screensaver, spinning with your places on it. With `?screensaver` in the address the app shows only the globe, and the pointer doesn't stop it. It looks at the globe from just north of the equator, so as it turns you see Europe and Canada but also Australia and New Zealand, and its pins stay until closer to the edge. A screensaver keeps its own storage, so the address carries your places, flights, wishlist, design and layers in its `#places=…` part.

1. Run `npm run build:screensaver`. It builds the app into one self-contained file, `screensaver/index.html`, that opens from disk without a server, and copies it to `/Users/Shared/Meridian/` (screensavers can't read Documents, Desktop or Downloads).
2. Install [WebViewScreenSaver](https://github.com/liquidx/webviewscreensaver) (Apache 2.0), which shows a web page as a screensaver: `brew install --cask webviewscreensaver`. (Its README adds `--no-quarantine`, but current Homebrew no longer has that option; macOS asks you to allow the screensaver instead, below.)
3. Open System Settings › Wallpaper and click Screen Saver…. Scroll down to Other, all the way to the right, and pick WebViewScreenSaver.
4. The first time, macOS blocks it: in System Settings › Privacy & Security, allow it on the message there.
5. Back in Screen Saver, click Options and paste the screensaver address, which the app's Screensaver card, under More, copies for you.

The screensaver doesn't update by itself. After changing your places or design, copy the address again and paste it in Options; after changing the app, run `npm run build:screensaver` again.

"Preview", next to the address in the Screensaver card, shows the screensaver right there in the app, to have a look: everything but the spinning globe steps aside, and the globe turns to the screensaver's view. An "Exit preview" button shows in the corner as it opens, and again when you move the mouse (with the pointer) or tap the screen on a phone; it and Escape bring everything back, with the Screensaver card still open. The real screensaver has neither.

## Backup

Visited places, when you went and your notes, states, cities, flights and trip names, the wishlist, visits planned, a friend you compare with, best scores and times, daily challenges, the design and the settings are saved in your browser (`localStorage`). Nothing is sent anywhere, so clearing the browser's site data, or moving to another browser or computer, would leave them behind. Under More, **Download backup** saves all of it to a file (`meridian-backup-2026-10-04.json`, readable JSON), and shows when you last did. **Restore from a backup…** reads one, says what it holds and when it was made, and only replaces what's in this browser when you confirm. Every part of the file is checked the way the app checks it when loading, so a damaged or foreign file is refused as a whole rather than half restored.

Removing something by mistake is easy to take back: removing a country, a visit, a city, a flight, a place on the wishlist or a friend shows a note at the bottom ("Removed Japan · Undo") for eight seconds. **Undo**, or Cmd/Ctrl+Z when you're not typing, puts it back as it was: a visit with its note, a flight where it was among the others (so its trip stays the same). Only the last removal can be undone.

Opening the app never writes over what's saved: something is saved only when you change it. So if the app finds data it can't read (saved by a newer version, or damaged), it leaves it as it is. If you then change that part, the new data is saved and the old is kept beside it, under the same name with `.unreadable` added.

## Install as an app

Meridian can be installed as an app, which opens in its own window from the dock or home screen, with its globe icon:

- **Chrome or Edge**: the **Install Meridian** button under More (App), or the install icon at the end of the address bar.
- **Safari on a Mac**: File › Add to Dock.
- **iPhone or iPad**: in Safari, Share › Add to Home Screen.

It's called just Meridian. An app installed under an earlier name (it was "Meridian · Countries of the World", then "Meridian · Track your Travels") can keep that name in its window and menus until the browser updates it, which Chrome does now and then when it opens the app; to have it at once, uninstall the app and install it again. Your places are kept by the browser for the address, not by the app, so they stay, as long as you don't tick "Also clear data" when uninstalling (download a backup first, to be safe).

After the first visit it works offline, installed or not: the globe, your places and flights, the cities and airports, and every game. The build writes a service worker (`sw.js`, by `vite.offline.ts`) that keeps a copy of every file of the app, with a version made from their contents. Online, the page comes from the network, so a new build is noticed. Once the new version has been downloaded, in the background, a note at the bottom says "A new version is ready": **Reload** switches to it at once, and otherwise it takes over the next time the app is opened. Either way the old copy is cleared. While the app stays open, it looks for a new version every hour and whenever you come back to it. The service worker runs only in the production build served over the web (not `npm run dev`, nor the screensaver). Browsers allow one only on `https://` or `localhost`.

Built with React, TypeScript and Vite, using [react-globe.gl](https://github.com/vasturiano/react-globe.gl) (three.js) for the globe, [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 1:50m) for country shapes and [flag-icons](https://github.com/lipis/flag-icons) for flags. The fonts are Fraunces, Inter and JetBrains Mono (SIL Open Font License), from Fontsource. Flags and fonts are bundled, so no requests go to third parties.

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

To see the app with someone's travels already in it, run `npm run dev:demo` and open http://localhost:5174. It has 42 places with visits over ten years (some with notes, and several visited again and again for the heat map), states, cities, trips made from its flights (three of them named), a wishlist, a trip to India coming up (with its flights booked) and one to Chile, best scores and a daily streak. Being on another port, its data is kept apart from yours. The sample data is put in when nothing is saved there yet; add `?reset` to the address to start over. It's only in this mode, not in the build.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run dev:demo` | Start the dev server with sample data, on port 5174 (see Getting started) |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run build:screensaver` | Build the screensaver file and copy it to `/Users/Shared/Meridian/` (see Screensaver) |
| `npm run preview` | Serve the production build |
| `npm run lint` | Lint with Oxlint |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:watch` | Same, re-running on changes |
| `npm run test:coverage` | Unit and component tests with a coverage report |
| `npm run test:e2e` | End-to-end tests against the real WebGL globe (Playwright) |
| `npm run data:map` | Regenerate `src/data/countries-50m.json` (the country shapes, with lakes cut out) |
| `npm run data:extra` | Regenerate `src/data/extra-countries.json` (places too small for the 1:50m map) |
| `npm run data:regions` | Regenerate `src/data/regions.json` (states and provinces) |
| `npm run data:facts` | Download capitals, population and area from the World Bank into `src/data/country-facts.json` |
| `npm run data:cities` | Regenerate `src/data/cities.json` (each place's big and well-known cities, with their states where the map has them) |
| `npm run data:airports` | Download the airports with scheduled flights from OurAirports into `src/data/airports.json` |
| `npm run data:icons` | Draw the app icons in `public/icons/` (192, 512, and 180 for iPhone) from `public/icon.svg` |
| `npm run data:night-lights` | Keep the lights of NASA's Earth at night, on black, in `src/assets/earth-lights.jpg`, for the Realistic design |

The first time you run the end-to-end tests, install the browser:

```bash
npx playwright install chromium
```

## Tests

- **Unit and component tests** (Vitest and Testing Library, in jsdom): the data, the game rules, the globe's layers against a real three.js camera, every panel, and the whole app with a stand-in for the WebGL globe. About 980 tests, covering over 99% of the lines.
- **End-to-end tests** (Playwright): the real app with its WebGL globe in headless Chromium, on a desktop and a phone (touch, tab bar, sheets): hovering and clicking countries, visited places, states, cities and flights kept after reloading, the wishlist, a friend's link, the settings, a year in review and its time-lapse, a backup downloaded and restored, undoing a removal, the designs, every game, the screensaver and its preview (42 tests). In CI they run on the production build, with the service worker.

`.github/workflows/tests.yml` runs all of it on GitHub for every pull request and every push to `main`: lint, the unit tests, the build (which type-checks), and the end-to-end tests. `.github/workflows/deploy.yml` then puts each push to `main` online (see Online).

## How it works

```
src/
  App.tsx              ties it together: globe, hover/selection, menu, games, camera flights
  CountryPanel.tsx     panel shown for the selected country
  RegionPicker.tsx     its states to tick off
  CityPicker.tsx       its visited cities, and a box to add more
  FlagCorner.tsx       hovered country's flag, bottom-right
  Tooltip.tsx          country name that follows the mouse
  countries.ts         every place: shape, names, codes, size, map color; lookup by point or name
  flags.ts             country → flag image URL
  data/
    names.ts           display names, alternative spellings, countries vs territories
    sovereigns.ts      the country each territory belongs to (Greenland to Denmark)
    continents.ts      each place's continent
    westernSahara.ts   shows all of Western Sahara (see below)
    countries-50m.json    the country shapes, with lakes cut out
    extra-countries.json  Tuvalu and Gibraltar, from the 1:10m map
    regions.ts         states and provinces: names, lookup, loading (shapes in regions.json)
    facts.ts           capital, population and area (data in country-facts.json)
    cities.ts          big and well-known cities: loading, lookup (data in cities.json)
    airports.ts        airports with scheduled flights: loading, search (data in airports.json)
    flights.ts         flights: distances, figures, routes, moving old city flights to airports
    trips.ts           flights grouped into trips as worked out from where they go, and their stops
    savedTrips.ts      trips made by hand: visits and flights in order, what's in none, where something new goes
  storage.ts           state saved in the browser
  base64url.ts         packing text into an address, for the screensaver and a friend's link
  screensaver.ts       the screensaver mode, and carrying your places in its address
  demo.ts              sample data for `npm run dev:demo`
  ui/                  the cards with "GAMES ··· 06" headers, the boxes of figures, the key in the globe's corner,
                       and keeping password managers off the text boxes
  nav/                 the top bar, tabs, the column of cards on the right
  explore/             the Explore tab's buttons: the atlas search, and the designs and layers, with their settings
  visited/             visited countries, states and cities; the wishlist; a friend to compare with; flights, and the airport search;
                       achievements (achievements.ts), their view and the note when one is earned;
                       each year's review (yearInReview.ts) and its view
  design/              design picker, how to set up the screensaver, and the way out of its preview
  more/                the More tab's small cards, each opening to all of it
  settings/            backups: making, checking and restoring them, and their card; installing the app
  pwa/                 the service worker (serviceWorker.ts, written into the build by vite.offline.ts),
                       starting it, and the browser's offer to install
  games/               game rules (games.ts, letterGame.ts, higherLower.ts, daily.ts, cityGame.ts, neighboursGame.ts), what the globe shows (globeView.ts),
                       state and best scores (useGame.ts), perfect runs and their times (records.ts),
                       the panel, answer box and outlines
  globe/
    sphereMesh.ts      triangulating countries on the sphere
    countryLayer.ts    all countries merged into one mesh, plus borders and markers; the raised country
    regionLayer.ts     states and provinces drawn over their country
    pinLayer.ts        pins on visited cities, and finding the pin under the pointer
    flightLayer.ts     flight routes as arcs, with planes flying along them
    colors.ts          which color each country gets (game answers > hover > a friend's > visited > wishlist > land)
    themes.ts          the designs
    hooks.ts           the layers, pointer picking, depth precision, idle spin
    interaction.ts     click-vs-drag, flight duration/altitude, easing
    picking.ts         screen position → lat/lng on the globe
    style.ts           heights
e2e/                   Playwright tests
scripts/               data extraction
.github/workflows/     the tests, run on GitHub, and putting the app online with GitHub Pages
```

A few choices keep the globe smooth:

- **One mesh for all countries.** The globe library's polygon layer draws each country piece separately (~1,500 meshes, 7,500+ draw calls per frame). Instead, every country is merged into a single mesh. Each country keeps its own range of vertex colors, so hover and game answers recolor it in place. The selected country is drawn separately, slightly raised with walls.
- **Our own triangulation.** Each polygon is projected with a gnomonic projection centered on it (great circles become straight lines), triangulated with earcut so it follows the coast exactly, then subdivided until no edge is longer than 3° so the flat triangles hug the sphere. This works across the antimeridian and around the poles, builds the whole world in ~60 ms, and avoids the gaps the globe library's triangulation left in countries like Greenland.
- **Depth precision.** The camera's near plane moves out as you zoom out, so the land never flickers against the ocean below it.
- **No mesh raycasting.** Hover and click intersect a ray with the globe's sphere, then look up which country contains that lat/lng (about 0.1 ms), forgiving a few pixels near markers and coasts.
- **Eased auto-rotate.** The idle spin eases in and out, stops on any interaction, and resumes after 30 seconds untouched.

## Country data

The map has 243 places: the 197 countries (the 193 UN members, the observer states Vatican City and Palestine, and Kosovo and Taiwan) and 46 territories and other areas, such as Greenland, Puerto Rico, Hong Kong, Western Sahara and Antarctica.

Each place has:

- `name`: the display name, e.g. "Eswatini". The map data (Natural Earth) abbreviates names ("Dem. Rep. Congo") and writes "eSwatini", the styling the kingdom itself uses; we show full current English short names.
- `mapName`: the name in the map data.
- `aliases`: every other name it goes by, from ISO and a curated list of former and common names ("Swaziland", "East Timor", "Ivory Coast").
- `kind`: `"country"` or `"territory"`.
- `continent`: from flag-icons' country data, with the Caribbean islands it places in South America (Aruba, Curaçao, Bonaire, Trinidad and Tobago) counted as North America, as usual. Russia and Cyprus are in Europe; Türkiye, Georgia, Armenia and Azerbaijan in Asia.
- `isoCode` and `isoAlpha2`: ISO 3166-1 codes (`"208"`, `"DK"`). A few disputed areas have none (`null`); Kosovo uses the widely adopted `"XK"`.
- `centroid`, `extent` and `areaKm2`: center and size of the main landmass, and the area.
- `tiny`: under 2,500 km², so it gets a marker.
- `island`: shares no land border, so (under 30,000 km²) it gets a ring in the letter hunt.
- `mapColor`: 0–4, never shared with a neighbor.

Some corrections to the map data:

- **Lakes.** Natural Earth's country shapes cover their lakes (lakes are a separate layer), so the Great Lakes, Lake Victoria and Baikal would be land. `scripts/extract-map.mjs` cuts its 275 lakes at 1:50m out of the countries, and `extract-regions.mjs` out of the states, so they show as water and pointing at them finds no country. The cutting is done with Clipper on the map's own grid: every other point stays exactly where it was (so neighbors still share their borders), and points along borders that follow a parallel, like the 49th between the USA and Canada, are kept, as without them those borders would bulge into great circles on the globe. Borders that ran through lakes are now lake shores.
- **Borders as the UN counts them.** Natural Earth draws borders as they are on the ground. Where the UN counts land as another country's, `scripts/un-borders.mjs` follows the UN: Crimea is Ukraine's (General Assembly resolution 68/262), the Golan Heights are Syria's (Security Council resolution 497, cut along the 1967 line), the Chagos Archipelago is Mauritius's (resolution 73/295), and Somaliland and Northern Cyprus, which run themselves but are recognized by few countries, are part of Somalia and Cyprus. The countries involved say so in their panels. Disputes the UN takes no side in, like Kashmir, stay as drawn. Kosovo and Taiwan, which aren't UN members, are kept as countries, as in most lists of the world's 197.
- **Western Sahara.** Natural Earth draws only the inland strip east of the Moroccan sand wall as Western Sahara and counts the coast as Morocco. We show the whole territory, bordering Morocco along 27°40′N, as the UN and most maps do.
- **Tuvalu and Gibraltar** are too small for the 1:50m map and are copied from the 1:10m map.
- **The Maldives** are in the map but are a few tiny atolls, so like other small places they get a marker.
- **Monaco's area.** The World Bank gives 75 km²; it's about 2 km², set in `country-facts-extra.json`.

Capitals, population (2024) and total area come from the [World Bank's open data](https://data.worldbank.org/) (CC BY 4.0). Places it doesn't cover (Taiwan, Vatican City, Western Sahara and several territories) use recent censuses and estimates from `src/data/country-facts-extra.json`, marked as estimates in the app. Somalia's and Cyprus's figures include Somaliland and Northern Cyprus.

Cities come from [GeoNames](https://www.geonames.org/) (CC BY 4.0), via [all-the-cities](https://github.com/zeke/all-the-cities). For each place, `scripts/extract-cities.mjs` keeps the capital, every city of a million or more, the next biggest (more for more populous countries, from 50,000 people), and a hand-picked list of famous smaller ones (Venice, Key West, Chefchaouen…), leaving out suburbs within 25 km of a city already picked. GeoNames often uses local spellings, so the script has English names for well-known cities ("Cologne", not "Köln") and leaves out transliteration marks; it also has a short list of GeoNames entries that are districts, camps or campuses rather than cities. Overseas regions like Réunion are listed under the country the map draws them in. Cities in the USA, Canada, Australia and Brazil carry their state: GeoNames' state code for the city, matched to the map's state that most of that code's towns fall in (the city's own point won't do, as the map's simplified outlines leave cities on a coast or a border just outside). A few places the all-the-cities extract leaves out (Vilanculos) are added by hand, with their GeoNames ids.

Airports come from [OurAirports](https://ourairports.com/data/) (public domain): `scripts/fetch-airports.mjs` keeps the large and medium airports with scheduled airline service and an IATA code, which covers every international airport.

Lakes come from Natural Earth's 1:50m lakes, also via sane-topojson.

The Realistic design's picture of the Earth is NASA's [Blue Marble](https://visibleearth.nasa.gov/collection/1484/blue-marble) (public domain), 4096 × 2048, with a map of where the sea is to make it shine and one of how high the land is, for the relief. Its lights at night are kept from NASA's Earth at night: in that picture they're dots a pixel or two wide on moonlit land and sea, which would blur into the blue when shrunk to fit the globe, so `scripts/make-night-lights.mjs` (`npm run data:night-lights`) keeps only what's brighter than around it, on black, where it blurs into a glow instead. All of them come from [three-globe](https://github.com/vasturiano/three-globe)'s examples (`src/assets/`).

States and provinces come from Natural Earth's 1:50m states and provinces, which covers the USA (50 states and D.C.), Canada, Australia and Brazil. They're copied out of [sane-topojson](https://github.com/etpinard/sane-topojson) (MIT) and load in the background after the globe. More countries would need Natural Earth's much larger 1:10m dataset.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
