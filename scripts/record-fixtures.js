// Records real API responses, one file per mode:
//   fixtures/recorded.json (Snow day)
//     - the Open-Meteo forecast for all resorts (one request)
//     - connections from Geneva and Zurich airports to every resort, for each
//       day of the default request ("this weekend")
//   fixtures/recorded-hike.json (Hike day)
//     - the Open-Meteo forecast at every verified trail's high point
//     - connections from both airports to every trail's start station, and the
//       last good trains home from every trail's end station, for each day of
//       the default request
// Usage: npm run fixtures:record [-- snow|hike]   (both by default)
// The tests replay these, and the app shows them as a labelled recorded run
// when the live APIs are down. Run it with `npm run fixtures:record`.
//
// To keep the file small, each connection's `passList` (every stop the train
// calls at), the top-level station lists and each stop's `location` (a copy of
// its `station`) are dropped. Nothing else is changed: every time and duration
// is exactly as the API returned it.

import { writeFile, mkdir } from 'node:fs/promises';
import { RESORTS } from '../lib/resorts.js';
import { buildForecastUrl } from '../lib/weather.js';
import { buildConnectionsUrl, ORIGINS } from '../lib/trains.js';
import { DEFAULT_CHOICES, skiDates, addDays } from '../lib/planner.js';
import { todayInZurich, zurichHour } from '../lib/time.js';
import { FIXTURE_URLS } from '../lib/fixtures.js';
import { VERIFIED_TRAILS } from '../lib/trails.js';
import { buildHikeForecastUrl } from '../lib/hikeWeather.js';
import { DEFAULT_HIKE_CHOICES } from '../lib/hikePlanner.js';
import { RETURN_BY } from '../lib/trains.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res.json();
}

const stop = (p) => (p ? { ...p, location: undefined } : p);

function slim(timetable) {
  const { stations, ...rest } = timetable;
  return {
    ...rest,
    connections: (rest.connections ?? []).map((c) => ({
      ...c,
      from: stop(c.from),
      to: stop(c.to),
      sections: (c.sections ?? []).map((s) => ({
        ...s,
        departure: stop(s.departure),
        arrival: stop(s.arrival),
        journey: s.journey ? { ...s.journey, passList: undefined } : s.journey,
      })),
    })),
  };
}

const now = new Date();
const today = todayInZurich(now);
const hour = zurichHour(now);
const which = process.argv[2] ?? 'all';

function weekendDays(when) {
  const { from, to } = skiDates(when, today, hour);
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

async function save(mode, request, responses, summary) {
  const url = FIXTURE_URLS[mode];
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, `${JSON.stringify({
    recordedAt: now.toISOString(),
    today,
    zurichHour: hour,
    request,
    note: 'Real responses from api.open-meteo.com and transport.opendata.ch, recorded by scripts/record-fixtures.js.',
    responses,
  })}\n`);
  console.log(`Wrote ${summary} to ${url.pathname.split('/').slice(-2).join('/')}`);
}

async function recordSnow() {
  const days = weekendDays(DEFAULT_CHOICES.when);
  const responses = {};
  const forecastUrl = buildForecastUrl(RESORTS);
  responses[forecastUrl] = await get(forecastUrl);
  console.log(`Forecast for ${RESORTS.length} resorts recorded.`);
  let n = 0;
  for (const resort of RESORTS) {
    for (const date of days) {
      for (const origin of [ORIGINS.GVA, ORIGINS.ZRH]) {
        const url = buildConnectionsUrl({ from: origin.id, to: resort.station.id, date });
        responses[url] = slim(await get(url));
        n += 1;
        await pause(400); // stay well inside the timetable's rate limit
      }
    }
    console.log(`  trains to ${resort.name}: done`);
  }
  await save('snow', DEFAULT_CHOICES, responses, `1 forecast and ${n} timetable responses for ${days.join(', ')}`);
}

async function recordHike() {
  const days = weekendDays(DEFAULT_HIKE_CHOICES.when);
  const responses = {};
  const forecastUrl = buildHikeForecastUrl(VERIFIED_TRAILS);
  responses[forecastUrl] = await get(forecastUrl);
  console.log(`Forecast for ${VERIFIED_TRAILS.length} trails recorded.`);
  let n = 0;
  for (const trail of VERIFIED_TRAILS) {
    for (const date of days) {
      for (const origin of [ORIGINS.GVA, ORIGINS.ZRH]) {
        const out = buildConnectionsUrl({ from: origin.id, to: trail.startStation.id, date });
        responses[out] = slim(await get(out));
        await pause(400);
        const home = buildConnectionsUrl({ from: trail.endStation.id, to: origin.id, date, time: RETURN_BY, arriveBy: true });
        responses[home] = slim(await get(home));
        await pause(400);
        n += 2;
      }
    }
    console.log(`  trains for ${trail.name}: done`);
  }
  await save('hike', DEFAULT_HIKE_CHOICES, responses, `1 forecast and ${n} timetable responses for ${days.join(', ')}`);
}

if (which === 'all' || which === 'snow') await recordSnow();
if (which === 'all' || which === 'hike') await recordHike();
