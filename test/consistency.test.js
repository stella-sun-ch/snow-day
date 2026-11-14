// Checks that what the app shows matches what the APIs said. All HTTP is
// mocked with fixtures/recorded.json (real responses).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESORTS, getResort } from '../lib/resorts.js';
import { convert, summariseForecast, fetchForecast } from '../lib/weather.js';
import { summariseConnections, formatDuration, parseDuration, getJourney, NO_CONNECTION } from '../lib/trains.js';
import { buildTimeline, labelTimeline } from '../lib/timeline.js';
import { planSnowDay, confidenceFor } from '../lib/planner.js';
import { recordedFetch, timetableResponses, forecastResponse, fixture, TODAY, NOW, WEEKEND } from './helpers.js';

const minutesBetween = (a, b) => (Date.parse(b.replace(/(\d{2})(\d{2})$/, '$1:$2')) - Date.parse(a.replace(/(\d{2})(\d{2})$/, '$1:$2'))) / 60000;

/* (a) durations ------------------------------------------------------------ */

test('(a) every displayed duration equals arrival minus departure from the API response', () => {
  let checked = 0;
  for (const [url, json] of timetableResponses()) {
    for (const c of json.connections) {
      assert.equal(parseDuration(c.duration), minutesBetween(c.from.departure, c.to.arrival), `API duration in ${url}`);
    }
    const j = summariseConnections(json);
    if (!j) continue;
    const real = minutesBetween(j.departsAt, j.arrivesAt);
    assert.equal(j.durationMin, real, url);
    assert.equal(j.duration, formatDuration(real), url); // the string the planks and plan show
    checked += 1;
  }
  assert.ok(checked >= 40, `checked ${checked} recorded journeys`);
});

test('(a) the plan’s arrival row and the journey agree on times and duration', async () => {
  for (const resort of RESORTS) {
    const j = await getJourney({ resort, start: 'London', date: WEEKEND.from, fetchImpl: recordedFetch(), now: NOW });
    assert.equal(j.status, 'ok', resort.id);
    const rows = buildTimeline(j, WEEKEND.from);
    const arrive = rows.at(-1);
    assert.equal(arrive.time, j.arrives);
    assert.ok(arrive.detail.startsWith(`${j.duration} by public transport`), resort.id);
    const firstLeg = rows.find((r) => r.kind === 'leg');
    assert.equal(firstLeg.time, j.departs, `${resort.id}: the plan starts when the journey does`);
  }
});

/* (b) timeline day changes -------------------------------------------------- */

test('(b) the timeline labels every change of day with the weekday', () => {
  const rows = labelTimeline([
    { date: '2026-11-13', time: null, period: 'evening' },
    { date: '2026-11-14', time: '06:39' },
    { date: '2026-11-14', time: '08:57' },
    { date: '2026-11-15', time: '00:10' },
  ]);
  assert.deepEqual(rows.map((r) => r.label), ['Fri evening', 'Sat 06:39', '08:57', 'Sun 00:10']);
});

test('(b) a real London journey shows "Fri evening" for the flight, then "Sat" on the first train', async () => {
  const saturday = WEEKEND.from;
  const j = await getJourney({ resort: getResort('saas-fee'), start: 'London', date: saturday, fetchImpl: recordedFetch(), now: NOW });
  const rows = buildTimeline(j, saturday);
  assert.equal(rows[0].kind, 'flight');
  assert.equal(rows[0].label, 'Fri evening');
  assert.match(rows[0].title, /^Fly London → (Geneva|Zurich) the evening before$/);
  assert.equal(rows[1].label, `Sat ${j.departs}`);
  for (const r of rows.slice(2)) assert.match(r.label, /^\d{2}:\d{2}$/, 'same day: time only');
  assert.ok(!rows.some((r) => /\d/.test(r.title) && r.kind === 'flight'), 'no flight times');
});

/* (c) no connection ----------------------------------------------------------- */

