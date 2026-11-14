// Hike Day planning: selection, the write-up template and the
// finishing step both ways of planning share.
//
// Same shape as the ski planner: live forecasts and live trains, a
// deterministic score, and hard rules that filter rather than adjust. A trail
// is only suggested on a day when it's in season, snow is unlikely at its high
// point, and the real train out, the official walking time plus 15%, and the
// last good train home from the end station all fit between sunrise and sunset.

import { VERIFIED_TRAILS, getTrail, publicTrail } from './trails.js';
import { fetchHikeForecast, summariseHikeForecast } from './hikeWeather.js';
import { scoreHikeDay, lengthMatches, gradeMatches, dayProblem, fitsDay, LENGTHS, BUFFER } from './hikeScore.js';
import { getJourney, getReturnJourney, originsFor, formatDuration, RETURN_BY } from './trains.js';
import { labelTimeline, modeOf } from './timeline.js';
import { STARTS, WHENS, skiDates, fmtDay, confidenceFor, addDays } from './planner.js';

export const GRADES = ['hiking', 'mountain', 'alpine'];
export const HIKE_WANTS = ['views', 'lakes', 'sunshine', 'a short journey'];
export const DEFAULT_HIKE_CHOICES = { from: 'London', when: 'this weekend', grade: 'hiking', length: 'full', wants: ['views'] };
export const METEOSWISS_URL = 'https://www.meteoswiss.admin.ch/weather/hazards.html';

export function cleanHikeChoices(c = {}) {
  return {
    from: STARTS.includes(c.from) ? c.from : DEFAULT_HIKE_CHOICES.from,
    when: WHENS.includes(c.when) ? c.when : DEFAULT_HIKE_CHOICES.when,
    grade: GRADES.includes(c.grade) ? c.grade : DEFAULT_HIKE_CHOICES.grade,
    length: LENGTHS[c.length] ? c.length : DEFAULT_HIKE_CHOICES.length,
    wants: Array.isArray(c.wants) ? [...new Set(c.wants.filter((w) => HIKE_WANTS.includes(w)))] : [...DEFAULT_HIKE_CHOICES.wants],
  };
}

const MARKING_NAMES = { yellow: 'hiking trail (yellow)', 'white-red-white': 'mountain trail (white-red-white)', 'white-blue-white': 'alpine route (white-blue-white)' };
export const gradeLabel = (t) => (t.grade.marking ? `${MARKING_NAMES[t.grade.marking]}${t.grade.sac ? `, ${t.grade.sac}` : ''}` : `rated "${t.grade.sourceRating}" by the source`);

/** Score a day, with a small, stated bonus for lake trails when you asked for lakes. */
export function hikeDayScore(trail, day, wants) {
  const s = scoreHikeDay(day, { wants });
  const lakeBonus = wants.includes('lakes') && trail.tags.includes('lake') ? 8 : 0;
  return { ...s, score: Math.min(100, s.score + lakeBonus) };
}

/**
 * Look up the trip for a trail on a day: the real train out to the start
 * station, the last good train home from the end station, and whether the
 * walk fits between them and the daylight.
 */
export async function evaluateTrip({ trail, day, start, fetchImpl = fetch, now = Date.now }) {
  const outbound = await getJourney({ resort: { id: trail.id, station: trail.startStation }, start, date: day.date, fetchImpl, now });
  const origin = outbound.origin ?? originsFor(start)[0];
  const homebound = await getReturnJourney({ from: trail.endStation, to: origin, date: day.date, fetchImpl, now });
  let fit;
  if (outbound.status !== 'ok') fit = { fits: false, reason: outbound.message };
  else if (outbound.arrivesDate !== day.date) fit = { fits: false, reason: 'The first train out arrives on a different day' };
  else {
    fit = fitsDay({
      arrives: outbound.arrives,
      walkingTimeMin: trail.walkingTimeMin,
      sunrise: day.sunrise,
      sunset: day.sunset,
      lastTrainHome: homebound.status === 'ok' ? homebound.departs : null,
    });
  }
  return { trail_id: trail.id, date: day.date, outbound, homebound, fit };
}

