// Swiss public transport via transport.opendata.ch (free, no key).
// Every time and duration shown in the app comes from these responses; nothing
// is estimated. If no connection comes back, the journey says so.

import { getJson } from './http.js';

const BASE = 'https://transport.opendata.ch/v1/connections';
export const TIMETABLE_TTL_MS = 60 * 60 * 1000;
export const DEPARTURE_TIME = '07:00'; // the morning of the ski day
export const NO_CONNECTION = 'No train connection found for this date';
export const RETURN_BY = '21:30'; // a sensible time to be back at the station you started from
export const TIMETABLE_UNAVAILABLE = 'The timetable could not be reached';

// Where a journey starts. Station ids keep the timetable from guessing.
export const ORIGINS = {
  ZRH: { name: 'Zürich Flughafen', id: '8503016', city: 'Zurich', airport: true },
  GVA: { name: 'Genève-Aéroport', id: '8501026', city: 'Geneva', airport: true },
  Zurich: { name: 'Zürich HB', id: '8503000', city: 'Zurich' },
  Geneva: { name: 'Genève', id: '8501008', city: 'Geneva' },
};

/** '00d03:25:00' → 205 */
export function parseDuration(s) {
  const m = /^(\d+)d(\d{2}):(\d{2}):(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  return Number(m[1]) * 1440 + Number(m[2]) * 60 + Number(m[3]);
}

/** 205 → '3 h 25 min', the way Swiss signposts write it. */
export function formatDuration(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const zurichTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const zurichDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' });

/** An API timestamp such as '2026-11-14T07:15:00+0100' as Zurich wall-clock time and date. */
export function inZurich(iso) {
  if (!iso) return { time: null, date: null };
  const d = new Date(iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return { time: zurichTime.format(d), date: zurichDate.format(d) };
}

/** 'IC' + '000903' → 'IC 903'; bus 'B' + '511' → 'B 511'. */
function lineName(j) {
  const number = String(j.number ?? '').replace(/^0+/, '');
  return [j.category, number].filter(Boolean).join(' ') || j.name || 'Train';
}

export function buildConnectionsUrl({ from, to, date, time = DEPARTURE_TIME, arriveBy = false }) {
  const params = new URLSearchParams({ from, to, date, time, limit: '4' });
  if (arriveBy) params.set('isArrivalTime', '1'); // connections arriving by `time`
  return `${BASE}?${params}`;
}

/**
 * Pick one connection and keep what a person needs to read. By default the
 * one that gets you there earliest (shorter trip on a tie); with
 * `{ latestDeparture: true }`, the last one that still arrives by `arriveBy`
 * (HH:MM, Zurich time), which is how "the last good train home" is chosen.
 * Returns null when there is none.
 */
export function summariseConnections(json, { latestDeparture = false, arriveBy = null } = {}) {
  let conns = (json?.connections ?? []).filter((c) => c.to?.arrival && c.from?.departure && parseDuration(c.duration) != null);
  if (arriveBy) conns = conns.filter((c) => inZurich(c.to.arrival).time <= arriveBy);
  if (!conns.length) return null;
  const c = latestDeparture
    ? conns.reduce((best, x) => (x.from.departure.localeCompare(best.from.departure) > 0 ? x : best))
    : conns.reduce((best, x) => {
      const cmp = x.to.arrival.localeCompare(best.to.arrival);
      return cmp < 0 || (cmp === 0 && parseDuration(x.duration) < parseDuration(best.duration)) ? x : best;
    });
  const dep = inZurich(c.from.departure);
  const arr = inZurich(c.to.arrival);
  const durationMin = parseDuration(c.duration);
  const legs = (c.sections ?? [])
    .filter((s) => s.journey)
    .map((s) => {
      const d = inZurich(s.departure?.departure);
      const a = inZurich(s.arrival?.arrival);
      return {
        line: lineName(s.journey),
        towards: s.journey.to ?? null,
        from: s.departure?.station?.name,
        departs: d.time,
        departsDate: d.date,
        to: s.arrival?.station?.name,
        arrives: a.time,
        arrivesDate: a.date,
      };
    });
  return {
    status: 'ok',
    from: c.from.station?.name,
    to: c.to.station?.name,
    date: dep.date,
    departs: dep.time,
    arrives: arr.time,
    arrivesDate: arr.date,
    departsAt: c.from.departure,
    arrivesAt: c.to.arrival,
    durationMin,
    duration: formatDuration(durationMin),
    transfers: c.transfers ?? Math.max(0, legs.length - 1),
    legs,
  };
}

/** Where a start like 'London', 'Zurich' or 'Bern' leaves from, by train. */
export function originsFor(start) {
  const s = String(start ?? '').trim().toLowerCase();
  if (!s || /london|uk|england|britain|heathrow|gatwick|stansted|luton/.test(s)) return [ORIGINS.GVA, ORIGINS.ZRH];
  if (/zurich|zürich/.test(s)) return /airport|flughafen/.test(s) ? [ORIGINS.ZRH] : [ORIGINS.Zurich];
  if (/geneva|genève|geneve|genf/.test(s)) return /airport|aéroport|aeroport/.test(s) ? [ORIGINS.GVA] : [ORIGINS.Geneva];
  return [{ name: start.trim(), id: start.trim(), city: start.trim() }]; // any other Swiss station, by name
}

async function journeyFrom(origin, resort, date, time, fetchImpl, now) {
  const url = buildConnectionsUrl({ from: origin.id, to: resort.station.id, date, time });
  try {
    const { json, fetchedAt } = await getJson(url, {
      fetchImpl, now, ttlMs: TIMETABLE_TTL_MS, timeoutMs: 8_000, label: 'Swiss timetable',
    });
    const j = summariseConnections(json);
    return j ? { ...j, origin, checkedAt: fetchedAt } : { status: 'none', origin, checkedAt: fetchedAt };
  } catch {
    return { status: 'unavailable', origin };
  }
}

/**
 * The last good connection from a station back to an origin, arriving by
 * `arriveBy` (HH:MM). Same statuses as getJourney.
 */
export async function getReturnJourney({ from, to, date, arriveBy = RETURN_BY, fetchImpl = fetch, now = Date.now }) {
  const url = buildConnectionsUrl({ from: from.id, to: to.id, date, time: arriveBy, arriveBy: true });
  const base = { from: from.name, toOrigin: to, date, arriveBy };
  try {
    const { json, fetchedAt } = await getJson(url, { fetchImpl, now, ttlMs: TIMETABLE_TTL_MS, timeoutMs: 8_000, label: 'Swiss timetable' });
    const j = summariseConnections(json, { latestDeparture: true, arriveBy });
    return j ? { ...base, ...j, checkedAt: fetchedAt } : { ...base, status: 'none', message: NO_CONNECTION, checkedAt: fetchedAt };
  } catch {
    return { ...base, status: 'unavailable', message: TIMETABLE_UNAVAILABLE };
  }
}

/**
 * The train journey to a resort on a date. From London there are two
 * candidate airports; we look up both and keep the shorter real connection.
 * Never throws: a journey has status 'ok', 'none' (the timetable found
 * nothing) or 'unavailable' (it couldn't be reached).
 */
export async function getJourney({ resort, start = 'London', date, time = DEPARTURE_TIME, fetchImpl = fetch, now = Date.now }) {
  const origins = originsFor(start);
  const results = await Promise.all(origins.map((o) => journeyFrom(o, resort, date, time, fetchImpl, now)));
  const ok = results.filter((r) => r.status === 'ok').sort((a, b) => a.durationMin - b.durationMin);
  const flying = origins.every((o) => o.airport) && origins.length > 1;
  const base = { resort_id: resort.id, start, date, flying };
  if (ok.length) return { ...base, ...ok[0], airport: flying ? ok[0].origin.city : null };
  const status = results.some((r) => r.status === 'none') ? 'none' : 'unavailable';
  return {
    ...base,
    status,
    to: resort.station.name,
    message: status === 'none' ? NO_CONNECTION : TIMETABLE_UNAVAILABLE,
    checkedAt: results.find((r) => r.checkedAt)?.checkedAt ?? null,
  };
}
