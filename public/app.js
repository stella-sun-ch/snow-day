import { renderSnowChart, renderHourlyChart, fmtDay, flagText } from './chart.js';

// Set this to your GitHub repo URL to show a "Source" link in the header.
const REPO_URL = '';

const $ = (sel) => document.querySelector(sel);
const form = $('#composer');
const textarea = $('#query');
const submit = $('#submit');
const resultEl = $('#result');

// Escape for HTML, and keep a number on the same line as its unit ("31 cm").
const esc = (s) => String(s ?? '')
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  .replace(/(\d) (cm|h|min|km\/h|m|°C)(?![\w])/g, '$1\u00a0$2');

if (REPO_URL) {
  const link = $('#repo-link');
  link.href = REPO_URL;
  link.hidden = false;
}

/* ---------- modes ---------- */

// Everything on the form that differs between Snow day and Hike day.
const MODES = {
  snow: {
    title: 'Snow Day: is the snow worth the trip?',
    ticket: 'Plan a ski day',
    groups: [
      {
        key: 'level', legend: 'I ski', multi: false, initial: 'red',
        options: [
          { value: 'blue', label: 'Blue runs', mark: '<span class="piste piste--blue" aria-hidden="true"></span>' },
          { value: 'red', label: 'Red runs', mark: '<span class="piste piste--red" aria-hidden="true"></span>' },
          { value: 'black', label: 'Black runs', mark: '<span class="piste piste--black" aria-hidden="true"></span>' },
        ],
      },
      {
        key: 'wants', legend: "I'm after", multi: true, initial: ['powder'],
        options: [
          { value: 'powder', label: 'Powder', icon: 'snow' },
          { value: 'sunshine', label: 'Sunshine', icon: 'sun' },
          { value: 'big views', label: 'Views', icon: 'peak' },
          { value: 'a short journey', label: 'Short journey', icon: 'train' },
        ],
      },
    ],
    sentence(c) {
      const LEVEL = { blue: "I'm happiest on blue runs", red: 'I ski red runs', black: 'I ski black runs and steeper' };
      const wants = [...c.wants];
      return `From ${c.from}, free ${c.when}. ${LEVEL[c.level]}${wants.length ? ` and I'm after ${listJoin(wants)}` : ''}.`;
    },
    summary(c) {
      const wants = [...c.wants];
      return `Quick choices: starting from ${c.from}; ${c.when}; ${c.level} runs${wants.length ? `; after ${listJoin(wants)}` : ''}.`;
    },
  },
  hike: {
    title: 'Hike Day: is the weather worth the hike?',
    ticket: 'Plan a hiking day',
    groups: [
      {
        key: 'grade', legend: 'Difficulty', multi: false, initial: 'hiking',
        options: [
          { value: 'hiking', label: 'Hiking trail', mark: '<span class="trail-mark trail-mark--hiking" aria-hidden="true"></span>' },
          { value: 'mountain', label: 'Mountain trail', mark: '<span class="trail-mark trail-mark--mountain" aria-hidden="true"></span>' },
          { value: 'alpine', label: 'Alpine route', mark: '<span class="trail-mark trail-mark--alpine" aria-hidden="true"></span>' },
        ],
      },
      {
        key: 'length', legend: 'Length', multi: false, initial: 'full',
        options: [
          { value: 'half', label: 'Half day, under 3 h' },
          { value: 'full', label: 'Full day, 3–6 h' },
          { value: 'long', label: 'Long day, 6 h+' },
        ],
      },
      {
        key: 'wants', legend: "I'm after", multi: true, initial: ['views'],
        options: [
          { value: 'views', label: 'Views', icon: 'peak' },
          { value: 'lakes', label: 'Lakes', icon: 'lake' },
          { value: 'sunshine', label: 'Sunshine', icon: 'sun' },
          { value: 'a short journey', label: 'Short journey', icon: 'train' },
        ],
      },
    ],
    sentence(c) {
      const GRADE = { hiking: 'a yellow-marked hiking trail', mountain: 'a white-red-white mountain trail', alpine: 'a white-blue-white alpine route' };
      const LENGTH = { half: 'half a day, under 3 hours of walking', full: 'a full day, 3 to 6 hours of walking', long: 'a long day, 6 hours or more of walking' };
      const wants = [...c.wants];
      return `From ${c.from}, free ${c.when}. I'd like ${GRADE[c.grade]} and ${LENGTH[c.length]}${wants.length ? `, and I'm after ${listJoin(wants)}` : ''}.`;
    },
    summary(c) {
      const wants = [...c.wants];
      return `Quick choices: starting from ${c.from}; ${c.when}; ${c.grade} grade; ${c.length} day${wants.length ? `; after ${listJoin(wants)}` : ''}.`;
    },
  },
};

