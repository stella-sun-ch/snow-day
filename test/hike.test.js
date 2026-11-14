// Hike Day: the score, the hard rules and the planner. HTTP is mocked with
// fixtures/recorded-hike.json (real responses). Small synthetic days are used
// only as inputs to the pure scoring and rule functions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreHikeDay, fitsDay, lengthMatches, dayProblem, LENGTHS } from '../lib/hikeScore.js';
import { candidates, evaluateTrip, planHikeDay } from '../lib/hikePlanner.js';
import { VERIFIED_TRAILS, getTrail } from '../lib/trails.js';
import { skiDates } from '../lib/planner.js';
import { loadFixture, fixtureFetch } from '../lib/fixtures.js';
import { summariseHikeForecast, fetchHikeForecast } from '../lib/hikeWeather.js';

const fixture = await loadFixture('hike');
const NOW = () => Date.parse(fixture.recordedAt);
const recordedFetch = (opts = {}) => fixtureFetch(fixture, { strict: true, ...opts });
const WEEKEND = skiDates('this weekend', fixture.today, fixture.zurichHour);

const day = (over = {}) => ({
  date: '2026-08-15', sunshineH: 6, precipMm: 0, precipProbPct: 10, thunder: false, gustMaxKmh: 20,
  tempMaxC: 14, cloudCoverPct: 30, sunrise: '06:30', sunset: '20:30', snowLikely: false, ...over,
});

test('more rain never raises the hike score', () => {
  for (const wants of [[], ['views'], ['sunshine'], ['lakes']]) {
    for (const base of [day(), day({ sunshineH: 1, cloudCoverPct: 90 }), day({ tempMaxC: 28, gustMaxKmh: 60 })]) {
      let last = Infinity;
      for (const [mm, prob] of [[0, 0], [0.5, 20], [1, 40], [2, 50], [5, 70], [10, 90], [25, 100]]) {
        const s = scoreHikeDay({ ...base, precipMm: mm, precipProbPct: prob }, { wants }).score;
        assert.ok(s <= last, `rain ${mm} mm / ${prob}% raised the score from ${last} to ${s}`);
        last = s;
      }
    }
  }
  assert.ok(scoreHikeDay(day({ thunder: true })).score < scoreHikeDay(day()).score);
});

test('an out-of-season trail is never picked', () => {
  // Every verified trail gets a perfect day in each month of the year.
  for (let m = 1; m <= 12; m += 1) {
    const date = `2027-${String(m).padStart(2, '0')}-15`;
    const forecasts = Object.fromEntries(VERIFIED_TRAILS.map((t) => [t.id, { days: [day({ date, sunshineH: 9, precipProbPct: 0, cloudCoverPct: 0 })] }]));
    for (const grade of ['hiking', 'mountain', 'alpine']) {
      for (const length of Object.keys(LENGTHS)) {
        const { candidates: c, excluded } = candidates({ forecasts, choices: { grade, length, wants: [] }, from: date, to: date });
        for (const x of c) {
          const { from, to } = x.trail.seasonMonths;
          assert.ok(from <= to ? m >= from && m <= to : m >= from || m <= to, `${x.trail.id} offered in month ${m}`);
        }
        for (const e of excluded) if (!getTrail(e.trail_id).seasonMonths) assert.fail('unexpected');
      }
    }
  }
  const fourLakes = getTrail('engelberg-four-lakes');
  assert.equal(dayProblem(fourLakes, day({ date: '2026-11-14' })), 'out of season');
});

test('snow at the high point rules the trail out, and says why', () => {
  const t = getTrail('verzasca');
  assert.match(dayProblem(t, day({ date: '2026-08-15', snowLikely: true })), /^Snow likely at 923 m/);
});

