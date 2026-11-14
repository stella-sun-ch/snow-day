import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContrast, ratio } from '../scripts/contrast.js';

test('the contrast calculation matches known values', () => {
  assert.equal(Math.round(ratio('#000000', '#FFFFFF') * 10) / 10, 21);
  assert.equal(Math.round(ratio('#777777', '#FFFFFF') * 100) / 100, 4.48);
});

test('every text/background pair in both themes meets WCAG AA', () => {
  const failing = checkContrast().filter((r) => !r.pass);
  assert.deepEqual(failing, [], failing.map((r) => `${r.mode}: --${r.fg} on --${r.bg} is ${r.ratio}`).join('; '));
});