/* ---------- the template write-up ---------- */

const h = (min) => formatDuration(min);

function verdict(alt, pick) {
  const a = alt.day;
  const p = pick.day;
  const reasons = [];
  if ((a.precipProbPct ?? 0) - (p.precipProbPct ?? 0) >= 15) reasons.push(`a higher chance of rain (${a.precipProbPct}% against ${p.precipProbPct}%)`);
  if (p.sunshineH - a.sunshineH >= 1.5) reasons.push(`less sun (${a.sunshineH} h against ${p.sunshineH} h)`);
  if (a.flags.includes('windy') || a.flags.includes('storm_gusts')) reasons.push(`gusts up to ${a.gustMaxKmh} km/h`);
  if (alt.trip.fit.spareMin < 30) reasons.push(`only ${alt.trip.fit.spareMin} min spare before the last good train home`);
  if (alt.trip.outbound.durationMin - pick.trip.outbound.durationMin >= 45) reasons.push(`a longer train out (${alt.trip.outbound.duration} against ${pick.trip.outbound.duration})`);
  if (a.score >= p.score) return `Scores ${a.score} against ${p.score}, but ${reasons[0] ?? 'the trip there is longer'}.`;
  return `Scores ${a.score} against ${p.score}${reasons.length ? `: ${reasons[0]}` : ''}.`;
}

export function hikeTemplate({ ranked, today, choices, elevationOf }) {
  const [pick, ...rest] = ranked;
  const { trail: t, day: d, trip } = pick;
  const elev = elevationOf(t.id).toLocaleString('en-GB');
  const dayName = fmtDay(d.date, { weekday: 'long' });
  const lead = d.precipProbPct != null && d.precipProbPct <= 20 ? `${d.sunshineH} h of sun and a ${d.precipProbPct}% chance of rain`
    : `${d.sunshineH} h of sun`;
  const reasons = [
    `${lead} at ${elev} m`,
    `A high of ${d.tempMaxC} °C and gusts up to ${d.gustMaxKmh} km/h up there`,
    `${t.distanceKm} km, ${h(t.walkingTimeMin)} of walking (official time), ${gradeLabel(t)}`,
    `${trip.outbound.duration} by train from ${trip.outbound.from}; the last good train home leaves ${trip.homebound.from} at ${trip.homebound.departs}, so you have ${trip.fit.spareMin} min spare`,
  ];
  if (choices.wants.includes('a short journey')) reasons[0] += '. You asked for a short trip, so I took train time into account';

  const watch = [];
  if (t.lift) watch.push(`This walk relies on lifts (${t.lift.name}). Check they're running before you go.`);
  if (d.flags.includes('thunderstorms')) watch.push('Thunderstorms are forecast. Check MeteoSwiss warnings on the morning and be off exposed ground early.');
  else watch.push('Check MeteoSwiss for thunderstorm warnings on the morning.');
  if (d.flags.includes('freezing')) watch.push(`It may stay below freezing at ${elev} m: paths can be icy.`);
  if (d.flags.includes('hot')) watch.push(`It's warm up there (${d.tempMaxC} °C): take plenty of water.`);
  watch.push(`Sunset is at ${d.sunset}. The plan has you finishing around ${trip.fit.finish}.`);

  return {
    headline: `${t.name} on ${dayName}: ${lead}.`,
    pick: { trail_id: t.id, day: d.date, reasons },
    alternatives: rest.slice(0, 3).map((x) => ({ trail_id: x.trail.id, day: x.day.date, verdict: verdict(x, pick) })),
    watch_outs: watch.slice(0, 4),
    ...confidenceFor(today, d.date),
  };
}

/* ---------- hiking planning ---------- */

