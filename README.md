# Snow Day ☀️🏔️

**A little Swiss mountain-planning project.** I grew up around the Alps and wanted a simpler way to answer a surprisingly difficult question: *Where should I go this weekend, and is the journey worth it?*

Snow Day compares mountain weather and public-transport connections across **12 Swiss ski resorts**. There's also a **Hike Day** mode for the warmer months, with curated routes and checks for daylight, difficulty and the last train home.

The interface takes inspiration from vintage Swiss ski posters and railway wayfinding. It is built with vanilla JavaScript, HTML and CSS, plus a small Node.js backend. No framework or API key is required.

## What it does

- Checks mountain forecasts at resort or trail elevation using **Open-Meteo**.
- Compares fresh snow, sun, temperatures and wind using an explicit **0–100 ski score**. Different preferences change the weights.
- Looks up **Swiss train connections** and weighs the journey against conditions.
- For hiking, filters unsuitable routes based on season, snow risk, trail grade, daylight and the return journey.
- Explains the pick, displays alternatives, and builds a journey timeline using timetable data.
- Shows a clearly dated **recorded example** if a live data service is unavailable. Recorded data is never labelled as live.

## Try it locally

You'll need **Node.js 20 or newer**. There are no packages to install.

```bash
npm run dev
```

Open **http://localhost:3000**. Use the Snow Day / Hike Day switch at the top and select your starting point, dates and preferences. The summary is generated from your selections rather than accepting arbitrary free-text instructions.

## Tests

```bash
npm test             # offline regression tests
npm run contrast     # check theme colour contrast
```

Tests replay the recorded API responses in `fixtures/`, including weather-unit conversions, train arrival/departure consistency, recommendation ranking and hiking safety constraints. To refresh the recordings from live services, run `npm run fixtures:record` (this requires network access).

## How it's organised

| Path | Purpose |
|---|---|
| `public/` | Interface, charts and Swiss-poster-inspired artwork |
| `api/plan.js` | Planning endpoint; streams progress and results |
| `lib/planner.js` / `lib/hikePlanner.js` | Ski and hiking recommendations |
| `lib/weather.js` / `lib/hikeWeather.js` | Forecast requests and processing |
| `lib/trains.js` / `lib/timeline.js` | Swiss connections and journey timeline |
| `lib/score.js` / `lib/hikeScore.js` | Deterministic scoring |
| `lib/resorts.js` / `lib/trails.js` | Curated destinations and references |
| `fixtures/` / `test/` | Recorded responses and offline checks |

## Deployment

Deploy the repository to **Vercel** using the **Other** framework preset. The included `vercel.json` configures the static `public/` directory and the `/api/plan` function. GitHub stores the source code; Vercel runs the backend. No credentials are required for this version.

## Limitations

Forecast snow depth is modelled, not a piste measurement. Season dates are approximate, and the app does **not** know whether lifts are open on a particular day. London-to-Switzerland flights are not searched or timed. Hiking routes use curated official trail figures; incomplete routes are excluded. Check operating conditions and local safety guidance before travelling.

## Data and credits

- Weather: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0)
- Swiss timetable: [transport.opendata.ch](https://transport.opendata.ch/)
- Typeface families: League Gothic, Instrument Serif and Geist (SIL Open Font License)
- Visual direction: original illustrations referencing Swiss alpine travel posters

Created by Stella Sun
