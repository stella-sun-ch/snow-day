// Test helpers. All weather and timetable data comes from fixtures/recorded.json,
// which holds real API responses (see scripts/record-fixtures.js).

import { loadFixture, fixtureFetch } from '../lib/fixtures.js';
import { skiDates } from '../lib/planner.js';

export const fixture = await loadFixture();
export const TODAY = fixture.today;
export const NOW = () => Date.parse(fixture.recordedAt);
export const WEEKEND = skiDates('this weekend', fixture.today, fixture.zurichHour);

/** A fetch() that replays the recording and throws on anything unrecorded. */
export const recordedFetch = (opts = {}) => fixtureFetch(fixture, { strict: true, ...opts });

/** Every recorded timetable response, with its URL. */
export const timetableResponses = () =>
  Object.entries(fixture.responses).filter(([url]) => url.startsWith('https://transport.opendata.ch/'));

/** The single recorded forecast response (an array of location blocks). */
export const forecastResponse = () =>
  Object.entries(fixture.responses).find(([url]) => url.startsWith('https://api.open-meteo.com/'));
