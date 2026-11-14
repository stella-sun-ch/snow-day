// GET  /api/plan -> dates of available recorded examples
// POST /api/plan {mode: 'snow'|'hike', choices: {...}, recorded?: boolean}
// The live planner uses weather and timetable APIs; recordings are offered
// only when explicitly selected. Both paths stream progress as NDJSON.

import { todayInZurich, zurichHour } from '../lib/time.js';
import { MODES, MODE_IDS, cleanMode } from '../lib/modes.js';
import '../lib/hike.js'; // register the hiking mode
import { loadFixture, fixtureFetch } from '../lib/fixtures.js';
import { allow } from '../lib/ratelimit.js';

function friendly(err) {
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'A data source took too long to answer.';
  if (err instanceof TypeError) return 'I couldn’t reach the forecast or timetable services.';
  return err.message || 'Something went wrong while planning.';
}

async function recordingInfo(mode) {
  try {
    const f = await loadFixture(mode);
    return { date: f.recordedAt, request: f.request };
  } catch { return null; }
}

async function allRecordings() {
  const entries = await Promise.all(MODE_IDS.map(async (m) => [m, await recordingInfo(m)]));
  return Object.fromEntries(entries);
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ recorded: await allRecordings() });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed', message: 'Use GET or POST.' });
  }

  const activity = cleanMode(req.body?.mode);
  const impl = MODES[activity];
  if (!impl) return res.status(501).json({ error: 'mode_unavailable', message: 'This activity isn’t available yet.' });
  const recorded = req.body?.recorded === true;
  const choices = impl.cleanChoices(req.body?.choices);

  const ip = String(req.headers['x-forwarded-for'] ?? req.socket?.remoteAddress ?? 'unknown').split(',')[0].trim();
  if (!allow(ip)) {
    return res.status(429).json({ error: 'rate_limited', message: 'That is a lot of planning. Try again in an hour.' });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Accel-Buffering', 'no');
  const emit = (event) => res.write(`${JSON.stringify(event)}
`);
  const generatedAt = new Date().toISOString();

  try {
    if (recorded) {
      const fixture = await loadFixture(activity);
      const result = await impl.plan({
        choices: fixture.request,
        today: fixture.today,
        zurichHour: fixture.zurichHour,
        fetchImpl: fixtureFetch(fixture),
        now: () => Date.parse(fixture.recordedAt),
        emit,
      });
      emit({ type: 'result', ...result,
        meta: { mode: 'recorded', activity, recordedAt: fixture.recordedAt,
          request: fixture.request, today: fixture.today, generatedAt } });
    } else {
      const now = new Date();
      const today = todayInZurich(now);
      const result = await impl.plan({ choices, today, zurichHour: zurichHour(now), emit });
      emit({ type: 'result', ...result,
        meta: { mode: 'live', activity, today, generatedAt } });
    }
  } catch (err) {
    console.error('[plan]', err);
    emit({ type: 'error', message: friendly(err),
      canUseRecording: !recorded && Boolean(await recordingInfo(activity)) });
  }
  res.end();
}
