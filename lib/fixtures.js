// Recorded API responses: real Open-Meteo and timetable answers saved by
// `npm run fixtures:record`, replayed by URL. One file per mode. The tests use
// them to mock HTTP, and the app offers a clearly labelled "recorded run" when
// the live APIs can't be reached.

import { readFile } from 'node:fs/promises';

export const FIXTURE_URLS = {
  snow: new URL('../fixtures/recorded.json', import.meta.url),
  hike: new URL('../fixtures/recorded-hike.json', import.meta.url),
};
export const FIXTURE_URL = FIXTURE_URLS.snow;

const loaded = new Map();

/** The recording: { recordedAt, today, zurichHour, request, responses: { url: json } }. */
export async function loadFixture(modeOrUrl = 'snow') {
  const url = modeOrUrl instanceof URL ? modeOrUrl : FIXTURE_URLS[modeOrUrl];
  if (!url) throw new Error(`No fixture for mode "${modeOrUrl}"`);
  const key = String(url);
  if (!loaded.has(key)) loaded.set(key, JSON.parse(await readFile(url, 'utf8')));
  return loaded.get(key);
}

/**
 * A fetch() that answers from the recording. Unknown URLs get a 404, as a
 * real outage would; pass { strict: true } to throw instead (useful in tests).
 */
export function fixtureFetch(fixture, { strict = false, override } = {}) {
  return async (url) => {
    const key = String(url);
    const custom = override?.(key);
    const body = custom !== undefined ? custom : fixture.responses[key];
    if (body === undefined) {
      if (strict) throw new Error(`No recorded response for ${key}`);
      return new Response('not recorded', { status: 404 });
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
