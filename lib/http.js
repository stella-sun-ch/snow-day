// Cached JSON fetching for the two public APIs Snow Day uses.
//
// Both are free and keyless, so we are polite: each response is kept for a
// while (15 min for forecasts, 60 min for timetables) and identical requests
// that arrive at the same time share one network call. Each fetch
// implementation gets its own cache, so tests with different fakes never see
// each other's data. On serverless, a warm instance keeps its cache between
// requests; a cold one starts empty.

const caches = new WeakMap();

function cacheFor(fetchImpl) {
  let c = caches.get(fetchImpl);
  if (!c) {
    c = new Map();
    caches.set(fetchImpl, c);
  }
  return c;
}

/**
 * GET a URL as JSON, with a time-to-live cache.
 * @returns {Promise<{json: any, fetchedAt: number}>} fetchedAt is when the data
 *   actually came from the API (not when it was served from the cache).
 */
export async function getJson(url, { fetchImpl = fetch, ttlMs, timeoutMs = 10_000, now = Date.now, label = 'service' }) {
  const cache = cacheFor(fetchImpl);
  const hit = cache.get(url);
  if (hit && (hit.pending || now() - hit.fetchedAt < ttlMs)) return hit.pending ?? hit.value;

  const pending = (async () => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`The ${label} answered with HTTP ${res.status}.`);
    return { json: await res.json(), fetchedAt: now() };
  })();
  cache.set(url, { pending });
  try {
    const value = await pending;
    cache.set(url, { value, fetchedAt: value.fetchedAt });
    return value;
  } catch (err) {
    cache.delete(url); // don't remember failures
    throw err;
  }
}
