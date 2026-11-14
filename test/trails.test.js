import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRAILS, VERIFIED_TRAILS, inTrailSeason, gradeOf, getTrail } from '../lib/trails.js';

const MARKINGS = ['yellow', 'white-red-white', 'white-blue-white'];

test('every verified trail has the fields the planner relies on', () => {
  assert.ok(VERIFIED_TRAILS.length >= 1);
  const ids = new Set();
  for (const t of TRAILS) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.equal(new URL(t.sourceUrl).protocol, 'https:', `${t.id} needs a sourceUrl`);
  }
  for (const t of VERIFIED_TRAILS) {
    for (const k of ['name', 'region', 'distanceKm', 'walkingTimeMin', 'ascentM', 'descentM', 'seasonMonths', 'grade', 'highPoint', 'startStation', 'endStation']) {
      assert.ok(t[k] != null, `${t.id}.${k} is required`);
    }
    for (const st of [t.startStation, t.endStation]) {
      assert.match(st.id, /^\d{7}$/, `${t.id}: station ids are timetable ids`);
      assert.ok(['dem', 'source'].includes(st.elevationSource));
    }
    assert.ok(MARKINGS.includes(gradeOf(t) === 'hiking' ? 'yellow' : gradeOf(t) === 'mountain' ? 'white-red-white' : 'white-blue-white'));
    if (t.grade.marking) assert.ok(MARKINGS.includes(t.grade.marking));
    if (t.grade.sac) assert.match(t.grade.sac, /^T[1-6]$/);
    assert.ok(t.grade.marking || t.grade.sourceRating, `${t.id} needs a marking or the source's own rating`);
    for (const s of t.sources) assert.equal(new URL(s.url).protocol, 'https:');
    if (t.lift) assert.ok(t.lift.statusUrls.length && t.lift.statusUrls.every((u) => new URL(u)), `${t.id}: lift needs a status link`);
  }
});

test('trail numbers are in plausible ranges', () => {
  for (const t of VERIFIED_TRAILS) {
    assert.ok(t.distanceKm >= 1 && t.distanceKm <= 40, `${t.id} distance ${t.distanceKm} km`);
    assert.ok(t.walkingTimeMin >= 30 && t.walkingTimeMin <= 720, `${t.id} time ${t.walkingTimeMin} min`);
    assert.ok(t.ascentM >= 0 && t.ascentM < 3000 && t.descentM >= 0 && t.descentM < 3000);
    assert.ok(t.seasonMonths.from >= 1 && t.seasonMonths.from <= 12 && t.seasonMonths.to >= 1 && t.seasonMonths.to <= 12);
  }
});

test('the end (and start) are never higher than the high point', () => {
  for (const t of VERIFIED_TRAILS) {
    assert.ok(t.endStation.elevationM <= t.highPoint.elevationM, `${t.id}: end ${t.endStation.elevationM} > high ${t.highPoint.elevationM}`);
    assert.ok(t.startStation.elevationM <= t.highPoint.elevationM, `${t.id}: start above high point`);
  }
});

test('unverified trails carry no figures and are never returned', () => {
  for (const t of TRAILS.filter((x) => !x.verified)) {
    assert.ok(t.unverifiedReason, `${t.id} needs a reason`);
    assert.equal(t.distanceKm, null);
    assert.equal(t.walkingTimeMin, null);
    assert.equal(getTrail(t.id), null);
  }
});

test('trail seasons handle month ranges, including ones over New Year', () => {
  const t = { seasonMonths: { from: 7, to: 10 } };
  assert.equal(inTrailSeason(t, '2026-11-14'), false);
  assert.equal(inTrailSeason(t, '2026-07-01'), true);
  assert.equal(inTrailSeason({ seasonMonths: { from: 11, to: 3 } }, '2027-01-10'), true);
  assert.equal(inTrailSeason({ seasonMonths: null }, '2027-01-10'), false);
});
