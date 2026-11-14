// The hike forecast: Open-Meteo at each verified trail's high point, with the
// `elevation` parameter so it is downscaled to that height. One request for
// all trails, cached for 15 minutes, sharing the cache and unit conversion
// with the ski forecast. Variable names and units: https://open-meteo.com/en/docs

import { VERIFIED_TRAILS } from './trails.js';
import { convert, PAST_DAYS, FORECAST_DAYS, FORECAST_TTL_MS } from './weather.js';
import { getJson } from './http.js';

const BASE = 'https://api.open-meteo.com/v1/forecast';
const DAILY = [
  'sunshine_duration',             // seconds
  'precipitation_sum',             // mm
  'precipitation_probability_max', // %
  'weather_code',                  // WMO code; 95, 96 and 99 are thunderstorms
  'wind_gusts_10m_max',            // km/h
  'temperature_2m_max',            // °C
  'temperature_2m_min',            // °C
  'cloud_cover_mean',              // %
  'sunrise',                       // local ISO time
  'sunset',                        // local ISO time
  'snowfall_sum',                  // cm
];
const HOURLY = ['precipitation_probability', 'temperature_2m', 'snow_depth'];
const THUNDER_CODES = new Set([95, 96, 99]);

export function buildHikeForecastUrl(trails = VERIFIED_TRAILS) {
  const params = new URLSearchParams({
    latitude: trails.map((t) => t.highPoint.lat).join(','),
    longitude: trails.map((t) => t.highPoint.lon).join(','),
    elevation: trails.map((t) => t.highPoint.elevationM).join(','),
    daily: DAILY.join(','),
    hourly: HOURLY.join(','),
    timezone: 'Europe/Zurich',
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
  });
  return `${BASE}?${params}`;
}

const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const round0 = (x) => (x == null ? null : Math.round(x));
const hhmm = (iso) => (iso ? iso.slice(11, 16) : null);

/** One location block → per-day hike weather, every value in mm, %, km/h, h, °C or cm. */
export function summariseHikeLocation(block, trail, { today }) {
  const d = block.daily;
  const du = block.daily_units ?? {};
  const hu = block.hourly_units ?? {};
  const h = block.hourly;
  const snowfall = d.snowfall_sum.map((x) => convert(x ?? 0, du.snowfall_sum, 'cm'));

  const days = d.time.map((date, i) => {
    const hours = [];
    h.time.forEach((t, k) => {
      if (!t.startsWith(date)) return;
      const hour = Number(t.slice(11, 13));
      if (hour < 6 || hour > 20) return;
      hours.push({
        time: t.slice(11, 16),
        precipProbPct: h.precipitation_probability?.[k] ?? null,
        tempC: round1(convert(h.temperature_2m?.[k], hu.temperature_2m, 'celsius')),
      });
    });
    const noon = h.time.indexOf(`${date}T12:00`);
    const depthM = noon >= 0 ? h.snow_depth?.[noon] : null;
    const recentSnowCm = (snowfall[i - 2] ?? 0) + (snowfall[i - 1] ?? 0) + (snowfall[i] ?? 0);
    const snowDepthCm = depthM == null ? null : round0(convert(depthM, hu.snow_depth, 'm') * 100);
    return {
      date,
      isPast: date < today,
      sunshineH: round1(convert(d.sunshine_duration[i] ?? 0, du.sunshine_duration, 'hours')),
      precipMm: round1(convert(d.precipitation_sum[i] ?? 0, du.precipitation_sum, 'mm')),
      precipProbPct: d.precipitation_probability_max[i] ?? null,
      weatherCode: d.weather_code[i],
      thunder: THUNDER_CODES.has(d.weather_code[i]),
      gustMaxKmh: round0(convert(d.wind_gusts_10m_max[i], du.wind_gusts_10m_max, 'kmh')),
      tempMaxC: round0(convert(d.temperature_2m_max[i], du.temperature_2m_max, 'celsius')),
      tempMinC: round0(convert(d.temperature_2m_min[i], du.temperature_2m_min, 'celsius')),
      cloudCoverPct: d.cloud_cover_mean?.[i] ?? null,
      sunrise: hhmm(d.sunrise[i]),
      sunset: hhmm(d.sunset[i]),
      snowfallCm: round1(snowfall[i]),
      recentSnowCm: round1(recentSnowCm),
      snowDepthCm,
      // Snow on the trail: some lying at the high point, or a real fall in the last two days.
      snowLikely: (snowDepthCm ?? 0) >= 2 || recentSnowCm >= 2,
      hours,
    };
  });
  return { id: trail.id, name: trail.name, elevationM: round0(block.elevation ?? trail.highPoint.elevationM), days };
}

/** The forecast for these trails (always fetched for every verified trail in one request). */
export async function fetchHikeForecast(trails = VERIFIED_TRAILS, { fetchImpl = fetch, now = Date.now } = {}) {
  const { json, fetchedAt } = await getJson(buildHikeForecastUrl(VERIFIED_TRAILS), {
    fetchImpl, now, ttlMs: FORECAST_TTL_MS, label: 'Open-Meteo forecast service',
  });
  const blocks = Array.isArray(json) ? json : [json];
  if (blocks.length !== VERIFIED_TRAILS.length) throw new Error(`Expected ${VERIFIED_TRAILS.length} forecast locations, got ${blocks.length}`);
  return { json: trails.map((t) => blocks[VERIFIED_TRAILS.indexOf(t)]), fetchedAt };
}

export function summariseHikeForecast(json, trails, opts) {
  return Object.fromEntries(trails.map((t, i) => [t.id, summariseHikeLocation(json[i], t, opts)]));
}