const MODE_KEY = 'snowday.mode';
let mode = MODES[document.documentElement.dataset.mode] ? document.documentElement.dataset.mode : 'snow';

/* ---------- composer: choices build the request summary ---------- */

// "Starting from" and "When" are shared; the rest belongs to the mode.
const choices = { from: 'London', when: 'this weekend' };

function listJoin(xs) {
  return xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
}

const compose = () => MODES[mode].sentence(choices);

function fitTextarea() {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight + 2}px`;
}

/** Draw the mode's own chip groups and reset them to their defaults. */
function drawModeFields() {
  const holder = $('#mode-fields');
  for (const key of Object.keys(choices)) if (key !== 'from' && key !== 'when') delete choices[key];
  holder.innerHTML = MODES[mode].groups.map((g) => {
    choices[g.key] = g.multi ? new Set(g.initial) : g.initial;
    const on = (v) => (g.multi ? g.initial.includes(v) : g.initial === v);
    return `<fieldset class="field">
        <legend>${esc(g.legend)}</legend>
        <div class="field__options">${g.options.map((o) => `<button type="button" class="chip" data-group="${g.key}" data-value="${esc(o.value)}" data-multi="${g.multi}" aria-pressed="${on(o.value)}">${o.mark ?? ''}${o.icon ? `<svg class="chip__icon" aria-hidden="true"><use href="#i-${o.icon}"/></svg>` : ''}${esc(o.label)}</button>`).join('')}</div>
      </fieldset>`;
  }).join('');
}

function resetSentence() {
  textarea.value = compose();
  fitTextarea();
}

/** Switch mode in place: keep Starting from and When, reset the rest, clear any result. */
function setMode(next, { push = false } = {}) {
  if (!MODES[next]) next = 'snow';
  mode = next;
  document.documentElement.dataset.mode = next;
  document.title = MODES[next].title;
  $('#ticket-title').textContent = MODES[next].ticket;
  document.querySelectorAll('[data-mode-link]').forEach((a) => {
    if (a.dataset.modeLink === next) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try { localStorage.setItem(MODE_KEY, next); } catch { /* storage blocked: the URL still says which mode */ }
  if (push) {
    const url = new URL(location.href);
    url.searchParams.set('mode', next);
    history.pushState({ mode: next }, '', url);
  } else {
    history.replaceState({ ...(history.state ?? {}), mode: next }, ''); // so Back returns to this mode
  }
  runId += 1; // drop any plan still streaming in
  setRunning(false);
  current = null;
  chartArgs = null;
  showEmpty();
  drawModeFields();
  resetSentence();
  document.dispatchEvent(new CustomEvent('snowday:mode', { detail: next }));
}

document.querySelectorAll('[data-mode-link]').forEach((a) =>
  a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let new-tab clicks through
    e.preventDefault();
    if (a.dataset.modeLink !== mode) setMode(a.dataset.modeLink, { push: true });
  }),
);
window.addEventListener('popstate', (e) => setMode(e.state?.mode ?? new URLSearchParams(location.search).get('mode') ?? mode));

window.addEventListener('resize', fitTextarea);

form.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const { group, value } = chip.dataset;
  if (chip.dataset.multi === 'true') {
    choices[group].has(value) ? choices[group].delete(value) : choices[group].add(value);
    chip.setAttribute('aria-pressed', String(choices[group].has(value)));
  } else {
    choices[group] = value;
    form.querySelectorAll(`.chip[data-group="${group}"]`).forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
  }
  textarea.value = compose();
  fitTextarea();
});

textarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  plan();
});

const choicesForServer = () => Object.fromEntries(Object.entries(choices).map(([k, v]) => [k, v instanceof Set ? [...v] : v]));

/* ---------- what this server can do ---------- */

// GET /api/plan provides dates for the clearly labelled recorded examples.
let server = { recorded: {} };
fetch('api/plan')
  .then((r) => (r.ok ? r.json() : null))
  .then((status) => { if (status) server = status; })
  .catch(() => {});

const fmtRecorded = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Zurich' });

/* ---------- running a plan ---------- */

let runId = 0;

const submitLabel = submit.innerHTML;
function setRunning(running) {
  submit.disabled = running;
  submit.innerHTML = running ? 'Planning…' : submitLabel;
}

// Progress events (status, note, step) still stream from the server; the page
// only shows the result or the error.
function handleEvent(e) {
  if (e.type === 'result') renderResult(e);
  else if (e.type === 'error') showError(e.message, e.canUseRecording);
}

async function readNdjson(body, onEvent, myRun) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (myRun !== runId) return reader.cancel();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
    if (done) break;
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}

async function plan({ recorded = false } = {}) {
  const myRun = ++runId;
  setRunning(true);
  showWaiting();
  try {
    const res = await fetch('api/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(recorded ? { mode, recorded: true } : { mode, choices: choicesForServer() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `The planner answered with an error (${res.status}).`);
    }
    await readNdjson(res.body, handleEvent, myRun);
  } catch (err) {
    if (myRun !== runId) return;
    showError(err instanceof TypeError ? 'I couldn’t reach the Snow Day server. Check your connection.' : err.message, false);
  } finally {
    if (myRun === runId) setRunning(false);
  }
}

/* ---------- result ---------- */

function showEmpty() {
  resultEl.innerHTML = `<div class="empty" aria-hidden="true">
    <div class="card card--ghost"><span class="card__ghost-text">${mode === 'hike' ? 'Your hiking day' : 'Your ski day'}</span></div>
  </div>`;
}

function showWaiting() {
  resultEl.innerHTML = `<div class="empty waiting">
    <div class="cards" aria-hidden="true">
      <div class="card card--ghost card--pick"><span class="card__ghost-text">Checking the mountains…</span></div>
      <div class="card card--ghost"></div>
      <div class="card card--ghost"></div>
    </div>
    <p class="empty__text">This usually takes 5 to 30 seconds.</p>
  </div>`;
}

function showError(message, canUseRecording) {
  const rec = server.recorded?.[mode];
  const recording = canUseRecording && rec
    ? ` If you just want to see how it works, <button class="link-button" type="button" data-recorded>look at a recorded run from ${esc(fmtRecorded(rec.date))}</button>.`
    : '';
  const retry = /try again/i.test(message) ? '' : ' Try again in a minute.';
  resultEl.innerHTML = `<div class="notice error" role="alert"><strong>That didn’t work.</strong> ${esc(message)}${retry}${recording}</div>`;
  resultEl.querySelector('[data-recorded]')?.addEventListener('click', () => plan({ recorded: true }));
}

let current = null;

// Never a blank: a journey shows its duration, or says why there isn't one.
const journeyLabel = (j) => (!j ? 'Not checked' : j.status === 'ok' ? j.duration : j.message);
const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/* A small painted landscape for each card. The sun or cloud follows that
   resort's forecast for the day; the sky colour and mountain shape just vary. */

/** Illustration colours from the CSS tokens (per mode), with the original values as fallbacks. */
function artPalette() {
  const cs = getComputedStyle(document.documentElement);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    skies: [v('--art-sky-1', '#5378A3'), v('--art-sky-2', '#C3D6E5'), v('--art-sky-3', '#B9453F'), v('--art-sky-4', '#9DB7D2')],
    hikeSkies: [v('--art-sky-1', '#5378A3'), v('--art-sky-2', '#C3D6E5'), v('--art-sky-3', '#E7B96A'), v('--art-sky-4', '#9DB7D2')],
    snow: v('--art-snow', '#F5EEDC'),
    snowShade: v('--art-snow-shade', '#C3D6E5'),
    snowShadeOnLight: v('--cool', '#5378A3'),
    sun: v('--art-sun', '#F3D46A'),
    cloud: v('--art-cloud', '#F5EEDC'),
    rock: v('--art-rock', '#B9AD97'),
    rockShade: v('--art-rock-shade', '#8F8370'),
    grass: v('--art-grass', '#8EA676'),
    trail: v('--art-trail', '#B9453F'),
  };
}
const RANGES = [
  // Shapes run past the bottom edge so the print wobble never shows a gap.
  ['M-10 150V95L60 70L110 40L150 66L190 52L310 100V150Z', 'M110 40L120 75L95 150H210L190 52L150 66Z'],
  ['M-10 150V100L80 48L120 72L170 36L240 80L310 70V150Z', 'M170 36L175 66L150 150H260L240 80Z'],
  ['M-10 150V80L50 58L95 76L150 44L205 64L250 50L310 75V150Z', 'M150 44L160 82L130 150H230L205 64Z'],
];
function cardArt(index, day) {
  const p = artPalette();
  const sky = p.skies[index % p.skies.length];
  const [range, shade] = RANGES[index % RANGES.length];
  const lightSky = index % p.skies.length === 1 || index % p.skies.length === 3; // powder or pale blue
  const shadow = lightSky ? p.snowShadeOnLight : p.snowShade;
  const sunny = (day?.sunshineH ?? 0) >= 4;
  const sky2 = sunny
    ? `<circle cx="150" cy="46" r="16" fill="${p.sun}"/>`
    : `<path d="M120 42a10 10 0 0 1 18-8a12 12 0 0 1 22 4a8 8 0 0 1 2 16h-38a7 7 0 0 1-4-12z" fill="${p.cloud}" opacity=".9"/>`;
  return `<svg class="card__art" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="300" height="130" fill="${sky}"/>${sky2}
      <g filter="url(#litho)"><path d="${range}" fill="${p.snow}"/><path d="${shade}" fill="${shadow}" opacity=".75"/></g>
      <rect width="300" height="130" filter="url(#grain)" opacity=".08" style="mix-blend-mode:multiply"/>
    </svg>`;
}

function cardHtml({ id, dayIso, pick, selected, index }) {
  const r = current.resorts[id];
  const j = current.journeys[id];
  const ok = j?.status === 'ok';
  const day = current.forecasts[id]?.days.find((d) => d.date === dayIso);
  const time = journeyLabel(j);
  const label = `${r.name}, ${fmtDay(dayIso)}${day ? `, ski score ${day.score} out of 100` : ''}, ${ok ? `${time} by train from ${j.from}` : time}`;
  const datum = (name, text) => `<span class="card__datum">${icon(name)}${esc(text)}</span>`;
  return `<button type="button" class="card${pick ? ' card--pick' : ''}${ok ? '' : ' card--unreachable'}" data-id="${esc(id)}" aria-pressed="${selected}" aria-label="${esc(label)}">
      ${cardArt(index, day)}
      ${pick ? '<span class="card__stamp">My pick</span>' : ''}
      <span class="card__body">
        <span><span class="card__name">${esc(r.name)}</span><span class="card__date">${esc(fmtDay(dayIso, { weekday: 'long', day: 'numeric', month: 'short' }))}</span></span>
        ${day ? `<span class="card__data">
          ${datum('snow', `${day.freshSnowCm} cm fresh`)}
          ${datum('sun', `${day.sunshineH} h sun`)}
          ${datum('wind', `${day.gustMaxKmh} km/h gusts`)}
          ${datum('temp', `${day.tempMaxC} °C high`)}
        </span>` : ''}
        <span class="card__train">${icon(ok ? 'train' : 'none')}${esc(ok ? `${time} from ${j.from}` : time)}</span>
      </span>
    </button>`;
}

// Only a recorded run gets a note, so it's never mistaken for live data.
function sourceNote(e) {
  const { mode, recordedAt } = e.meta ?? {};
  if (mode !== 'recorded') return '';
  return `<p class="notice"><strong>Recorded run from ${esc(fmtRecorded(recordedAt))}.</strong> The live services couldn’t be reached, so this replays real forecast and timetable answers saved that day for the default request. Dates and times are as of then.</p>`;
}

function renderResult(e) {
  if (e.kind === 'hike') return renderHikeResult(e);
  current = e;
  const rec = e.recommendation;

  resultEl.innerHTML = `${sourceNote(e)}
    <div class="cards cards--enter" role="group" aria-label="Your options, best first">
      ${cardHtml({ id: rec.pick.resort_id, dayIso: rec.pick.day, pick: true, selected: true, index: 0 })}
      ${rec.alternatives.map((a, i) => cardHtml({ id: a.resort_id, dayIso: a.day ?? rec.pick.day, pick: false, selected: false, index: i + 1 })).join('')}
    </div>
    <h2 class="headline">${esc(rec.headline)}</h2>
    <p class="confidence"><b>${esc(rec.confidence[0].toUpperCase() + rec.confidence.slice(1))} confidence.</b> ${esc(rec.confidence_reason)}</p>
    <div id="detail" class="detail"></div>`;

  resultEl.querySelectorAll('.card[data-id]').forEach((btn) =>
    btn.addEventListener('click', () => {
      resultEl.querySelectorAll('.card[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderDetail(btn.dataset.id);
    }),
  );
  renderDetail(rec.pick.resort_id);
}

function factsHtml(day, elevationM) {
  if (!day) return '';
  const flag = (text) => (text ? `<span class="flag">${esc(text)}</span>` : '');
  const wind = day.flags.includes('lift_closures_likely') ? flagText('lift_closures_likely') : day.flags.includes('windy') ? 'Windy' : '';
  const season = day.flags.includes('outside_typical_season') ? flagText('outside_typical_season') : '';
  const base = day.flags.includes('thin_base') ? 'Thin base' : '';
  const row = (label, value, note = '') => `<div><dt>${esc(label)}</dt><dd>${esc(value)}${flag(note)}</dd></div>`;
  return `<dl class="facts">
    ${row('Ski score', `${day.score} out of 100`, season)}
    ${row('Fresh snow', `${day.freshSnowCm} cm`)}
    ${row(`Snow depth at ${elevationM.toLocaleString('en-GB')} m`, day.depthCm == null ? 'Not available' : `${day.depthCm} cm`, base)}
    ${row('Sunshine', `${day.sunshineH} h`)}
    ${row('Max gusts', `${day.gustMaxKmh} km/h`, wind)}
  </dl>`;
}

function journeyHtml(j) {
  if (!j) return '';
  if (j.status !== 'ok') return `<p class="detail__sub">By train: ${esc(j.message)}.</p>`;
  const lines = j.legs?.length ? ` (${j.legs.map((l) => l.line).join(', ')})` : '';
  return `<p class="detail__sub">By train: ${esc(j.duration)} from ${esc(j.from)}, leaving ${esc(j.departs)} and arriving ${esc(j.arrives)}${esc(lines)}.</p>`;
}

const ARROW = '<svg class="tickets__arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 11L11 5M6 5h5v5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function linksHtml(r) {
  let host = '';
  try { host = new URL(r.ticketsUrl).hostname.replace(/^www\./, ''); } catch { return ''; }
  return `<div class="resort-links">
    <a class="tickets" href="${esc(r.ticketsUrl)}" target="_blank" rel="noopener">
      <span class="tickets__label">Buy lift tickets</span>
      <span class="tickets__host">${esc(host)}</span>${ARROW}
      <span class="visually-hidden">on the official ${esc(r.name)} site (opens in a new tab)</span>
    </a>
    <a class="status-link" href="${esc(r.websiteUrl)}" target="_blank" rel="noopener">Check which lifts are open${ARROW}<span class="visually-hidden"> on the official ${esc(r.name)} site (opens in a new tab)</span></a>
  </div>`;
}

// The journey summary as a boarding pass: every value is from the timetable.
function passHtml(j, dayIso) {
  if (j?.status !== 'ok') return '';
  const cell = (label, value) => `<div><span class="pass__label">${esc(label)}</span><span class="pass__value">${esc(value)}</span></div>`;
  return `<div class="pass">
      <div class="pass__main">
        <div class="pass__route"><span>${esc(j.from)}</span><span class="pass__arrow" aria-hidden="true">→</span><span class="visually-hidden">to</span><span>${esc(j.to)}</span></div>
        <div class="pass__grid">
          ${cell('Departs', j.departs)}${cell('Arrives', j.arrives)}${cell('Journey', j.duration)}${cell('Changes', String(j.transfers))}
        </div>
      </div>
      <div class="pass__stub"><b>${esc(fmtDay(dayIso, { weekday: 'short' }))}</b><span class="pass__label">${esc(fmtDay(dayIso, { day: 'numeric', month: 'short' }))}</span></div>
    </div>`;
}

const MODE_NAMES = { train: 'Train', bus: 'Bus', cable: 'Cable car', flight: 'Flight', arrive: 'Arrival', walk: 'Walk', peak: 'High point', none: '' };

/** The door-to-door stops as a railway route map. */
function routeHtml(rows) {
  return `<ol class="route">${rows.map((s) => {
    const mode = s.mode ?? (s.kind === 'leg' ? 'train' : s.kind);
    return `<li class="route__stop route__stop--${esc(mode)}${s.kind === 'finish' ? ' route__stop--estimate' : ''}">
        <span class="route__time">${esc(s.label)}</span>
        <span class="route__icon">${icon(mode)}${MODE_NAMES[mode] ? `<span class="visually-hidden">${MODE_NAMES[mode]}: </span>` : ''}</span>
        <span class="route__what"><strong>${esc(s.title)}</strong>${s.detail ? `<span>${esc(s.detail)}</span>` : ''}</span>
      </li>`;
  }).join('')}</ol>`;
}

function timelineHtml(rows, j, dayIso) {
  if (!rows?.length) return '';
  const note = j?.status === 'ok' && j.flying
    ? `<p class="plan__note">Trains leave ${esc(j.from)} from 07:00. I compared both airports and kept the shorter connection.</p>`
    : '';
  return `<section class="plan" aria-labelledby="plan-title">
      <h4 id="plan-title" class="plan__title">Door to door</h4>
      ${passHtml(j, dayIso)}
      ${routeHtml(rows)}
      ${note}
    </section>`;
}

function renderDetail(id) {
  const rec = current.recommendation;
  const isPick = id === rec.pick.resort_id;
  const alt = rec.alternatives.find((a) => a.resort_id === id);
  const r = current.resorts[id];
  const f = current.forecasts[id];
  const dayIso = isPick ? rec.pick.day : alt?.day ?? rec.pick.day;
  const day = f?.days.find((d) => d.date === dayIso);
  const elevationM = f?.elevationM ?? r.forecastElevationM; // the height Open-Meteo actually used
  const detail = $('#detail');

  const heading = `<h3 class="detail__title">${esc(r.name)} on ${esc(fmtDay(dayIso, { weekday: 'long' }))}</h3>
    <p class="detail__sub">${esc(r.region)}. Village at ${r.villageM.toLocaleString('en-GB')} m, lifts to ${r.topM.toLocaleString('en-GB')} m.${r.glacier ? ' Has a glacier.' : ''}</p>`;

  const body = isPick
    ? `<ul class="reasons">${rec.pick.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : `<p class="verdict">${esc(alt?.verdict)}</p>${journeyHtml(current.journeys[id])}`;

  const watch = isPick && rec.watch_outs.length
    ? `<section class="watch" aria-labelledby="watch-title"><h4 id="watch-title" class="watch__title">Before you go</h4><ul>${rec.watch_outs.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></section>`
    : '';

  detail.innerHTML = `${heading}${body}${linksHtml(r)}${factsHtml(day, elevationM)}<div id="chart"></div>${isPick ? timelineHtml(current.timeline, current.journeys[id], dayIso) : ''}${watch}`;
  if (f) drawChart(f, dayIso, elevationM);
}

