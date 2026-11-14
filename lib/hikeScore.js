// The hike score and the hard rules, as pure functions.
//
// The score is a transparent 0–100 rating of one trail's weather on one day.
// The hard rules are filters, not score tweaks: a trail out of season, with
// snow likely on it, the wrong length or grade, or a day that doesn't fit
// into daylight and the timetable is never recommended at all.

import { inTrailSeason, gradeOf } from './trails.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** 1 for a high-point maximum between 6 and 20 °C, fading to 0 at -4 °C and 30 °C. */
export function hikeTemperatureComfort(tMaxC) {
  if (tMaxC == null) return 0.5;
  if (tMaxC < 6) return clamp((tMaxC + 4) / 10, 0, 1);
  if (tMaxC > 20) return clamp((30 - tMaxC) / 10, 0, 1);
  return 1;
}

/**
 * @param {object} day  from summariseHikeLocation
 * @param {{wants?: string[]}} [prefs]
 * @returns {{score: number, flags: string[]}}
 */
export function scoreHikeDay(day, { wants = [] } = {}) {
  const views = wants.includes('views');
  const sunny = wants.includes('sunshine');
  // Weights add up to 100.
  const w = views
    ? { sun: 25, dry: 35, comfort: 15, clear: 25 }
    : sunny
      ? { sun: 40, dry: 35, comfort: 15, clear: 10 }
      : { sun: 30, dry: 40, comfort: 20, clear: 10 };

  const sun = clamp((day.sunshineH ?? 0) / 8, 0, 1);
  // Dry: only ever goes down as the chance or amount of rain goes up.
  const probDry = 1 - clamp((day.precipProbPct ?? 0) / 100, 0, 1);
  const amountDry = 1 - clamp((day.precipMm ?? 0) / 10, 0, 1);
  const dry = Math.min(probDry, amountDry);
  const comfort = hikeTemperatureComfort(day.tempMaxC);
  const clear = 1 - clamp((day.cloudCoverPct ?? 50) / 100, 0, 1);

  let score = w.sun * sun + w.dry * dry + w.comfort * comfort + w.clear * clear;
  const flags = [];
  if (day.thunder) { score -= 35; flags.push('thunderstorms'); }
  if ((day.precipMm ?? 0) >= 2) { score -= 10; flags.push('rain'); }
  if ((day.gustMaxKmh ?? 0) >= 70) { score -= 25; flags.push('storm_gusts'); } else if ((day.gustMaxKmh ?? 0) >= 50) { score -= 10; flags.push('windy'); }
  if ((day.tempMaxC ?? 10) >= 27) flags.push('hot');
  if ((day.tempMaxC ?? 10) <= 0) flags.push('freezing');
  if (day.snowLikely) flags.push('snow_on_trail');
  return { score: Math.round(clamp(score, 0, 100)), flags };
}

/* ---------- hard rules ---------- */

export const LENGTHS = {
  half: { label: 'Half day, under 3 h', test: (min) => min < 180 },
  full: { label: 'Full day, 3–6 h', test: (min) => min >= 180 && min <= 360 },
  long: { label: 'Long day, 6 h+', test: (min) => min > 360 },
};

export const lengthMatches = (trail, length) => (LENGTHS[length] ?? LENGTHS.full).test(trail.walkingTimeMin);
export const gradeMatches = (trail, grade) => gradeOf(trail) === grade;

/**
 * Why a trail can't be walked on a day, or null if it can. Season and snow
 * are checked here; daylight and trains come later, in fitsDay().
 */
export function dayProblem(trail, day) {
  if (!inTrailSeason(trail, day.date)) return 'out of season';
  if (day.snowLikely) return `Snow likely at ${trail.highPoint.elevationM.toLocaleString('en-GB')} m, the trail's high point`;
  if (trail.lift && !trail.lift.statusUrls?.length) return 'depends on a lift with no opening-status link';
  return null;
}

const toMin = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};
export const fromMin = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.round(min % 60)).padStart(2, '0')}`;
export const BUFFER = 0.15;

/**
 * Does the day fit? You start walking when the train arrives (or at sunrise,
 * if it arrives in the dark), walk the official time plus a 15% buffer, and
 * must finish before sunset and in time for the last good train home.
 * Times are HH:MM, all on the hike day, Europe/Zurich.
 * @returns {{fits: boolean, reason: string|null, startWalking: string, finish: string, spareMin: number|null}}
 */
export function fitsDay({ arrives, walkingTimeMin, sunrise, sunset, lastTrainHome }) {
  const start = Math.max(toMin(arrives), toMin(sunrise));
  const finish = start + walkingTimeMin * (1 + BUFFER);
  const base = { startWalking: fromMin(start), finish: fromMin(finish), spareMin: null };
  if (finish > toMin(sunset)) return { ...base, fits: false, reason: `You'd finish at about ${fromMin(finish)}, after sunset (${sunset})` };
  if (!lastTrainHome) return { ...base, fits: false, reason: 'No train home found that evening' };
  const spare = toMin(lastTrainHome) - finish;
  if (spare < 0) return { ...base, fits: false, reason: `You'd finish at about ${fromMin(finish)}, after the last good train home (${lastTrainHome})` };
  return { ...base, fits: true, reason: null, spareMin: Math.round(spare) };
}
