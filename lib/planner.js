// Snow Day planner: use live forecasts and train connections, rank resorts,
// and generate explanations directly from the verified values.
// The form choices, not free-text instructions, determine the result.

import { RESORTS, getResort, publicResort } from './resorts.js';
import { fetchForecast, summariseForecast } from './weather.js';
import { getJourney } from './trains.js';
import { buildTimeline } from './timeline.js';

export const STARTS = ['London', 'Zurich', 'Geneva'];
export const WHENS = ['this weekend', 'next weekend', 'any day in the next week'];
export const LEVELS = ['blue', 'red', 'black'];
export const WANTS = ['powder', 'sunshine', 'big views', 'a short journey'];
export const DEFAULT_CHOICES = { from: 'London', when: 'this weekend', level: 'red', wants: ['powder'] };

/** Keep only choices the form can actually produce. */
export function cleanChoices(c = {}) {
  return {
    from: STARTS.includes(c.from) ? c.from : DEFAULT_CHOICES.from,
    when: WHENS.includes(c.when) ? c.when : DEFAULT_CHOICES.when,
    level: LEVELS.includes(c.level) ? c.level : DEFAULT_CHOICES.level,
    wants: Array.isArray(c.wants) ? [...new Set(c.wants.filter((w) => WANTS.includes(w)))] : [...DEFAULT_CHOICES.wants],
  };
}

/* ---------- dates ---------- */

export const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
const weekdayIndex = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sunday
export const fmtDay = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

/**
 * The days someone can ski, from the "When" choice. Today only counts before
 * 06:00 in Zurich, since the trains we look up leave at 07:00.
 */
export function skiDates(when, today, zurichHour = 12) {
  const earliest = zurichHour < 6 ? today : addDays(today, 1);
  const wd = weekdayIndex(today);
  const thisSat = wd === 0 ? addDays(today, -1) : addDays(today, 6 - wd);
  let from;
  let to;
  if (when === 'next weekend') {
    from = addDays(thisSat, 7);
    to = addDays(thisSat, 8);
  } else if (when === 'any day in the next week') {
    from = earliest;
    to = addDays(today, 7);
  } else {
    from = thisSat < earliest ? earliest : thisSat;
    to = addDays(thisSat, 1);
    if (from > to) { // this weekend is over: use the next one
      from = addDays(thisSat, 7);
      to = addDays(thisSat, 8);
    }
  }
  return { from, to };
}

export function styleFor(wants) {
  const powder = wants.includes('powder');
  const sun = wants.includes('sunshine');
  if (powder && !sun) return 'powder';
  if (sun && !powder) return 'sunny';
  return 'balanced';
}

/* ---------- the template write-up ---------- */

const cm = (x) => `${x} cm`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function whenPhrase(today, day) {
  const n = daysBetween(today, day);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `${plural(n, 'day')} away`;
}

/** How sure the forecast is, from how far ahead the day is. */
export function confidenceFor(today, day) {
  const n = daysBetween(today, day);
  const level = n <= 2 ? 'high' : n <= 5 ? 'medium' : 'low';
  const why = n <= 2
    ? 'Forecasts this close usually hold.'
    : n <= 5 ? 'Snow totals can still shift before then.' : 'Forecasts this far ahead often change.';
  return { confidence: level, confidence_reason: `${fmtDay(day, { weekday: 'long' })} is ${whenPhrase(today, day)}. ${why}` };
}

function verdict(alt, pick) {
  if (alt.journey.status !== 'ok') return `${alt.journey.message}.`;
  const a = alt.day;
  const p = pick.day;
  const reasons = [];
  if (p.freshSnowCm - a.freshSnowCm >= 5) reasons.push(`less fresh snow (${cm(a.freshSnowCm)} against ${cm(p.freshSnowCm)})`);
  if (a.flags.includes('lift_closures_likely') || a.flags.includes('windy')) reasons.push(`windier, with gusts up to ${a.gustMaxKmh} km/h`);
  if (p.sunshineH - a.sunshineH >= 2) reasons.push(`less sun (${a.sunshineH} h against ${p.sunshineH} h)`);
  if (a.depthCm != null && p.depthCm != null && p.depthCm - a.depthCm >= 10) reasons.push(`less snow on the ground (${cm(a.depthCm)} against ${cm(p.depthCm)})`);
  if (alt.journey.durationMin - pick.journey.durationMin >= 30) reasons.push(`a longer trip (${alt.journey.duration} against ${pick.journey.duration})`);
  if (a.flags.includes('outside_typical_season')) reasons.push('it’s usually closed at this time of year');
  if (a.score >= p.score) {
    return `Scores ${a.score} against ${p.score}, but the trip takes ${alt.journey.duration} against ${pick.journey.duration}.`;
  }
  return `Scores ${a.score} against ${p.score}${reasons.length ? `: ${reasons[0]}` : ''}.`;
}