let chartArgs = null;
function drawChart(f, highlight, elevationM) {
  chartArgs = { kind: 'snow', days: f.days, highlight, elevationM };
  renderSnowChart($('#chart'), chartArgs);
}
const redrawChart = (host) => (chartArgs.kind === 'hike' ? renderHourlyChart(host, chartArgs) : renderSnowChart(host, chartArgs));

let lastWidth = 0;
new ResizeObserver(() => {
  const host = $('#chart');
  if (!host || !chartArgs) return;
  const w = host.clientWidth;
  if (Math.abs(w - lastWidth) > 24) {
    lastWidth = w;
    redrawChart(host);
  }
}).observe(resultEl);

/* ---------- hike results ---------- */

const MARKING_LABEL = { yellow: 'Hiking trail', 'white-red-white': 'Mountain trail', 'white-blue-white': 'Alpine route' };
const MARKING_CLASS = { yellow: 'hiking', 'white-red-white': 'mountain', 'white-blue-white': 'alpine' };

/** The trail's grade as a badge: Swiss marking colours when the source gives an SAC grade, otherwise the source's own word. */
function gradeBadge(t) {
  if (t.grade.marking) {
    const label = `${MARKING_LABEL[t.grade.marking]}${t.grade.sac ? ` ${t.grade.sac}` : ''}`;
    return `<span class="grade-badge"><span class="trail-mark trail-mark--${MARKING_CLASS[t.grade.marking]}" aria-hidden="true"></span>${esc(label)}<span class="visually-hidden"> (${esc(t.grade.marking.replaceAll('-', ' '))} markings)</span></span>`;
  }
  return `<span class="grade-badge grade-badge--plain" title="The source rates it ${esc(t.grade.sourceRating)} and gives no SAC grade">${esc(t.grade.sourceRating)}<span class="visually-hidden"> (the source's rating; no SAC grade given)</span></span>`;
}

