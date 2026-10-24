#!/usr/bin/env node
// Plays an F1 session back as if it were live, so the live view can be tried outside a race weekend.
// It reads a session F1 archived at livetiming.formula1.com/static (F1 has since put that archive
// behind a login), or one recorded live with scripts/sport/f1-record.mjs (--file), applies the
// updates up to the moment asked for, and serves that state the way the live route reads F1's.
//
//   node scripts/sport/f1-replay.mjs 2026/2026-10-11_Singapore_Grand_Prix/2026-10-11_Race --at 1:05:00 --speed 5
//   node scripts/sport/f1-replay.mjs --file recordings/2026-cota-quali.log --at 25:00
//   F1_LIVE_URL=http://127.0.0.1:8098/state npm run dev
//
//   --file   a recording from f1-record.mjs instead of the archive; --at then counts from its start
//   --at     how far into the session to start: 1:05:00, or -10:00 for before it (default 0)
//   --speed  how fast it plays (default 1)
//   --when   pretend the session starts at this time instead (an ISO time), moving every time in
//            it: to try the live view on an upcoming weekend's page
//   --port   default 8098
//   --cache  where to keep the downloads (default .f1-replay-cache)
//
// GET /state?at=1:05:00 answers for that moment without moving the clock; /seek?at=… moves it.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { merge, parseStream } from '../../src/lib/sport/f1-live.mjs';
import { TOPICS } from '../../src/lib/sport/f1-live-server.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const session = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))?.replace(/\/?$/, '/');
const file = opt('file', null);
if (!session && !file) {
  console.error('Give a session path, such as 2026/2026-10-11_Singapore_Grand_Prix/2026-10-11_Race, or --file with a recording');
  process.exit(1);
}
const speed = Number(opt('speed', 1));
const when = opt('when', null);
const port = Number(opt('port', 8098));
const cache = session ? path.resolve(opt('cache', '.f1-replay-cache'), session) : null;

/** "1:05:00", "-10:00" or "90" (seconds) as milliseconds. */
const ms = (t) => {
  const neg = String(t).startsWith('-');
  const parts = String(t).replace('-', '').split(':').map(Number);
  const s = parts.reduce((a, b) => a * 60 + b, 0);
  return (neg ? -1 : 1) * s * 1000;
};

async function stream(topic) {
  const file = path.join(cache, `${topic}.jsonStream`);
  if (!fs.existsSync(file)) {
    const res = await fetch(`https://livetiming.formula1.com/static/${session}${topic}.jsonStream`);
    if (res.status === 404 || res.status === 403) return [];
    if (!res.ok) throw new Error(`${topic}: ${res.status}`);
    fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(file, await res.text());
  }
  return parseStream(fs.readFileSync(file, 'utf8'));
}

/** A recording from f1-record.mjs: [ms, topic, update] with "STATE" for a full state, and its start in UTC. */
function recording(name) {
  const rows = [];
  let base = null;
  for (const line of fs.readFileSync(name, 'utf8').split('\n')) {
    const m = line.match(/^(\d+) (\S+) (\S+) (.+)$/);
    if (!m) continue;
    base ??= Date.parse(m[2]) - Number(m[1]);
    rows.push([Number(m[1]), m[3], JSON.parse(m[4])]);
  }
  return { rows, base };
}

const updates = [];
let start = 0;
let base = Date.now();
if (file) {
  // A recording counts from when it began, which is wherever in the session it was started.
  const r = recording(file);
  updates.push(...r.rows);
  base = r.base ?? base;
} else {
  for (const t of [...TOPICS, 'Heartbeat']) for (const [at, u] of await stream(t)) updates.push([at, t, u]);
  updates.sort((a, b) => a[0] - b[0]);
  // The session starts when its status first says "Started"; the heartbeat ties the archive to UTC.
  start = updates.find(([, t, u]) => t === 'SessionStatus' && u.Status === 'Started')?.[0] ?? 0;
  const beat = updates.find(([, t, u]) => t === 'Heartbeat' && u.Utc);
  if (beat) base = Date.parse(beat[2].Utc) - beat[0];
}
if (!updates.length) throw new Error(`Nothing to play in ${file ?? session}`);

/** Every topic's state at a moment of the recording. */
function stateAt(t) {
  let state = {};
  for (const [at, topic, u] of updates) {
    if (at > t) break;
    if (topic === 'STATE') state = structuredClone(u);
    else state[topic] = merge(state[topic], structuredClone(u));
  }
  return state;
}

// With --when, every time in the state moves by the same whole number of seconds.
const startUtc = base + start;
const shift = when ? Math.round((Date.parse(when) - startUtc) / 1000) * 1000 : 0;
const moved = (json) =>
  shift ? json.replace(/"(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(\.\d+)?(Z?)"/g, (_, t, frac = '', z) => `"${new Date(Date.parse(`${t}Z`) + shift).toISOString().slice(0, 19)}${frac}${z}"`) : json;

let from = start + ms(opt('at', '0'));
let since = Date.now();
const now = () => from + (Date.now() - since) * speed;

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/seek') {
      from = start + ms(url.searchParams.get('at') ?? '0');
      since = Date.now();
    }
    if (url.pathname !== '/state' && url.pathname !== '/seek') {
      res.writeHead(404).end();
      return;
    }
    const t = url.searchParams.has('at') && url.pathname === '/state' ? start + ms(url.searchParams.get('at')) : now();
    const body = moved(JSON.stringify({ ...stateAt(t), _at: new Date(base + t).toISOString() }));
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }).end(body);
  })
  .listen(port, '127.0.0.1', () => {
    const clock = (x) => new Date(Math.abs(x)).toISOString().slice(11, 19);
    console.log(`${file ?? session} from ${from < start ? '-' : ''}${clock(from - start)} into the ${file ? 'recording' : 'session'} at ${speed}×: http://127.0.0.1:${port}/state`);
  });
