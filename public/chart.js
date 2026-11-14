// Snowfall chart: one series, bars per day, past days lighter, your day darkest.
// Plain SVG, no library. Every bar has a hover/focus tooltip and the whole
// chart has a table view.

const NS = 'http://www.w3.org/2000/svg';

// Chart colours live in styles.css as custom properties (--chart-*), so the
// palette has one source. Read them at draw time.
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const FLAG_TEXT = {
  lift_closures_likely: 'Gusts may close the top lifts',
  windy: 'Windy',
  rain: 'Rain at mid-mountain',
  heavy_snowfall_poor_visibility: 'Heavy snow, poor visibility',
  thin_base: 'Thin snow base',
  outside_typical_season: 'Usually closed at this time of year',
};
export const flagText = (f) => FLAG_TEXT[f] ?? f.replaceAll('_', ' ');

export const fmtDay = (iso, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });

const svgEl = (tag, attrs = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
};

function niceMax(max) {
  if (max <= 10) return 10;
  if (max <= 20) return 20;
  return Math.ceil(max / 10) * 10;
}

/** A bar with a 4px rounded top and a square base. */
function barPath(x, yTop, w, yBase) {
  const h = yBase - yTop;
  const r = Math.min(4, h, w / 2);
  return `M${x},${yBase}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + w - r}Q${x + w},${yTop} ${x + w},${yTop + r}V${yBase}Z`;
}

function tooltipHtml(d) {
  const rows = [
    ['Snowfall that day', `${d.snowfallCm} cm`],
    ['Fresh snow to ski', `${d.freshSnowCm} cm`],
    ['Snow depth', d.depthCm == null ? 'n/a' : `${d.depthCm} cm`],
    ['Sunshine', `${d.sunshineH} h`],
    ['High / low', `${d.tempMaxC} / ${d.tempMinC} °C`],
    ['Max gusts', `${d.gustMaxKmh} km/h`],
    ['Ski score', `${d.score}`],
  ];
  const flags = d.flags.map(flagText).join('. ');
  return `<b>${fmtDay(d.date)}${d.isPast ? ' (observed)' : ''}</b>
    <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    ${flags ? `<p>${flags}</p>` : ''}`;
}

/**
 * @param {HTMLElement} host
 * @param {{days: object[], highlight: string, elevationM: number}} data
 */
