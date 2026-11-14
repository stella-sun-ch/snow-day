import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESORTS, getResort, inTypicalSeason } from '../lib/resorts.js';
import { buildForecastUrl, summariseForecast, fetchForecast } from '../lib/weather.js';
import { parseDuration, formatDuration, summariseConnections, getJourney, originsFor } from '../lib/trains.js';
import { recordedFetch, TODAY, NOW, WEEKEND, timetableResponses } from './helpers.js';

const saasFee = getResort('saas-fee');
const zermatt = getResort('zermatt');

test('every resort has the fields the app relies on', () => {
  const ids = new Set();
  for (const r of RESORTS) {
    assert.ok(!ids.has(r.id), `duplicate id ${r.id}`);
    ids.add(r.id);
    assert.ok(r.topM > r.villageM, r.id);
    assert.ok(r.forecast.elevationM > r.villageM && r.forecast.elevationM < r.topM, r.id);
    assert.match(r.season.opens, /^\d{2}-\d{2}$/);
    assert.match(r.station.id, /^\d{7}$/, `${r.id} needs a timetable station id`);
    assert.equal(new URL(r.website).protocol, 'https:', `${r.id} needs an official site`);
    assert.equal(new URL(r.tickets).protocol, 'https:', `${r.id} needs an https ticket page`);
    assert.equal(r.estimateMin, undefined, 'no hard-coded train times');
  }
});

test('typical seasons handle the New Year wrap', () => {
  assert.equal(inTypicalSeason(saasFee, '2026-11-14'), true); // opens July, closes May
  assert.equal(inTypicalSeason(saasFee, '2026-06-01'), false);
  assert.equal(inTypicalSeason(getResort('verbier'), '2026-11-14'), false);
  assert.equal(inTypicalSeason(getResort('verbier'), '2027-01-10'), true);
});

test('the forecast URL asks for every resort at ski height, with 3 past days', () => {
  const u = new URL(buildForecastUrl([saasFee, zermatt]));
  assert.equal(u.searchParams.get('latitude'), `${saasFee.forecast.lat},${zermatt.forecast.lat}`);
  assert.equal(u.searchParams.get('elevation'), '2500,2600');
  assert.equal(u.searchParams.get('timezone'), 'Europe/Zurich');
  assert.equal(u.searchParams.get('past_days'), '3');
  assert.match(u.searchParams.get('daily'), /snowfall_sum/);
  assert.match(u.searchParams.get('daily'), /sunshine_duration/);
  assert.match(u.searchParams.get('hourly'), /snow_depth/);
});

test('recorded forecasts are summarised per resort and per day, with the API’s own elevation', async () => {
  const { json } = await fetchForecast([saasFee, zermatt], { fetchImpl: recordedFetch(), now: NOW });
  const s = summariseForecast(json, [saasFee, zermatt], { today: TODAY, style: 'powder' });
  const sf = s['saas-fee'];
  assert.equal(sf.days.filter((d) => d.isPast).length, 3);
  assert.equal(sf.elevationM, json[0].elevation);
  for (const d of sf.days) {
    assert.ok(d.score >= 0 && d.score <= 100);
    assert.ok(d.sunshineH >= 0 && d.sunshineH <= 24);
  }
});


test('a mismatched response is rejected', () => {
  assert.throws(() => summariseForecast([{}, {}], [saasFee], { today: TODAY }), /Expected 1/);
});

test('journey durations are parsed and written the Swiss signpost way', () => {
  assert.equal(parseDuration('00d03:25:00'), 205);
  assert.equal(parseDuration('01d00:05:00'), 1445);
  assert.equal(parseDuration('nonsense'), null);
  assert.equal(formatDuration(205), '3 h 25 min');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(45), '45 min');
});

test('the earliest arrival is chosen, walks are skipped, and line numbers lose their zero padding', () => {
  for (const [, json] of timetableResponses()) {
    const j = summariseConnections(json);
    if (!j) continue;
    const earliest = json.connections.map((c) => c.to.arrival).sort()[0];
    assert.equal(j.arrivesAt, earliest);
    for (const leg of j.legs) assert.doesNotMatch(leg.line, / 0/);
  }
});

test('from London, the airport with the shorter real connection is used', async () => {
  const j = await getJourney({ resort: saasFee, start: 'London', date: WEEKEND.from, fetchImpl: recordedFetch(), now: NOW });
  assert.equal(j.status, 'ok');
  assert.ok(j.flying);
  const other = await getJourney({
    resort: saasFee, start: j.airport === 'Zurich' ? 'Geneva airport' : 'Zurich airport', date: WEEKEND.from, fetchImpl: recordedFetch(), now: NOW,
  });
  assert.ok(other.status !== 'ok' || j.durationMin <= other.durationMin);
});

test('starting points map to real stations', () => {
  assert.deepEqual(originsFor('London').map((o) => o.name), ['Genève-Aéroport', 'Zürich Flughafen']);
  assert.deepEqual(originsFor('Zurich').map((o) => o.name), ['Zürich HB']);
  assert.deepEqual(originsFor('Geneva').map((o) => o.name), ['Genève']);
  assert.deepEqual(originsFor('Bern').map((o) => o.name), ['Bern']);
});

test('if the timetable can’t be reached, the journey says so and has no times', async () => {
  const failing = async () => { throw new TypeError('offline'); };
  const j = await getJourney({ resort: saasFee, start: 'London', date: WEEKEND.from, fetchImpl: failing });
  assert.equal(j.status, 'unavailable');
  assert.equal(j.duration, undefined);
  assert.match(j.message, /could not be reached/);
});
