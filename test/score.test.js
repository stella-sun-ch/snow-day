import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDay, temperatureComfort, freshSnowCm } from '../lib/score.js';

const calmDay = {
  freshSnowCm: 0, snowfallCm: 0, depthCm: 120, sunshineH: 7,
  tempMaxC: -3, gustMaxKmh: 20, rainMm: 0, inSeason: true,
};

test('a powder day beats a bluebird day for powder skiers, and the reverse for sun seekers', () => {
  const powderDay = { ...calmDay, freshSnowCm: 35, sunshineH: 2 };
  assert.ok(scoreDay(powderDay, 'powder').score > scoreDay(calmDay, 'powder').score);
  assert.ok(scoreDay(calmDay, 'sunny').score > scoreDay(powderDay, 'sunny').score);
});

test('strong wind is penalised and flagged', () => {
  const windy = scoreDay({ ...calmDay, gustMaxKmh: 55 });
  const stormy = scoreDay({ ...calmDay, gustMaxKmh: 80 });
  assert.deepEqual(windy.flags, ['windy']);
  assert.deepEqual(stormy.flags, ['lift_closures_likely']);
  assert.ok(stormy.score < windy.score && windy.score < scoreDay(calmDay).score);
});

test('rain at mid-mountain is penalised', () => {
  const wet = scoreDay({ ...calmDay, rainMm: 6 });
  assert.ok(wet.flags.includes('rain'));
  assert.equal(scoreDay(calmDay).score - wet.score, 20);
});

test('days outside the typical season are capped at 10 and flagged', () => {
  const r = scoreDay({ ...calmDay, freshSnowCm: 40, inSeason: false }, 'powder');
  assert.equal(r.score, 10);
  assert.ok(r.flags.includes('outside_typical_season'));
});

test('a thin base is flagged', () => {
  assert.ok(scoreDay({ ...calmDay, depthCm: 20 }).flags.includes('thin_base'));
});

test('scores stay between 0 and 100', () => {
  const awful = scoreDay({ ...calmDay, sunshineH: 0, depthCm: 0, gustMaxKmh: 120, rainMm: 30, tempMaxC: 12 });
  const perfect = scoreDay({ ...calmDay, freshSnowCm: 80, depthCm: 300 }, 'powder');
  assert.equal(awful.score, 0);
  assert.equal(perfect.score, 100);
});

test('temperature comfort peaks between -8 and 2 °C', () => {
  assert.equal(temperatureComfort(-5), 1);
  assert.equal(temperatureComfort(-20), 0);
  assert.equal(temperatureComfort(10), 0);
  assert.equal(temperatureComfort(6), 0.5);
});

test('fresh snow weights the night before fully and its neighbours by half', () => {
  const snowfall = [10, 20, 4];
  assert.equal(freshSnowCm(snowfall, 2), 5 + 20 + 2);
  assert.equal(freshSnowCm(snowfall, 0), 5);
});
