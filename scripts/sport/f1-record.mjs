#!/usr/bin/env node
// Records F1's live timing while a session runs, for scripts/sport/f1-replay.mjs to play back. F1's
// archive of past sessions now asks for a login, so a session worth trying the live view on has to
// be kept as it happens.
//
//   node scripts/sport/f1-record.mjs recordings/2026-cota-quali.log --minutes 90
//   node scripts/sport/f1-replay.mjs --file recordings/2026-cota-quali.log --at 25:00
//
// It holds one connection open (SignalR's long polling, as the live route does briefly) and writes
// every message as it comes, one per line: "<ms since the recording began> <UTC time> <topic> <json>".
// The answer to the subscription is the full state of every topic, written as "STATE"; after a
// dropped connection it reconnects and writes the full state again. Behind a proxy that Node's fetch
// doesn't use by itself, run it with NODE_USE_ENV_PROXY=1.

import fs from 'node:fs';
import path from 'node:path';
import { TOPICS } from '../../src/lib/sport/f1-live-server.mjs';

const BASE = 'https://livetiming.formula1.com/signalrcore';
const UA = { 'user-agent': 'Mozilla/5.0 (personal F1 pages; mikaeelfaraz.com)' };
const RS = '\x1e';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const minutesAt = args.indexOf('--minutes');
const minutes = minutesAt >= 0 ? Number(args[minutesAt + 1]) : 120;
if (!file) {
  console.error('Give a file to write, such as recordings/2026-cota-quali.log');
  process.exit(1);
}
fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
const out = fs.createWriteStream(file, { flags: 'a' });
const began = Date.now();
const until = began + minutes * 60e3;
const write = (topic, data) => out.write(`${Date.now() - began} ${new Date().toISOString()} ${topic} ${JSON.stringify(data)}\n`);

/** One connection: subscribe, then write every message until it drops or the time is up. */
async function connection() {
  // F1's load balancer pins a connection to one server with cookies.
  const jar = new Map();
  const call = async (url, init = {}) => {
    const headers = { ...UA, ...init.headers };
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(60000), cache: 'no-store' });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      const i = kv.indexOf('=');
      if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
    if (!res.ok) throw new Error(`F1’s live timing answered ${res.status}`);
    return res;
  };
  const neg = await (await call(`${BASE}/negotiate?negotiateVersion=1`, { method: 'POST' })).json();
  if (!neg.connectionToken) throw new Error('F1’s live timing gave no connection');
  const url = `${BASE}?id=${encodeURIComponent(neg.connectionToken)}`;
  const send = (message) => call(url, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(message) + RS });
  try {
    await call(url);
    await send({ protocol: 'json', version: 1 });
    await call(url);
    await send({ type: 1, invocationId: '1', target: 'Subscribe', arguments: [[...TOPICS, 'Heartbeat']] });
    while (Date.now() < until) {
      for (const part of (await (await call(url)).text()).split(RS)) {
        let m;
        try {
          m = JSON.parse(part);
        } catch {
          continue;
        }
        if (m.type === 3 && m.invocationId === '1') write('STATE', m.result);
        else if (m.type === 1 && m.target === 'feed') write(m.arguments[0], m.arguments[1]);
        else if (m.type === 7) throw new Error(`F1’s live timing closed the connection${m.error ? `: ${m.error}` : ''}`);
      }
    }
  } finally {
    await call(url, { method: 'DELETE', signal: AbortSignal.timeout(1500) }).catch(() => {});
  }
}

console.log(`Recording F1’s live timing to ${file} for ${minutes} minutes`);
let wait = 2000;
while (Date.now() < until) {
  try {
    await connection();
    wait = 2000;
  } catch (e) {
    // Back off when F1 keeps saying no, so a closed feed isn't asked every two seconds.
    console.error(`${new Date().toISOString()} ${e.message}; again in ${wait / 1000} s`);
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(60000, wait * 2);
  }
}
out.end();