/** Rank by score; with "a short journey", each hour on the train out costs 10 points. */
export function rankHikes(options, { shortJourney = false } = {}) {
  const value = (o) => o.day.score - (shortJourney ? o.trip.outbound.durationMin / 6 : 0);
  return [...options].sort((a, b) => value(b) - value(a) || a.trip.outbound.durationMin - b.trip.outbound.durationMin);
}

/**
 * The trail/day pairs worth looking up trains for: matching grade and length,
 * in season, no snow at the high point, best-scoring day per trail. Also
 * returns why each other trail was left out.
 */
export function candidates({ forecasts, choices, from, to }) {
  const excluded = [];
  const out = [];
  for (const t of VERIFIED_TRAILS) {
    if (!gradeMatches(t, choices.grade)) continue;       // not what you asked for: no need to explain
    if (!lengthMatches(t, choices.length)) continue;
    const days = forecasts[t.id].days.filter((d) => d.date >= from && d.date <= to);
    const ok = [];
    const problems = new Set();
    for (const d of days) {
      const problem = dayProblem(t, d);
      if (problem) problems.add(problem);
      else ok.push({ ...d, ...hikeDayScore(t, d, choices.wants) });
    }
    if (!ok.length) {
      excluded.push({ trail_id: t.id, name: t.name, reason: [...problems][0] ?? 'no forecast for those days' });
      continue;
    }
    const best = ok.reduce((b, d) => (d.score > b.score ? d : b));
    out.push({ trail: t, day: best, okDays: ok });
  }
  return { candidates: out.sort((a, b) => b.day.score - a.day.score), excluded };
}

/** When nothing fits: the lowest in-season, snow-free trail of any grade or length, and Snow day. */
function suggestions({ forecasts, from, to }) {
  const options = VERIFIED_TRAILS
    .map((t) => ({ t, day: forecasts[t.id].days.find((d) => d.date >= from && d.date <= to && !dayProblem(t, d)) }))
    .filter((x) => x.day)
    .sort((a, b) => a.t.highPoint.elevationM - b.t.highPoint.elevationM);
  const out = [];
  if (options.length) {
    const { t, day } = options[0];
    out.push({ type: 'trail', trail_id: t.id, text: `${t.name} (${LENGTHS[Object.keys(LENGTHS).find((k) => LENGTHS[k].test(t.walkingTimeMin))].label.toLowerCase()}, ${gradeLabel(t)}) is in season and snow-free at its high point on ${fmtDay(day.date, { weekday: 'long' })}. Try those choices.` });
  }
  out.push({ type: 'mode', mode: 'snow', text: 'Or switch to Snow day: it\'s ski season.' });
  return out;
}

