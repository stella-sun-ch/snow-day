// Dates and local hours for Swiss departures and forecast windows.
export function todayInZurich(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(now);
}

export function zurichHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23',
  }).format(now));
}