test('a plan that would end after sunset is rejected', () => {
  const late = fitsDay({ arrives: '13:30', walkingTimeMin: 195, sunrise: '07:25', sunset: '16:55', lastTrainHome: '20:06' });
  assert.equal(late.fits, false);
  assert.match(late.reason, /after sunset/);
  const early = fitsDay({ arrives: '08:30', walkingTimeMin: 195, sunrise: '07:25', sunset: '16:55', lastTrainHome: '20:06' });
  assert.equal(early.fits, true);
  assert.equal(early.finish, '12:14'); // 08:30 + 195 min × 1.15
  assert.equal(early.spareMin, 472);
  const dark = fitsDay({ arrives: '06:40', walkingTimeMin: 60, sunrise: '07:25', sunset: '16:55', lastTrainHome: '20:06' });
  assert.equal(dark.startWalking, '07:25', 'you start walking at sunrise if the train arrives in the dark');
  const missed = fitsDay({ arrives: '09:00', walkingTimeMin: 300, sunrise: '06:00', sunset: '20:30', lastTrainHome: '14:00' });
  assert.match(missed.reason, /last good train home/);
});

test('the length chip filters correctly', () => {
  assert.equal(lengthMatches({ walkingTimeMin: 179 }, 'half'), true);
  assert.equal(lengthMatches({ walkingTimeMin: 180 }, 'half'), false);
  assert.equal(lengthMatches({ walkingTimeMin: 180 }, 'full'), true);
  assert.equal(lengthMatches({ walkingTimeMin: 360 }, 'full'), true);
  assert.equal(lengthMatches({ walkingTimeMin: 361 }, 'long'), true);
  const date = '2027-08-15';
  const forecasts = Object.fromEntries(VERIFIED_TRAILS.map((t) => [t.id, { days: [day({ date })] }]));
  for (const length of Object.keys(LENGTHS)) {
    const { candidates: c } = candidates({ forecasts, choices: { grade: 'hiking', length, wants: [] }, from: date, to: date });
    for (const x of c) assert.ok(LENGTHS[length].test(x.trail.walkingTimeMin), `${x.trail.id} offered for ${length}`);
  }
});

test('a trail with different start and end stations gets its trip home from the end station', async () => {
  const lavaux = getTrail('lavaux');
  assert.notEqual(lavaux.startStation.id, lavaux.endStation.id);
  const asked = [];
  const base = recordedFetch();
  const spy = async (url) => { asked.push(String(url)); return base(url); };
  const { json } = await fetchHikeForecast(VERIFIED_TRAILS, { fetchImpl: spy, now: NOW });
  const forecasts = summariseHikeForecast(json, VERIFIED_TRAILS, { today: fixture.today });
  const d = forecasts.lavaux.days.find((x) => x.date === WEEKEND.from);
  const trip = await evaluateTrip({ trail: lavaux, day: d, start: 'London', fetchImpl: spy, now: NOW });

  assert.equal(trip.outbound.to, lavaux.startStation.name);
  assert.ok(asked.some((u) => u.includes(`to=${lavaux.startStation.id}&`)), 'out to the start station');
  assert.equal(trip.homebound.from, lavaux.endStation.name);
  assert.ok(asked.some((u) => u.includes(`from=${lavaux.endStation.id}&`) && u.includes('isArrivalTime=1')), 'home from the end station');
  assert.equal(trip.homebound.to, trip.outbound.from, 'back to where you started');
});

test('the recorded weekend produces a plan whose numbers come from the data', async () => {
  const r = await planHikeDay({ choices: fixture.request, today: fixture.today, zurichHour: fixture.zurichHour, fetchImpl: recordedFetch(), now: NOW });
  if (r.nothingFits) {
    assert.ok(r.nothingFits.suggestions.some((s) => s.type === 'mode'));
    return;
  }
  const { pick } = r.recommendation;
  const t = getTrail(pick.trail_id);
  const trip = r.trips[t.id];
  assert.ok(trip.fit.fits);
  assert.ok(pick.reasons.some((x) => x.includes(`${t.distanceKm} km`)));
  assert.ok(pick.reasons.some((x) => x.includes(`last good train home leaves ${t.endStation.name} at ${trip.homebound.departs}`)));
  const kinds = r.timeline.map((x) => x.kind);
  for (const k of ['walk', 'high', 'finish']) assert.ok(kinds.includes(k), `timeline has ${k}`);
  assert.ok(r.recommendation.watch_outs.some((w) => /MeteoSwiss/.test(w)));
});
