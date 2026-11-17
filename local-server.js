// Local development server with zero dependencies: `npm run dev`.
// Serves public/ and routes POST /api/plan to the same handler Vercel runs.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import planHandler from './api/plan.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const PORT = Number(process.env.PORT ?? 3000);

// Load .env without a dependency (KEY=value lines; # comments).
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
};

// Give Node's response the small Vercel-style helpers the handler uses.
function withHelpers(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) break;
  }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

const server = http.createServer(async (req, res) => {
  withHelpers(res);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/plan') {
    req.body = req.method === 'POST' ? await readJson(req) : {};
    return planHandler(req, res);
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const file = join(publicDir, rel === '' ? 'index.html' : rel);
  if (!file.startsWith(publicDir)) return res.status(403).end('Forbidden');
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.status(404).end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Snow Day on http://localhost:${PORT} (live forecasts and trains; recorded examples available)`);
});