const fmtMin = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};

/** A paper-cut landscape for a trail: no snow caps, grassy and rocky ridges, the trail dashed across. */
function hikeCardArt(index, t, day) {
  const p = artPalette();
  const sky = p.hikeSkies[index % p.hikeSkies.length];
  const [range, shade] = RANGES[index % RANGES.length];
  const sunny = (day?.sunshineH ?? 0) >= 4;
  const sky2 = sunny
    ? `<circle cx="150" cy="44" r="18" fill="${p.sun}"/>`
    : `<path d="M120 42a10 10 0 0 1 18-8a12 12 0 0 1 22 4a8 8 0 0 1 2 16h-38a7 7 0 0 1-4-12z" fill="${p.cloud}" opacity=".9"/>`;
  return `<svg class="card__art" viewBox="0 0 300 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="300" height="130" fill="${sky}"/>${sky2}
      <g filter="url(#litho)"><path d="${range}" fill="${p.rock}"/><path d="${shade}" fill="${p.rockShade}" opacity=".8"/>
        <path d="M-10 150V112C60 100 120 108 180 98S260 92 310 100V150Z" fill="${p.grass}"/></g>
      <path d="M18 122 C 70 112 90 92 150 ${index % 2 ? 70 : 64} S 240 96 286 108" fill="none" stroke="${p.trail}" stroke-width="2.2" stroke-dasharray="5 5" stroke-linecap="round"/>
      <rect width="300" height="130" filter="url(#grain)" opacity=".08" style="mix-blend-mode:multiply"/>
    </svg>`;
}

