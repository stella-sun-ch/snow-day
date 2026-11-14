// Checks every text/background pair in both themes against WCAG AA, using the
// tokens in public/styles.css. `npm run contrast` prints the table; the test
// suite runs the same check.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = new URL('../public/styles.css', import.meta.url);

// [foreground, background, minimum ratio, where it's used]
export const PAIRS = [
  ['ink', 'bg', 4.5, 'body text on the page'],
  ['ink', 'surface', 4.5, 'text on cards, inputs and the ticket'],
  ['ink', 'band', 4.5, 'ticket header and pass stub'],
  ['muted', 'bg', 4.5, 'secondary text on the page'],
  ['muted', 'surface', 4.5, 'secondary text on cards'],
  ['muted', 'band', 4.5, 'labels on the pass stub'],
  ['accent-ink', 'accent', 4.5, 'selected chips and the main button'],
  ['accent-ink', 'accent-hover', 4.5, 'the main button on hover'],
  ['highlight', 'bg', 4.5, 'small highlight text: your day, warnings'],
  ['highlight', 'surface', 4.5, 'highlight text on cards and the chart'],
  ['bg', 'ink', 4.5, 'tooltip text'],
  ['poster-ink', 'poster-bg', 4.5, 'poster title, wordmark and switch'],
  ['poster-muted', 'poster-bg', 4.5, 'poster subtitle'],
  ['poster-bg', 'poster-ink', 4.5, 'the active mode in the switch'],
  ['accent', 'surface', 3, 'selected chip edge against the ticket (non-text)'],
  ['ink', 'surface', 3, 'chip and input borders (non-text)'],
];

function tokens(block) {
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

/** The hex tokens for each mode, read from the stylesheet. */
export function themeTokens(css = readFileSync(CSS, 'utf8')) {
  const block = (start) => {
    const i = css.indexOf(start);
    if (i < 0) throw new Error(`No "${start}" block in styles.css`);
    return css.slice(i, css.indexOf('\n}', i));
  };
  return { hike: tokens(block(':root, [data-mode="hike"] {')), snow: tokens(block('[data-mode="snow"] {')) };
}

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export function checkContrast(themes = themeTokens()) {
  const rows = [];
  for (const [mode, t] of Object.entries(themes)) {
    for (const [fg, bg, min, use] of PAIRS) {
      if (!t[fg] || !t[bg]) throw new Error(`${mode}: missing token --${!t[fg] ? fg : bg}`);
      const r = ratio(t[fg], t[bg]);
      rows.push({ mode, fg, bg, ratio: Math.round(r * 100) / 100, min, pass: r >= min, use });
    }
  }
  return rows;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = checkContrast();
  for (const r of rows) {
    console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.mode.padEnd(5)} ${`--${r.fg} on --${r.bg}`.padEnd(32)} ${r.ratio.toFixed(2).padStart(6)} (needs ${r.min})  ${r.use}`);
  }
  const failed = rows.filter((r) => !r.pass).length;
  console.log(failed ? `\n${failed} pair(s) fail WCAG AA.` : '\nEvery pair meets WCAG AA.');
  process.exitCode = failed ? 1 : 0;
}