export function templateRecommendation({ ranked, today, choices, elevationOf }) {
  const [pick, ...rest] = ranked;
  const d = pick.day;
  const r = pick.resort;
  const elev = elevationOf(r.id).toLocaleString('en-GB');
  const dayName = fmtDay(d.date, { weekday: 'long' });

  const lead = d.freshSnowCm >= 5 ? `${cm(d.freshSnowCm)} of fresh snow` : d.sunshineH >= 4 ? `${d.sunshineH} h of sunshine` : `a ski score of ${d.score}`;
  const reasons = [
    d.freshSnowCm > 0
      ? `${cm(d.freshSnowCm)} of fresh snow at ${elev} m${d.depthCm != null ? `, on ${cm(d.depthCm)} of snow already on the ground` : ''}`
      : `No fresh snow forecast at ${elev} m${d.depthCm != null ? `; ${cm(d.depthCm)} of snow on the ground` : ''}`,
    `${d.sunshineH} h of sunshine, with gusts up to ${d.gustMaxKmh} km/h`,
    `A ski score of ${d.score} out of 100, the highest of the resorts I could reach by train`,
  ];
  if (pick.journey.status === 'ok') reasons.push(`${pick.journey.duration} by train from ${pick.journey.from}`);
  if (choices.wants.includes('a short journey')) reasons[2] = `A ski score of ${d.score} out of 100; you asked for a short trip, so I took train time into account`;

  const watch = [`Lifts open when conditions allow, so check ${r.name}’s official site for opening status before you go.`];
  if (d.flags.includes('lift_closures_likely') || d.flags.includes('windy')) watch.push(`Gusts up to ${d.gustMaxKmh} km/h could close the higher lifts.`);
  if (d.flags.includes('rain')) watch.push(`${d.rainMm} mm of rain is forecast at ${elev} m.`);
  if (d.flags.includes('thin_base')) watch.push(`The base is thin (${cm(d.depthCm)}), so expect rocks off the groomed runs.`);
  if (d.flags.includes('outside_typical_season')) watch.push(`${r.name} is usually closed at this time of year (my season dates are approximate).`);
  if (choices.level === 'black') watch.push('If you go off-piste, read the SLF avalanche bulletin at slf.ch first.');

  return {
    headline: `${r.name} on ${dayName}: ${lead}.`,
    pick: { resort_id: r.id, day: d.date, reasons },
    alternatives: rest.slice(0, 3).map((x) => ({ resort_id: x.resort.id, day: x.day.date, verdict: verdict(x, pick) })),
    watch_outs: watch.slice(0, 4),
    ...confidenceFor(today, d.date),
  };
}

/* ---------- ski planning ---------- */

const bestDay = (summary, from, to) =>
  summary.days
    .filter((x) => x.date >= from && x.date <= to)
    .reduce((b, x) => (!b || x.score > b.score ? x : b), null);

/** Rank by score; with "a short journey", each hour on the train costs 10 points. Unreachable resorts go last. */
export function rank(options, { shortJourney = false } = {}) {
  const value = (o) => o.day.score - (shortJourney && o.journey.status === 'ok' ? o.journey.durationMin / 6 : 0);
  return [...options].sort((a, b) => {
    const okA = a.journey.status === 'ok';
    const okB = b.journey.status === 'ok';
    if (okA !== okB) return okA ? -1 : 1;
    return value(b) - value(a) || (a.journey.durationMin ?? 1e9) - (b.journey.durationMin ?? 1e9);
  });
}

/**
 * @param {object} o
 * @param {object} o.choices       from the form (see cleanChoices)
 * @param {string} o.today         YYYY-MM-DD in Europe/Zurich
 * @param {number} [o.zurichHour]  current hour in Zurich
 * @param {Function} [o.fetchImpl]
 * @param {(event: object) => void} [o.emit]
 */