export function renderSnowChart(host, { days, highlight, elevationM }) {
  host.replaceChildren();
  host.classList.add('chart');

  const title = document.createElement('h4');
  title.className = 'chart__title';
  title.textContent = `Snowfall at ${elevationM.toLocaleString('en-GB')} m`;
  const sub = document.createElement('p');
  sub.className = 'chart__sub';
  sub.textContent = 'Centimetres per day. What falls in the two nights before your day is what you ski. Hover over or tab to a day for its full forecast.';
  host.append(title, sub);

  const width = Math.max(300, Math.round(host.clientWidth || 640));
  const narrow = width < 520;
  const height = narrow ? 210 : 240;
  const m = { top: 30, right: 6, bottom: 60, left: 34 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const band = iw / days.length;
  const barW = Math.min(24, band * 0.62);
  const yMax = niceMax(Math.max(0, ...days.map((d) => d.snowfallCm ?? 0)));
  const y = (v) => m.top + ih - (v / yMax) * ih;
  const step = yMax <= 20 ? 5 : 10;
  const C = {
    past: cssVar('--chart-past'), future: cssVar('--chart-future'), day: cssVar('--chart-day'),
    grid: cssVar('--chart-grid'), base: cssVar('--chart-base'), divider: cssVar('--chart-divider'),
    dayBand: cssVar('--chart-day-band'),
  };

  const svg = svgEl('svg', {
    class: 'chart__svg', viewBox: `0 0 ${width} ${height}`, width, height,
    role: 'group', 'aria-label': `Snowfall per day at ${elevationM} metres`,
  });

  for (let v = 0; v <= yMax; v += step) {
    svg.append(svgEl('line', { x1: m.left, x2: width - m.right, y1: y(v), y2: y(v), stroke: v === 0 ? C.base : C.grid, 'stroke-width': 1 }));
    svg.append(svgEl('text', { class: 'tick', x: m.left - 8, y: y(v) + 4, 'text-anchor': 'end' }, v));
  }

  const firstFuture = days.findIndex((d) => !d.isPast);
  if (firstFuture > 0) {
    const x = m.left + firstFuture * band;
    svg.append(svgEl('line', { x1: x, x2: x, y1: m.top - 22, y2: m.top + ih, stroke: C.divider, 'stroke-width': 1 }));
    svg.append(svgEl('text', { class: 'region', x: x - 6, y: m.top - 12, 'text-anchor': 'end' }, narrow ? 'Past' : 'Last 3 days'));
    svg.append(svgEl('text', { class: 'region', x: x + 6, y: m.top - 12 }, 'Forecast'));
  }

  // Shade your day, behind everything else.
  const dayIndex = days.findIndex((d) => d.date === highlight);
  if (dayIndex >= 0) {
    svg.append(svgEl('rect', { x: m.left + dayIndex * band, y: m.top - 4, width: band, height: ih + 4 + 40, fill: C.dayBand, rx: 3 }));
    svg.append(svgEl('text', { class: 'region region--day', x: m.left + dayIndex * band + band / 2, y: m.top + ih + 52, 'text-anchor': 'middle' }, 'Your day'));
  }
  // Label one bar only: the biggest snowfall.
  const peak = days.reduce((b, d, i) => ((d.snowfallCm ?? 0) > (days[b]?.snowfallCm ?? 0) ? i : b), -1);

  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;

  const show = (g, d, i) => {
    svg.querySelectorAll('.band--active').forEach((n) => n.classList.remove('band--active'));
    g.classList.add('band--active');
    tip.innerHTML = tooltipHtml(d);
    tip.hidden = false;
    // Sit beside the day (right of it, or left near the edge), level with the plot top.
    const scale = svg.getBoundingClientRect().width / width;
    const svgTop = svg.getBoundingClientRect().top - host.getBoundingClientRect().top;
    const tw = tip.offsetWidth;
    const right = (m.left + (i + 1) * band) * scale + 6;
    const leftSide = (m.left + i * band) * scale - tw - 6;
    const left = right + tw <= host.clientWidth ? right : Math.max(0, leftSide);
    tip.style.left = `${left}px`;
    tip.style.top = `${svgTop + m.top * scale}px`;
  };
  const hide = (g) => { g.classList.remove('band--active'); tip.hidden = true; };

  days.forEach((d, i) => {
    const x0 = m.left + i * band;
    const isDay = d.date === highlight;
    const g = svgEl('g', {
      class: 'band', tabindex: 0, role: 'img',
      'aria-label': `${fmtDay(d.date)}: ${d.snowfallCm} centimetres of snowfall${d.isPast ? ', observed' : ''}. Ski score ${d.score}.`,
    });
    g.append(svgEl('rect', { class: 'hit', x: x0, y: m.top - 4, width: band, height: ih + 4 + m.bottom }));

    if (d.snowfallCm > 0) {
      const fill = isDay ? C.day : d.isPast ? C.past : C.future;
      g.append(svgEl('path', { d: barPath(x0 + (band - barW) / 2, y(d.snowfallCm), barW, y(0)), fill }));
    }
    if (i === peak) {
      g.append(svgEl('text', { class: 'value', x: x0 + band / 2, y: y(d.snowfallCm) - 7, 'text-anchor': 'middle' }, `${d.snowfallCm} cm`));
    }

    const showWeekday = !narrow || i % 2 === 0 || isDay;
    const wd = fmtDay(d.date, { weekday: 'short' });
    g.append(svgEl('text', {
      class: isDay ? 'tick tick--day' : 'tick', x: x0 + band / 2, y: m.top + ih + 17, 'text-anchor': 'middle',
    }, showWeekday ? (narrow ? wd.slice(0, 2) : wd) : ''));
    g.append(svgEl('text', {
      class: isDay ? 'tick tick--day' : 'tick', x: x0 + band / 2, y: m.top + ih + 33, 'text-anchor': 'middle',
    }, new Date(`${d.date}T12:00:00Z`).getUTCDate()));

    g.addEventListener('pointerenter', () => show(g, d, i));
    g.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hide(g); });
    g.addEventListener('focus', () => show(g, d, i));
    g.addEventListener('blur', () => hide(g));
    svg.append(g);
  });

  host.append(svg, tip);
  // On touch screens a tap shows the tooltip; tapping anywhere else hides it.
  document.addEventListener('pointerdown', (e) => {
    if (!svg.contains(e.target)) svg.querySelectorAll('.band--active').forEach((g) => hide(g));
  });

  const table = document.createElement('details');
  table.className = 'chart__table';
  table.innerHTML = `<summary>Show as a table</summary>
    <div class="table-scroll" tabindex="0" role="region" aria-label="Forecast table"><table>
      <thead><tr><th scope="col">Day</th><th scope="col">Snowfall (cm)</th><th scope="col">Fresh to ski (cm)</th><th scope="col">Depth (cm)</th><th scope="col">Sun (h)</th><th scope="col">High (°C)</th><th scope="col">Gusts (km/h)</th><th scope="col">Score</th></tr></thead>
      <tbody>${days.map((d) => `<tr><th scope="row">${fmtDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}${d.isPast ? ' (observed)' : ''}</th><td>${d.snowfallCm}</td><td>${d.freshSnowCm}</td><td>${d.depthCm ?? 'n/a'}</td><td>${d.sunshineH}</td><td>${d.tempMaxC}</td><td>${d.gustMaxKmh}</td><td>${d.score}</td></tr>`).join('')}</tbody>
    </table></div>`;
  host.append(table);
}

