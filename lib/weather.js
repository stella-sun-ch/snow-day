// Open-Meteo forecast client: one request for many resorts, then a tidy per-day
// summary. Weather data by Open-Meteo.com (CC BY 4.0), free and keyless.
// Variable names and units: https://open-meteo.com/en/docs

import { freshSnowCm, scoreDay } from './score.js';
import { RESORTS, inTypicalSeason } from './resorts.js';
import { getJson } from './http.js';

const BASE = 'https://api.open-meteo.com/v1/forecast';
const DAILY = [
  'snowfall_sum',        // cm, water-equivalent converted to snow by Open-Meteo
  'rain_sum',            // mm
  'temperature_2m_max',  // °C
  'temperature_2m_min',  // °C
  'wind_gusts_10m_max',  // km/h
  'sunshine_duration',   // seconds
  'weather_code',        // WMO code
];
const HOURLY = ['snow_depth', 'freezing_level_height']; // both metres
export const PAST_DAYS = 3;
export const FORECAST_DAYS = 16; // enough to reach "next weekend" from any day
export const FORECAST_TTL_MS = 15 * 60 * 1000;

export function buildForecastUrl(resorts, { pastDays = PAST_DAYS, forecastDays = FORECAST_DAYS } = {}) {
  const params = new URLSearchParams({
    latitude: resorts.map((r) => r.forecast.lat).join(','),
    longitude: resorts.map((r) => r.forecast.lon).join(','),
    // Ski height, so the forecast is downscaled to the pistes, not the village.
    elevation: resorts.map((r) => r.forecast.elevationM).join(','),
    daily: DAILY.join(','),
    hourly: HOURLY.join(','),
    timezone: 'Europe/Zurich',
    past_days: String(pastDays),
    forecast_days: String(forecastDays),
  });
  return `${BASE}?${params}`;
}

/* ---------- units ---------- */

// Factors that convert each unit Open-Meteo can return into the unit Snow Day
// uses. Anything not listed is refused rather than guessed.
const TO = {
  cm: { cm: 1, inch: 2.54 },
  mm: { mm: 1, inch: 25.4 },
  kmh: { 'km/h': 1, 'm/s': 3.6, 'mp/h': 1.609344, kn: 1.852 },
  hours: { s: 1 / 3600, h: 1 },
  m: { m: 1, ft: 0.3048 },
};

/** Convert `value` from `unit` into the target scale `to` ('cm', 'mm', 'kmh', 'hours', 'm', 'celsius'). */
export function convert(value, unit, to) {
  if (value == null) return null;
  if (to === 'celsius') {
    if (unit === '°C') return value;
    if (unit === '°F') return ((value - 32) * 5) / 9;
  } else {
    const factor = TO[to]?.[unit];
    if (factor != null) return value * factor;
  }
  throw new Error(`Unexpected unit "${unit}" from the forecast; expected something convertible to ${to}.`);
}

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const round0 = (x) => (x == null ? null : Math.round(x));

/** Mean of hourly values for one date between two hours (inclusive). */
function hourlyMean(hourly, key, date, fromH, toH) {
  const vals = [];
  hourly.time.forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const h = Number(t.slice(11, 13));
    if (h >= fromH && h <= toH && hourly[key]?.[i] != null) vals.push(hourly[key][i]);
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * Turn one Open-Meteo location block into Snow Day's per-day shape, with every
 * value converted into cm, mm, km/h, hours, metres or °C.
 * @param {object} block   one element of the Open-Meteo response
 * @param {object} resort  entry from RESORTS
 * @param {{today: string, style?: string}} opts
 */
export function summariseLocation(block, resort, { today, style = 'balanced' }) {
  const d = block.daily;
  const du = block.daily_units ?? {};
  const hu = block.hourly_units ?? {};
  const snowfall = d.snowfall_sum.map((x) => convert(x ?? 0, du.snowfall_sum, 'cm'));

  const days = d.time.map((date, i) => {
    const depthM = hourlyMean(block.hourly, 'snow_depth', date, 12, 12);
    const freezing = hourlyMean(block.hourly, 'freezing_level_height', date, 10, 15);
    const day = {
      date,
      isPast: date < today,
      snowfallCm: round0(snowfall[i]),
      freshSnowCm: freshSnowCm(snowfall, i),
      rainMm: round1(convert(d.rain_sum[i] ?? 0, du.rain_sum, 'mm')),
      tempMaxC: round0(convert(d.temperature_2m_max[i], du.temperature_2m_max, 'celsius')),
      tempMinC: round0(convert(d.temperature_2m_min[i], du.temperature_2m_min, 'celsius')),
      gustMaxKmh: round0(convert(d.wind_gusts_10m_max[i], du.wind_gusts_10m_max, 'kmh')),
      sunshineH: round1(convert(d.sunshine_duration[i] ?? 0, du.sunshine_duration, 'hours')),
      weatherCode: d.weather_code[i],
      depthCm: depthM == null ? null : round0(convert(depthM, hu.snow_depth, 'm') * 100),
      freezingLevelM: round0(convert(freezing, hu.freezing_level_height, 'm')),
      inSeason: inTypicalSeason(resort, date),
    };
    return { ...day, ...scoreDay(day, style) };
  });

  const past = days.filter((x) => x.isPast);
  const todayRow = days.find((x) => x.date === today) ?? days.find((x) => !x.isPast);
  return {
    id: resort.id,
    name: resort.name,
    // The elevation Open-Meteo actually used, as it reports it.
    elevationM: round0(block.elevation ?? resort.forecast.elevationM),
    style,
    last72hSnowCm: past.slice(-3).reduce((a, x) => a + (x.snowfallCm ?? 0), 0),
    depthTodayCm: todayRow?.depthCm ?? null,
    days,
  };
}

/** Open-Meteo returns an object for one location and an array for several. */
export function summariseForecast(json, resorts, opts) {
  const blocks = Array.isArray(json) ? json : [json];
  if (blocks.length !== resorts.length) {
    throw new Error(`Expected ${resorts.length} forecast locations, got ${blocks.length}`);
  }
  return Object.fromEntries(resorts.map((r, i) => [r.id, summariseLocation(blocks[i], r, opts)]));
}

// Cached forecasts avoid repeated requests to the weather API.
/**
 * The forecast for these resorts. We always ask Open-Meteo for every resort in
 * one request and cache it for 15 minutes, so every plan shares one call.
 * Returns the location blocks in the order of `resorts`.
 */
export async function fetchForecast(resorts, { fetchImpl = fetch, now = Date.now } = {}) {
  const { json, fetchedAt } = await getJson(buildForecastUrl(RESORTS), {
    fetchImpl, now, ttlMs: FORECAST_TTL_MS, label: 'Open-Meteo forecast service',
  });
  const blocks = Array.isArray(json) ? json : [json];
  if (blocks.length !== RESORTS.length) throw new Error(`Expected ${RESORTS.length} forecast locations, got ${blocks.length}`);
  return { json: resorts.map((r) => blocks[RESORTS.indexOf(r)]), fetchedAt };
}
