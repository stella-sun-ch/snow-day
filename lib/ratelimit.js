// Best-effort rate limit: N plans per IP per hour, kept in memory.
// On serverless each warm instance has its own memory, so this is a speed
// bump, not a guarantee across separate serverless instances.

const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR ?? 12);
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map();

export function allow(ip, now = Date.now()) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}
