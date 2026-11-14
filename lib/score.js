// The ski score: a transparent 0–100 rating for one resort on one day.
//
// Keep scoring deterministic: every number in a recommendation can be
// reproduced from the forecast data and these explicit weights.

export const STYLES = ['balanced', 'powder', 'sunny'];

// Each style's weights add up to 100.
const WEIGHTS = {
  balanced: { powder: 35, base: 20, sun: 30, comfort: 15 },
  powder:   { powder: 55, base: 20, sun: 15, comfort: 10 },
  sunny:    { powder: 15, base: 20, sun: 45, comfort: 20 },
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** 1 when the day's high is between -8 °C and 2 °C, fading to 0 at -20 °C and 10 °C. */
export function temperatureComfort(tMaxC) {
  if (tMaxC == null) return 0.5;
  if (tMaxC < -8) return clamp((tMaxC + 20) / 12, 0, 1);
  if (tMaxC > 2) return clamp((10 - tMaxC) / 8, 0, 1);
  return 1;
}

/**
 * Fresh snow worth skiing on day i: the night before counts in full, the day
 * before that half, and snow falling during the day itself half (it's fresh,
 * but you're skiing in it).
 */
export function freshSnowCm(snowfall, i) {
  const at = (k) => (k >= 0 && k < snowfall.length ? snowfall[k] ?? 0 : 0);
  return Math.round(0.5 * at(i - 2) + at(i - 1) + 0.5 * at(i));
}

/**
 * @param {object} day
 * @param {number} day.freshSnowCm
 * @param {number} day.snowfallCm      snow falling during the day
 * @param {number|null} day.depthCm    snow on the ground at mid-mountain
 * @param {number} day.sunshineH
 * @param {number} day.tempMaxC
 * @param {number} day.gustMaxKmh
 * @param {number} day.rainMm
 * @param {boolean} day.inSeason
 * @param {'balanced'|'powder'|'sunny'} [style]
 * @returns {{score: number, flags: string[]}}
 */
export function scoreDay(day, style = 'balanced') {
  const w = WEIGHTS[style] ?? WEIGHTS.balanced;
  const flags = [];

  const powder = clamp(day.freshSnowCm / 30, 0, 1);
  const base = day.depthCm == null ? 0.5 : clamp((day.depthCm - 30) / 90, 0, 1);
  const sun = clamp(day.sunshineH / 7, 0, 1);
  const comfort = temperatureComfort(day.tempMaxC);

  let score = w.powder * powder + w.base * base + w.sun * sun + w.comfort * comfort;

  if (day.gustMaxKmh >= 70) {
    score -= 30;
    flags.push('lift_closures_likely');
  } else if (day.gustMaxKmh >= 50) {
    score -= 12;
    flags.push('windy');
  }
  if (day.rainMm >= 2) {
    score -= 20;
    flags.push('rain');
  }
  if (day.snowfallCm >= 15) {
    score -= style === 'powder' ? 4 : 8;
    flags.push('heavy_snowfall_poor_visibility');
  }
  if (day.depthCm != null && day.depthCm < 30) flags.push('thin_base');
  if (day.inSeason === false) {
    score = Math.min(score, 10);
    flags.push('outside_typical_season');
  }

  return { score: Math.round(clamp(score, 0, 100)), flags };
}