export async function planHikeDay({ choices, today, zurichHour = 12, fetchImpl = fetch, now = Date.now, emit = () => {} }) {
  const c = cleanHikeChoices(choices);
  const { from, to } = skiDates(c.when, today, zurichHour);
  const ctx = newHikeContext(c.from);

  emit({ type: 'status', text: 'Checking the weather on the trails' });
  emit({ type: 'step', id: 'forecast', status: 'running', label: `Checking forecasts for ${VERIFIED_TRAILS.length} trails at their high points` });
  const { json, fetchedAt } = await fetchHikeForecast(VERIFIED_TRAILS, { fetchImpl, now });
  Object.assign(ctx.forecasts, summariseHikeForecast(json, VERIFIED_TRAILS, { today }));
  ctx.forecastFetchedAt = fetchedAt;
  emit({ type: 'step', id: 'forecast', status: 'done', label: `Checked forecasts for ${VERIFIED_TRAILS.length} trails.` });

  const { candidates: cands, excluded } = candidates({ forecasts: ctx.forecasts, choices: c, from, to });
  ctx.excluded.push(...excluded);

  emit({ type: 'status', text: 'Looking up trains out and back' });
  const shortJourney = c.wants.includes('a short journey');
  const checked = await Promise.all(cands.slice(0, shortJourney ? 6 : 4).map(async (cand) => {
    const id = `trip-${cand.trail.id}`;
    emit({ type: 'step', id, status: 'running', label: `Looking up trains to ${cand.trail.startStation.name} and back from ${cand.trail.endStation.name}` });
    // Try the best day first; if it doesn't fit, try the trail's other good days.
    for (const d of [cand.day, ...cand.okDays.filter((x) => x.date !== cand.day.date).sort((a, b) => b.score - a.score)]) {
      const trip = await evaluateTrip({ trail: cand.trail, day: d, start: c.from, fetchImpl, now });
      ctx.trips[`${cand.trail.id}|${d.date}`] = trip;
      if (trip.fit.fits) {
        emit({ type: 'step', id, status: 'done', label: `${cand.trail.name}: fits on ${fmtDay(d.date, { weekday: 'long' })}, ${trip.fit.spareMin} min spare` });
        return { ...cand, day: d, trip };
      }
      cand.lastReason = trip.fit.reason;
    }
    emit({ type: 'step', id, status: 'failed', label: `${cand.trail.name}: ${cand.lastReason}` });
    ctx.excluded.push({ trail_id: cand.trail.id, name: cand.trail.name, reason: cand.lastReason });
    return null;
  }));

  const ranked = rankHikes(checked.filter(Boolean), { shortJourney });
  if (!ranked.length) {
    emit({ type: 'step', id: 'plan', status: 'done', label: 'Nothing fits those choices' });
    return {
      kind: 'hike',
      nothingFits: {
        message: cands.length
          ? 'None of the matching trails fits into the daylight and the timetable on those days.'
          : 'None of the matching trails is walkable on those days.',
        suggestions: suggestions({ forecasts: ctx.forecasts, from, to }),
      },
      excluded: ctx.excluded,
      trails: Object.fromEntries(VERIFIED_TRAILS.map((t) => [t.id, publicTrail(t)])),
      freshness: { forecastFetchedAt: new Date(ctx.forecastFetchedAt).toISOString(), trainsCheckedAt: null },
    };
  }
  const rec = hikeTemplate({ ranked, today, choices: c, elevationOf: (id) => ctx.forecasts[id].elevationM });
  emit({ type: 'step', id: 'plan', status: 'done', label: 'Wrote your plan from a template' });
  return finaliseHikeResult(rec, ctx, { today, fetchImpl, now });
}

/* ---------- shared finishing ---------- */

export const newHikeContext = (start) => ({ forecasts: {}, trips: {}, excluded: [], start, forecastFetchedAt: null });