/** Start → high point → end, drawn to scale in height only: a schematic, not the real route. */
function profileHtml(t) {
  const els = [t.start.elevationM, t.highPoint.elevationM, t.end.elevationM];
  const lo = Math.min(...els) - 50;
  const hi = Math.max(...els) + 30;
  const y = (e) => (40 - ((e - lo) / (hi - lo)) * 34).toFixed(1);
  return `<span class="profile" role="img" aria-label="Schematic profile: start about ${t.start.elevationM} metres, high point ${t.highPoint.elevationM} metres, end about ${t.end.elevationM} metres">
      <svg viewBox="0 0 120 44" aria-hidden="true" focusable="false"><polyline points="4,${y(els[0])} 60,${y(els[1])} 116,${y(els[2])}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="60" cy="${y(els[1])}" r="2.4" fill="currentColor"/></svg>
      <span class="profile__label">Schematic</span>
    </span>`;
}

function hikeCardHtml({ id, dayIso, pick, selected, index }) {
  const t = current.trails[id];
  const trip = current.trips[id];
  const day = current.forecasts[id]?.days.find((d) => d.date === dayIso);
  const out = trip?.outbound;
  const ok = out?.status === 'ok';
  const label = `${t.name}, ${fmtDay(dayIso)}, ${t.distanceKm} kilometres, ${fmtMin(t.walkingTimeMin)} of walking, ${ok ? `${out.duration} by train from ${out.from}` : journeyLabel(out)}`;
  const datum = (name, text) => `<span class="card__datum">${icon(name)}${esc(text)}</span>`;
  return `<button type="button" class="card card--hike${pick ? ' card--pick' : ''}" data-id="${esc(id)}" aria-pressed="${selected}" aria-label="${esc(label)}">
      ${hikeCardArt(index, t, day)}
      ${pick ? '<span class="card__stamp">My pick</span>' : ''}
      <span class="card__body">
        <span><span class="card__name">${esc(t.name)}</span><span class="card__date">${esc(fmtDay(dayIso, { weekday: 'long', day: 'numeric', month: 'short' }))} · ${esc(t.region)}</span></span>
        <span class="card__trail">
          <span class="card__data">
            ${datum('peak', `${t.distanceKm} km`)}
            ${datum('walk', `${fmtMin(t.walkingTimeMin)} walking`)}
            ${datum('updown', `+${t.ascentM} / −${t.descentM} m`)}
            <span class="card__datum">${gradeBadge(t)}</span>
          </span>
          ${profileHtml(t)}
        </span>
        ${day ? `<span class="card__data">
          ${datum('sun', `${day.sunshineH} h sun`)}
          ${datum('rain', `${day.precipProbPct ?? 'n/a'}% rain`)}
          ${datum('temp', `${day.tempMaxC} °C high`)}
        </span>` : ''}
        <span class="card__train">${icon(ok ? 'train' : 'none')}${esc(ok ? `${out.duration} from ${out.from}` : journeyLabel(out))}</span>
      </span>
    </button>`;
}