export async function planSnowDay({ choices, today, zurichHour = 12, fetchImpl = fetch, now = Date.now, emit = () => {} }) {
  const c = cleanChoices(choices);
  const { from, to } = skiDates(c.when, today, zurichHour);
  const style = styleFor(c.wants);
  const ctx = { forecasts: {}, journeys: {}, start: c.from, forecastFetchedAt: null };

  emit({ type: 'status', text: 'Checking the mountain forecast' });
  emit({ type: 'step', id: 'forecast', status: 'running', label: `Checking forecasts for all ${RESORTS.length} resorts at ski height` });
  const { json, fetchedAt } = await fetchForecast(RESORTS, { fetchImpl, now });
  Object.assign(ctx.forecasts, summariseForecast(json, RESORTS, { today, style }));
  ctx.forecastFetchedAt = fetchedAt;

  const byScore = RESORTS
    .map((r) => ({ resort: r, day: bestDay(ctx.forecasts[r.id], from, to) }))
    .filter((x) => x.day)
    .sort((a, b) => b.day.score - a.day.score);
  if (!byScore.length) throw new Error('Those dates are outside the forecast. Try a nearer weekend.');
  const top = byScore[0];
  emit({
    type: 'step', id: 'forecast', status: 'done',
    label: `Checked forecasts for ${RESORTS.length} resorts. Highest score: ${top.resort.name} on ${fmtDay(top.day.date, { weekday: 'long' })} (${top.day.score}).`,
  });

  // Look up trains only for the strongest few, to keep requests to the timetable low.
  const shortJourney = c.wants.includes('a short journey');
  const candidates = byScore.slice(0, shortJourney ? 6 : 4);
  emit({ type: 'status', text: 'Looking up trains' });
  const options = await Promise.all(candidates.map(async (cand) => {
    const id = `train-${cand.resort.id}`;
    emit({ type: 'step', id, status: 'running', label: `Looking up trains to ${cand.resort.name}` });
    const journey = await getJourney({ resort: cand.resort, start: c.from, date: cand.day.date, fetchImpl, now });
    ctx.journeys[cand.resort.id] = journey;
    emit({
      type: 'step', id, status: journey.status === 'ok' ? 'done' : 'failed',
      label: journey.status === 'ok'
        ? `${cand.resort.name}: ${journey.duration} by train from ${journey.from}`
        : `${cand.resort.name}: ${journey.message}`,
    });
    return { ...cand, journey };
  }));

  const ranked = rank(options, { shortJourney });
  const rec = templateRecommendation({
    ranked, today, choices: c, elevationOf: (id) => ctx.forecasts[id].elevationM,
  });
  emit({ type: 'step', id: 'plan', status: 'done', label: 'Wrote your plan from a template' });
  return finaliseResult(rec, ctx, { today, fetchImpl, now });
}

/* ---------- shared finishing ---------- */

/**
 * Make sure the browser has a forecast and a journey for every resort it will
 * show, put unreachable alternatives last, and build the door-to-door plan.
 */
export async function finaliseResult(rec, ctx, { today, fetchImpl = fetch, now = Date.now }) {
  const shown = [
    { id: rec.pick.resort_id, day: rec.pick.day },
    ...rec.alternatives.map((a) => ({ id: a.resort_id, day: a.day ?? rec.pick.day })),
  ];
  const missing = shown.map((s) => s.id).filter((id) => !ctx.forecasts[id]);
  if (missing.length) {
    const resorts = missing.map(getResort);
    const { json, fetchedAt } = await fetchForecast(resorts, { fetchImpl, now });
    Object.assign(ctx.forecasts, summariseForecast(json, resorts, { today }));
    ctx.forecastFetchedAt ??= fetchedAt;
  }
  await Promise.all(shown.map(async ({ id, day }) => {
    if (ctx.journeys[id]?.date === day) return; // already looked up for this day
    ctx.journeys[id] = await getJourney({ resort: getResort(id), start: ctx.start, date: day, fetchImpl, now });
  }));

  const reachable = (a) => ctx.journeys[a.resort_id]?.status === 'ok';
  const alternatives = [...rec.alternatives.filter(reachable), ...rec.alternatives.filter((a) => !reachable(a))];
  const journeys = Object.fromEntries(shown.map(({ id }) => [id, ctx.journeys[id]]));
  const checked = Object.values(journeys).map((j) => j?.checkedAt).filter(Boolean);
  const involved = [...new Set([...shown.map((s) => s.id), ...Object.keys(ctx.forecasts)])].map(getResort).filter(Boolean);

  return {
    recommendation: { ...rec, alternatives },
    timeline: buildTimeline(ctx.journeys[rec.pick.resort_id], rec.pick.day),
    forecasts: ctx.forecasts,
    journeys,
    resorts: Object.fromEntries(involved.map((r) => [r.id, publicResort(r)])),
    freshness: {
      forecastFetchedAt: ctx.forecastFetchedAt ? new Date(ctx.forecastFetchedAt).toISOString() : null,
      trainsCheckedAt: checked.length ? new Date(Math.max(...checked)).toISOString() : null,
    },
  };
}
