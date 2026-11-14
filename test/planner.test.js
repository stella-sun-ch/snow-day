import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSnowDay, skiDates, styleFor, cleanChoices, rank } from '../lib/planner.js';
import { recordedFetch, fixture, TODAY, NOW, WEEKEND } from './helpers.js';

const plan = (choices = fixture.request, fetchImpl = recordedFetch()) =>
  planSnowDay({ choices, today: TODAY, zurichHour: fixture.zurichHour, fetchImpl, now: NOW });

test('with the local planner, the plan uses live-shaped data and the template quotes the same numbers', async () => {
  const r = await plan();
  const { pick } = r.recommendation;
  const day = r.forecasts[pick.resort_id].days.find((d) => d.date === pick.day);
  const j = r.journeys[pick.resort_id];

  assert.ok(pick.day >= WEEKEND.from && pick.day <= WEEKEND.to);
  assert.ok(pick.reasons.some((x) => x.includes(`${day.freshSnowCm} cm`)));
  assert.ok(pick.reasons.some((x) => x.includes(`${day.sunshineH} h of sunshine`)));
  assert.ok(pick.reasons.some((x) => x.includes(`A ski score of ${day.score}`)));
  assert.ok(pick.reasons.includes(`${j.duration} by train from ${j.from}`));
  assert.ok(r.recommendation.watch_outs[0].includes('official site for opening status'));
  assert.ok(r.freshness.forecastFetchedAt && r.freshness.trainsCheckedAt);
});

test('no copy claims a resort is open', async () => {
  const r = await plan();
  const all = JSON.stringify(r.recommendation);
  assert.doesNotMatch(all, /should be open|will be open|is open|are open/i);
});

test('"this weekend" is the coming Saturday and Sunday; today only counts before 06:00', () => {
  assert.deepEqual(skiDates('this weekend', '2026-11-12', 10), { from: '2026-11-14', to: '2026-11-15' });
  assert.deepEqual(skiDates('next weekend', '2026-11-12', 10), { from: '2026-11-21', to: '2026-11-22' });
  assert.deepEqual(skiDates('this weekend', '2026-11-14', 5), { from: '2026-11-14', to: '2026-11-15' });
  assert.deepEqual(skiDates('this weekend', '2026-11-14', 9), { from: '2026-11-15', to: '2026-11-15' });
  assert.deepEqual(skiDates('this weekend', '2026-11-15', 9), { from: '2026-11-21', to: '2026-11-22' });
  assert.deepEqual(skiDates('any day in the next week', '2026-11-12', 10), { from: '2026-11-13', to: '2026-11-19' });
});

test('choices are cleaned and mapped to a scoring style', () => {
  assert.deepEqual(cleanChoices({ from: 'Paris', wants: ['powder', 'caviar'] }).from, 'London');
  assert.deepEqual(cleanChoices({ wants: ['powder', 'caviar'] }).wants, ['powder']);
  assert.equal(styleFor(['powder']), 'powder');
  assert.equal(styleFor(['sunshine']), 'sunny');
  assert.equal(styleFor(['powder', 'sunshine']), 'balanced');
});

test('ranking puts unreachable resorts last; a short-journey request weighs train time', () => {
  const opt = (id, score, status, durationMin) => ({ resort: { id }, day: { score }, journey: { status, durationMin } });
  const options = [opt('a', 90, 'none'), opt('b', 60, 'ok', 240), opt('c', 55, 'ok', 100)];
  assert.deepEqual(rank(options).map((o) => o.resort.id), ['b', 'c', 'a']);
  assert.deepEqual(rank(options, { shortJourney: true }).map((o) => o.resort.id), ['c', 'b', 'a']);
});