test('(c) a resort with no connection renders the "no connection" state and ranks last', async () => {
  // Plan once to find the pick, then replay with that resort's timetable empty.
  const first = await planSnowDay({ choices: fixture.request, today: TODAY, zurichHour: fixture.zurichHour, fetchImpl: recordedFetch(), now: NOW });
  const victim = first.recommendation.pick.resort_id;
  const stationId = getResort(victim).station.id;
  const fetchImpl = recordedFetch({ override: (url) => (url.includes(`to=${stationId}&`) ? { connections: [] } : undefined) });

  const r = await planSnowDay({ choices: fixture.request, today: TODAY, zurichHour: fixture.zurichHour, fetchImpl, now: NOW });
  assert.notEqual(r.recommendation.pick.resort_id, victim, 'never picked');
  const last = r.recommendation.alternatives.at(-1);
  assert.equal(last.resort_id, victim, 'ranked last');
  assert.equal(r.journeys[victim].status, 'none');
  assert.equal(r.journeys[victim].message, NO_CONNECTION); // what the plank shows instead of a time
  assert.equal(last.verdict, `${NO_CONNECTION}.`);
  assert.equal(r.journeys[victim].duration, undefined, 'no invented time');

  const rows = buildTimeline(r.journeys[victim], WEEKEND.from);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, NO_CONNECTION);
});

/* (d) units ------------------------------------------------------------------- */

test('(d) unit conversions for the weather variables are correct', () => {
  assert.equal(convert(12, 'cm', 'cm'), 12);
  assert.equal(convert(2, 'inch', 'cm'), 5.08);
  assert.equal(convert(1, 'inch', 'mm'), 25.4);
  assert.equal(convert(36_000, 's', 'hours'), 10);
  assert.equal(convert(10, 'm/s', 'kmh'), 36);
  assert.equal(convert(10, 'kn', 'kmh'), 18.52);
  assert.equal(convert(1.25, 'm', 'm'), 1.25);
  assert.equal(convert(10, 'ft', 'm'), 3.048);
  assert.equal(convert(-4, '°C', 'celsius'), -4);
  assert.equal(convert(32, '°F', 'celsius'), 0);
  assert.equal(convert(null, 'cm', 'cm'), null);
  assert.throws(() => convert(1, 'furlongs', 'cm'), /Unexpected unit/);
});

test('(d) every summarised value matches the recorded API value after conversion', async () => {
  const [, raw] = forecastResponse();
  const { json } = await fetchForecast(RESORTS, { fetchImpl: recordedFetch(), now: NOW });
  const s = summariseForecast(json, RESORTS, { today: TODAY });
  RESORTS.forEach((r, k) => {
    const block = raw[k];
    assert.equal(block.daily_units.sunshine_duration, 's');
    assert.equal(block.hourly_units.snow_depth, 'm');
    s[r.id].days.forEach((d, i) => {
      assert.equal(d.sunshineH, Math.round((block.daily.sunshine_duration[i] / 3600) * 10) / 10);
      assert.equal(d.snowfallCm, Math.round(block.daily.snowfall_sum[i]));
      assert.equal(d.gustMaxKmh, Math.round(block.daily.wind_gusts_10m_max[i]));
      assert.equal(d.tempMaxC, Math.round(block.daily.temperature_2m_max[i]));
      const noon = block.hourly.time.indexOf(`${d.date}T12:00`);
      if (block.hourly.snow_depth[noon] != null) assert.equal(d.depthCm, Math.round(block.hourly.snow_depth[noon] * 100));
    });
  });
});

/* relative dates -------------------------------------------------------------- */

test('relative dates are computed from the actual current date', () => {
  assert.equal(confidenceFor('2026-11-12', '2026-11-14').confidence_reason.split('.')[0], 'Saturday is 2 days away');
  assert.equal(confidenceFor('2026-11-13', '2026-11-14').confidence_reason.split('.')[0], 'Saturday is tomorrow');
  assert.equal(confidenceFor('2026-11-14', '2026-11-14').confidence_reason.split('.')[0], 'Saturday is today');
  assert.equal(confidenceFor('2026-11-06', '2026-11-14').confidence, 'low');
});