/* ---------- hourly hike chart ---------- */

/**
 * The hike day hour by hour at the trail's high point: rain probability as
 * bars (left axis, %) and temperature as a line (right axis, °C). Plain SVG
 * with focusable hours, a tooltip and a table view, like the snowfall chart.
 * @param {HTMLElement} host
 * @param {{hours: {time: string, precipProbPct: number|null, tempC: number|null}[], date: string, elevationM: number, sunrise?: string, sunset?: string}} data
 */
export function renderHourlyChart(host, { hours, date, elevationM, sunrise, sunset }) {
  host.replaceChildren();
  host.classList.add('chart');

  const title = document.createElement('h4');
  title.className = 'chart__title';
  title.textContent = `${fmtDay(date, { weekday: 'long' })} at ${elevationM.toLocaleString('en-GB')} m, hour by hour`;
  const sub = document.createElement('p');
  sub.className = 'chart__sub';
  sub.textContent = `Bars: chance of rain. Line: temperature.${sunrise && sunset ? ` Sunrise ${sunrise}, sunset ${sunset}.` : ''} Hover over or tab to an hour for its numbers.`;
  host.append(title, sub);

  const width = Math.max(300, Math.round(host.clientWidth || 640));
  const narrow = width < 520;
  const height = narrow ? 210 : 230;
  const m = { top: 24, right: 38, bottom: 40, left: 38 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const band = iw / Math.max(1, hours.length);
  const barW = Math.min(18, band * 0.6);
  const yP = (p) => m.top + ih - (p / 100) * ih;
  const temps = hours.map((x) => x.tempC).filter((t) => t != null);
  const tMin = Math.floor(Math.min(0, ...temps) / 5) * 5;
  const tMax = Math.ceil(Math.max(10, ...temps) / 5) * 5;
  const yT = (t) => m.top + ih - ((t - tMin) / (tMax - tMin || 1)) * ih;
  const C = { bar: cssVar('--chart-future'), line: cssVar('--chart-day'), grid: cssVar('--chart-grid'), base: cssVar('--chart-base') };

  const svg = svgEl('svg', {
    class: 'chart__svg', viewBox: `0 0 ${width} ${height}`, width, height,
    role: 'group', 'aria-label': `Chance of rain and temperature by hour on ${fmtDay(date)} at ${elevationM} metres`,
  });
  for (const p of [0, 25, 50, 75, 100]) {
    svg.append(svgEl('line', { x1: m.left, x2: width - m.right, y1: yP(p), y2: yP(p), stroke: p === 0 ? C.base : C.grid, 'stroke-width': 1 }));
    svg.append(svgEl('text', { class: 'tick', x: m.left - 6, y: yP(p) + 4, 'text-anchor': 'end' }, `${p}%`));
  }
  for (let t = tMin; t <= tMax; t += 5) {
    svg.append(svgEl('text', { class: 'tick tick--temp', x: width - m.right + 6, y: yT(t) + 4 }, `${t}°`));
  }

  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  const show = (g, x, i) => {
    svg.querySelectorAll('.band--active').forEach((n) => n.classList.remove('band--active'));
    g.classList.add('band--active');
    tip.innerHTML = `<b>${x.time}</b><dl><dt>Chance of rain</dt><dd>${x.precipProbPct ?? 'n/a'}%</dd><dt>Temperature</dt><dd>${x.tempC ?? 'n/a'} °C</dd></dl>`;
    tip.hidden = false;
    const scale = svg.getBoundingClientRect().width / width;
    const svgTop = svg.getBoundingClientRect().top - host.getBoundingClientRect().top;
    const right = (m.left + (i + 1) * band) * scale + 6;
    const left = right + tip.offsetWidth <= host.clientWidth ? right : Math.max(0, (m.left + i * band) * scale - tip.offsetWidth - 6);
    tip.style.left = `${left}px`;
    tip.style.top = `${svgTop + m.top * scale}px`;
  };
  const hide = (g) => { g.classList.remove('band--active'); tip.hidden = true; };

  hours.forEach((x, i) => {
    const x0 = m.left + i * band;
    const g = svgEl('g', { class: 'band', tabindex: 0, role: 'img', 'aria-label': `${x.time}: ${x.precipProbPct ?? 'unknown'} percent chance of rain, ${x.tempC ?? 'unknown'} degrees` });
    g.append(svgEl('rect', { class: 'hit', x: x0, y: m.top - 4, width: band, height: ih + 4 + m.bottom }));
    if ((x.precipProbPct ?? 0) > 0) g.append(svgEl('path', { d: barPath(x0 + (band - barW) / 2, yP(x.precipProbPct), barW, yP(0)), fill: C.bar }));
    const showLabel = !narrow || i % 3 === 0;
    g.append(svgEl('text', { class: 'tick', x: x0 + band / 2, y: m.top + ih + 17, 'text-anchor': 'middle' }, showLabel ? x.time.slice(0, 2) : ''));
    g.addEventListener('pointerenter', () => show(g, x, i));
    g.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hide(g); });
    g.addEventListener('focus', () => show(g, x, i));
    g.addEventListener('blur', () => hide(g));
    svg.append(g);
  });
  const pts = hours.map((x, i) => (x.tempC == null ? null : `${(m.left + i * band + band / 2).toFixed(1)},${yT(x.tempC).toFixed(1)}`)).filter(Boolean);
  if (pts.length > 1) svg.append(svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: C.line, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'pointer-events': 'none' }));
  svg.append(svgEl('text', { class: 'region', x: m.left, y: height - 4 }, 'Hour'));

  host.append(svg, tip);
  document.addEventListener('pointerdown', (e) => {
    if (!svg.contains(e.target)) svg.querySelectorAll('.band--active').forEach((g) => hide(g));
  });

  const table = document.createElement('details');
  table.className = 'chart__table';
  table.innerHTML = `<summary>Show as a table</summary>
    <div class="table-scroll" tabindex="0" role="region" aria-label="Hourly forecast table"><table>
      <thead><tr><th scope="col">Hour</th><th scope="col">Chance of rain (%)</th><th scope="col">Temperature (°C)</th></tr></thead>
      <tbody>${hours.map((x) => `<tr><th scope="row">${x.time}</th><td>${x.precipProbPct ?? 'n/a'}</td><td>${x.tempC ?? 'n/a'}</td></tr>`).join('')}</tbody>
    </table></div>`;
  host.append(table);
}
