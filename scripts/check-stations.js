// Checks that every station in the config still resolves on
// transport.opendata.ch to the id we store. Run by hand (it needs the
// network), not in CI: `npm run stations:check`.

import { TRAILS } from '../lib/trails.js';
import { RESORTS } from '../lib/resorts.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const stations = [
  ...RESORTS.map((r) => ({ owner: r.id, ...r.station })),
  ...TRAILS.filter((t) => t.verified).flatMap((t) => [
    { owner: `${t.id} (start)`, ...t.startStation },
    { owner: `${t.id} (end)`, ...t.endStation },
  ]),
];

let problems = 0;
for (const s of stations) {
  const url = `https://transport.opendata.ch/v1/locations?type=station&query=${encodeURIComponent(s.name)}`;
  const json = await (await fetch(url)).json();
  const hit = (json.stations ?? []).find((x) => String(x.id) === String(s.id));
  const first = json.stations?.[0];
  const ok = Boolean(hit);
  if (!ok) problems += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.owner.padEnd(32)} ${s.name} #${s.id}${ok ? '' : ` (first match: ${first ? `${first.name} #${first.id}` : 'none'})`}`);
  await pause(350);
}
console.log(problems ? `\n${problems} station(s) did not resolve.` : '\nAll stations resolve.');
process.exitCode = problems ? 1 : 0;
