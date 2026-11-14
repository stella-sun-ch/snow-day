import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/plan.js';

function response() {
  const chunks = [];
  const res = {
    statusCode: 200,
    headers: {},
    chunks,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; },
    write(s) { chunks.push(s); },
    end() { this.ended = true; },
  };
  return res;
}

test('the status endpoint only exposes available recorded examples', async () => {
  const res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body.recorded.snow?.date);
  assert.ok(res.body.recorded.hike?.date);
  assert.deepEqual(Object.keys(res.body), ['recorded']);
});

for (const mode of ['snow', 'hike']) {
  test(`${mode} recorded example produces a complete result without network access`, async () => {
    const res = response();
    await handler({
      method: 'POST', headers: {}, socket: { remoteAddress: `offline-test-${mode}` },
      body: { mode, recorded: true },
    }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /application\/x-ndjson/);
    const events = res.chunks.join('').trim().split('\n').map(JSON.parse);
    const final = events.at(-1);
    assert.equal(final.type, 'result');
    assert.equal(final.meta.activity, mode);
    assert.equal(final.meta.mode, 'recorded');
    assert.ok(final.recommendation?.pick || final.nothingFits);
    assert.equal(res.ended, true);
  });
}
