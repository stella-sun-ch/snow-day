// Snow and Hike modes share the same API, data caching, recorded examples,
// and streaming interface. Each mode owns its scoring and recommendations.

import { planSnowDay, cleanChoices as cleanSnowChoices } from './planner.js';

export const MODES = {
  snow: { cleanChoices: cleanSnowChoices, plan: planSnowDay },
  hike: null, // registered in hike.js
};

export const MODE_IDS = ['snow', 'hike'];
export const cleanMode = (m) => (MODE_IDS.includes(m) ? m : 'snow');

export function registerMode(id, impl) { MODES[id] = impl; }