function excludedHtml(list) {
  if (!list?.length) return '';
  const seen = new Set();
  const items = list.filter((x) => (seen.has(x.trail_id) ? false : seen.add(x.trail_id)));
  return `<section class="excluded" aria-labelledby="excluded-title">
      <h4 id="excluded-title" class="watch__title">Not suggested</h4>
      <ul>${items.map((x) => `<li><strong>${esc(x.name)}</strong>: ${esc(x.reason)}.</li>`).join('')}</ul>
    </section>`;
}

function renderHikeResult(e) {
  current = e;
  if (e.nothingFits) {
    const sugg = e.nothingFits.suggestions.map((s) => (s.type === 'mode'
      ? `<li><a href="?mode=snow" data-switch-mode="snow">${esc(s.text)}</a></li>`
      : `<li>${esc(s.text)}</li>`)).join('');
    resultEl.innerHTML = `${sourceNote(e)}
      <div class="nothing-fits" role="status">
        <h2 class="headline">Nothing fits those choices.</h2>
        <p class="confidence">${esc(e.nothingFits.message)}</p>
        <ul class="nothing-fits__list">${sugg}</ul>
      </div>
      ${excludedHtml(e.excluded)}`;
    resultEl.querySelector('[data-switch-mode]')?.addEventListener('click', (ev) => { ev.preventDefault(); setMode('snow', { push: true }); });
    return;
  }
  const rec = e.recommendation;
  resultEl.innerHTML = `${sourceNote(e)}
    <div class="cards cards--enter" role="group" aria-label="Your options, best first">
      ${hikeCardHtml({ id: rec.pick.trail_id, dayIso: rec.pick.day, pick: true, selected: true, index: 0 })}
      ${rec.alternatives.map((a, i) => hikeCardHtml({ id: a.trail_id, dayIso: a.day ?? rec.pick.day, pick: false, selected: false, index: i + 1 })).join('')}
    </div>
    <h2 class="headline">${esc(rec.headline)}</h2>
    <p class="confidence"><b>${esc(rec.confidence[0].toUpperCase() + rec.confidence.slice(1))} confidence.</b> ${esc(rec.confidence_reason)}</p>
    <div id="detail" class="detail"></div>
    ${excludedHtml(e.excluded)}`;
  resultEl.querySelectorAll('.card[data-id]').forEach((btn) =>
    btn.addEventListener('click', () => {
      resultEl.querySelectorAll('.card[data-id]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderHikeDetail(btn.dataset.id);
    }),
  );
  renderHikeDetail(rec.pick.trail_id);
}

/** Train out, the walk and the train home as a boarding pass; every time is from the timetable except the stated estimate. */
function hikePassHtml(trip, dayIso) {
  const { outbound: out, homebound: home, fit } = trip;
  if (out?.status !== 'ok' || home?.status !== 'ok') return '';
  const cell = (label, value) => `<div><span class="pass__label">${esc(label)}</span><span class="pass__value">${esc(value)}</span></div>`;
  return `<div class="pass">
      <div class="pass__main">
        <div class="pass__route"><span>${esc(out.from)}</span><span class="pass__arrow" aria-hidden="true">→</span><span class="visually-hidden">to</span><span>${esc(out.to)}</span><span class="pass__arrow" aria-hidden="true">⋯</span><span class="visually-hidden">walk to</span><span>${esc(home.from)}</span></div>
        <div class="pass__grid">
          ${cell('Train out', `${out.departs}–${out.arrives}`)}${cell('Finish (est.)', fit.finish)}${cell('Last good train home', home.departs)}${cell('Spare', `${fit.spareMin} min`)}
        </div>
      </div>
      <div class="pass__stub"><b>${esc(fmtDay(dayIso, { weekday: 'short' }))}</b><span class="pass__label">${esc(fmtDay(dayIso, { day: 'numeric', month: 'short' }))}</span></div>
    </div>`;
}

function beforeYouGoHtml(t, rec, links, isPick) {
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
  const items = [
    `<li><a href="${esc(t.sourceUrl)}" target="_blank" rel="noopener">Trail details from ${esc(host(t.sourceUrl))}${ARROW}</a>: where every figure on this trail comes from.</li>`,
    ...(t.lift ? t.lift.statusUrls.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">Lift status on ${esc(host(u))}${ARROW}</a>: ${esc(t.lift.name)}.</li>`) : []),
    `<li><a href="${esc(links.meteoSwiss)}" target="_blank" rel="noopener">MeteoSwiss warnings${ARROW}</a>: check for thunderstorms on the morning.</li>`,
    ...(isPick ? rec.watch_outs.filter((w) => !/MeteoSwiss|relies on lifts/.test(w)).map((w) => `<li>${esc(w)}</li>`) : []),
  ];
  return `<section class="watch" aria-labelledby="watch-title"><h4 id="watch-title" class="watch__title">Before you go</h4><ul>${items.join('')}</ul></section>`;
}

function renderHikeDetail(id) {
  const rec = current.recommendation;
  const isPick = id === rec.pick.trail_id;
  const alt = rec.alternatives.find((a) => a.trail_id === id);
  const t = current.trails[id];
  const f = current.forecasts[id];
  const dayIso = isPick ? rec.pick.day : alt?.day ?? rec.pick.day;
  const day = f?.days.find((d) => d.date === dayIso);
  const trip = current.trips[id];
  const detail = $('#detail');

  const heading = `<h3 class="detail__title">${esc(t.name)} on ${esc(fmtDay(dayIso, { weekday: 'long' }))}</h3>
    <p class="detail__sub">${esc(t.region)}. ${esc(t.start.name)} to ${esc(t.end.name)}: ${t.distanceKm} km, ${esc(fmtMin(t.walkingTimeMin))} official walking time, +${t.ascentM} m / −${t.descentM} m. Forecast at ${f.elevationM.toLocaleString('en-GB')} m.</p>`;
  const body = isPick
    ? `<ul class="reasons">${rec.pick.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : `<p class="verdict">${esc(alt?.verdict)}</p>`;
  const plan = trip ? `<section class="plan" aria-labelledby="plan-title">
      <h4 id="plan-title" class="plan__title">Door to door</h4>
      ${hikePassHtml(trip, dayIso)}
      ${isPick ? routeHtml(current.timeline) : ''}
      <p class="plan__note">The finish time is an estimate: the official walking time plus 15%. Every train time is from the Swiss timetable; "last good train home" is the last one back to ${esc(trip.homebound.to ?? trip.outbound.from)} by ${esc(current.links.returnBy)}.</p>
    </section>` : '';

  detail.innerHTML = `${heading}${body}<div id="chart"></div>${plan}${beforeYouGoHtml(t, rec, current.links, isPick)}`;
  if (day?.hours?.length) {
    chartArgs = { kind: 'hike', hours: day.hours, date: dayIso, elevationM: f.elevationM, sunrise: day.sunrise, sunset: day.sunset };
    renderHourlyChart($('#chart'), chartArgs);
  }
}

/* ---------- start ---------- */

setMode(mode);
