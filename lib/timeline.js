// The door-to-door plan for the picked day, built from the real train legs.
// It is never written by the model: every time on it comes from the timetable.

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// The timetable's line category ('IR 75', 'B 511', 'GB 1') says what you ride.
const CABLE = new Set(['GB', 'LB', 'PB', 'SB', 'SL', 'FUN', 'CC']);
const BUS = new Set(['B', 'BUS', 'NFB', 'EXB', 'KB']);
export function modeOf(line) {
  const category = String(line ?? '').split(' ')[0].toUpperCase();
  if (CABLE.has(category)) return 'cable';
  if (BUS.has(category)) return 'bus';
  return 'train';
}

/**
 * @param {object} journey  from getJourney()
 * @param {string} day      the ski day, YYYY-MM-DD
 * @returns {{date: string, time: string|null, period?: string, title: string, detail: string}[]}
 */
export function buildTimeline(journey, day) {
  if (!journey || journey.status !== 'ok') {
    return labelTimeline([{
      date: day, time: null, period: 'morning', kind: 'none', mode: 'none',
      title: journey?.message ?? 'No train connection found for this date',
      detail: 'Try another day, or check sbb.ch for other times.',
    }]);
  }
  const rows = [];
  if (journey.flying) {
    rows.push({
      date: addDays(journey.date, -1), time: null, period: 'evening', kind: 'flight', mode: 'flight',
      title: `Fly London → ${journey.airport} the evening before`,
      detail: 'Book this separately. Snow Day doesn’t look up flights, so it shows no flight times.',
    });
  }
  for (const leg of journey.legs) {
    rows.push({
      date: leg.departsDate, time: leg.departs, kind: 'leg', mode: modeOf(leg.line),
      title: `${leg.line} to ${leg.to}`,
      detail: `From ${leg.from}${leg.towards ? `, towards ${leg.towards}` : ''}. Arrives ${leg.arrives}.`,
    });
  }
  rows.push({
    date: journey.arrivesDate, time: journey.arrives, kind: 'arrive', mode: 'arrive',
    title: `Arrive at ${journey.to}`,
    detail: `${journey.duration} by public transport from ${journey.from}.`,
  });
  return labelTimeline(rows);
}

const weekdayShort = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

/**
 * Give each row its label. The first row, and any row on a different date
 * from the one before it, shows the weekday too: "Fri evening", then
 * "Sat 07:15", then just "07:38". Times are Europe/Zurich wall-clock times.
 */
export function labelTimeline(rows) {
  return rows.map((r, i) => {
    const when = r.time ?? r.period ?? '';
    const newDay = i === 0 || r.date !== rows[i - 1].date;
    return { ...r, label: newDay && r.date ? `${weekdayShort(r.date)} ${when}`.trim() : when };
  });
}