/** The door-to-door plan: train out, walk, high point, finish, train home. */
export function buildHikeTimeline(trip, trail, day) {
  const rows = [];
  const { outbound: out, homebound: home, fit } = trip;
  if (out.flying) {
    rows.push({
      date: addDays(out.date, -1), time: null, period: 'evening', kind: 'flight', mode: 'flight',
      title: `Fly London → ${out.airport} the evening before`,
      detail: 'Book this separately. Hike Day doesn’t look up flights, so it shows no flight times.',
    });
  }
  for (const leg of out.legs) {
    rows.push({ date: leg.departsDate, time: leg.departs, kind: 'leg', mode: modeOf(leg.line), title: `${leg.line} to ${leg.to}`, detail: `From ${leg.from}${leg.towards ? `, towards ${leg.towards}` : ''}. Arrives ${leg.arrives}.` });
  }
  rows.push({
    date: day.date, time: fit.startWalking, kind: 'walk', mode: 'walk',
    title: `Start walking from ${trail.startStation.name}`,
    detail: fit.startWalking !== out.arrives ? `The train arrives at ${out.arrives}; sunrise is ${day.sunrise}.` : `${trail.distanceKm} km to ${trail.endStation.name}, official walking time ${formatDuration(trail.walkingTimeMin)}.`,
  });
  rows.push({
    date: day.date, time: null, period: 'on the way', kind: 'high', mode: 'peak',
    title: `High point, ${trail.highPoint.elevationM.toLocaleString('en-GB')} m`,
    detail: `${trail.ascentM} m up and ${trail.descentM} m down in all.`,
  });
  rows.push({
    date: day.date, time: `~${fit.finish}`, kind: 'finish', mode: 'arrive',
    title: `Finish at ${trail.endStation.name}`,
    detail: `An estimate: the official ${formatDuration(trail.walkingTimeMin)} plus a ${Math.round(BUFFER * 100)}% buffer. Sunset is at ${day.sunset}.`,
  });
  for (const leg of home.legs ?? []) {
    rows.push({ date: leg.departsDate, time: leg.departs, kind: 'leg', mode: modeOf(leg.line), title: `${leg.line} to ${leg.to}`, detail: `From ${leg.from}${leg.towards ? `, towards ${leg.towards}` : ''}. Arrives ${leg.arrives}.` });
  }
  if (home.status === 'ok') {
    rows.push({ date: home.arrivesDate, time: home.arrives, kind: 'arrive', mode: 'arrive', title: `Back at ${home.to}`, detail: `The last good train home: it leaves at ${home.departs}, ${fit.spareMin} min after your estimated finish.` });
  }
  return labelTimeline(rows);
}

/**
 * Make sure the browser has a forecast and a trip for every trail it will
 * show, drop alternatives that don't fit, and build the plan.
 */
export async function finaliseHikeResult(rec, ctx, { today, fetchImpl = fetch, now = Date.now }) {
  if (!Object.keys(ctx.forecasts).length) {
    const { json, fetchedAt } = await fetchHikeForecast(VERIFIED_TRAILS, { fetchImpl, now });
    Object.assign(ctx.forecasts, summariseHikeForecast(json, VERIFIED_TRAILS, { today }));
    ctx.forecastFetchedAt = fetchedAt;
  }
  const shown = [{ id: rec.pick.trail_id, date: rec.pick.day }, ...rec.alternatives.map((a) => ({ id: a.trail_id, date: a.day ?? rec.pick.day }))];
  await Promise.all(shown.map(async ({ id, date }) => {
    const key = `${id}|${date}`;
    if (ctx.trips[key]) return;
    const day = ctx.forecasts[id].days.find((d) => d.date === date);
    ctx.trips[key] = await evaluateTrip({ trail: getTrail(id), day, start: ctx.start, fetchImpl, now });
  }));
  const fits = (a) => ctx.trips[`${a.trail_id}|${a.day}`]?.fit.fits;
  const alternatives = rec.alternatives.filter(fits);
  const trips = Object.fromEntries(shown.map(({ id, date }) => [id, ctx.trips[`${id}|${date}`]]));
  const pickTrail = getTrail(rec.pick.trail_id);
  const pickDay = ctx.forecasts[pickTrail.id].days.find((d) => d.date === rec.pick.day);
  const checked = Object.values(trips).flatMap((t) => [t?.outbound?.checkedAt, t?.homebound?.checkedAt]).filter(Boolean);

  return {
    kind: 'hike',
    recommendation: { ...rec, alternatives },
    timeline: buildHikeTimeline(trips[pickTrail.id], pickTrail, pickDay),
    forecasts: ctx.forecasts,
    trips,
    excluded: ctx.excluded,
    links: { meteoSwiss: METEOSWISS_URL, returnBy: RETURN_BY },
    trails: Object.fromEntries(VERIFIED_TRAILS.map((t) => [t.id, publicTrail(t)])),
    freshness: {
      forecastFetchedAt: ctx.forecastFetchedAt ? new Date(ctx.forecastFetchedAt).toISOString() : null,
      trainsCheckedAt: checked.length ? new Date(Math.max(...checked)).toISOString() : null,
    },
  };
}
