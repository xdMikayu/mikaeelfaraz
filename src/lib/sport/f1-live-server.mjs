// Reads F1's live timing for /api/sport/f1/live.
//
// F1's feed (livetiming.formula1.com/signalrcore) gives out the timing without a login, but only
// F1's own site may read it from a browser. So the route reads it: connect, subscribe, take the
// full state that comes back, hang up. That takes about two seconds. The CDN then keeps each answer
// for a few seconds, so F1 sees one connection every few seconds however many people are watching.
//
// Other sources:
//   - F1_LIVE_URL reads a state from somewhere else instead: scripts/sport/f1-replay.mjs when testing.
//   - OpenF1 (f1-openf1.mjs) is the fallback when F1's feed fails, for anyone who sets up its paid tier.

import { tower } from './f1-live.mjs';
import { openF1Ready, fromOpenF1 } from './f1-openf1.mjs';

const BASE = 'https://livetiming.formula1.com/signalrcore';
const UA = { 'user-agent': 'Mozilla/5.0 (personal F1 pages; mikaeelfaraz.com)' };
const RS = '\x1e'; // ends each SignalR message

/** The topics the live view reads. Car telemetry and positions need an F1 TV login, so they aren't here. */
export const TOPICS = ['SessionInfo', 'SessionStatus', 'SessionData', 'TrackStatus', 'LapCount', 'DriverList', 'TimingData', 'TimingAppData', 'RaceControlMessages', 'ExtrapolatedClock', 'WeatherData'];

/** One full state of F1's feed, by SignalR's long-polling transport, which plain HTTP requests can do. */
export async function fromF1({ timeout = 8000 } = {}) {
  const signal = AbortSignal.timeout(timeout);
  // F1's load balancer pins a connection to one server with cookies.
  const jar = new Map();
  const call = async (url, init = {}) => {
    const headers = { ...UA, ...init.headers };
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(url, { ...init, headers, signal: init.signal ?? signal, cache: 'no-store' });
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
  const poll = async () => (await call(url)).text();
  try {
    await poll();
    await send({ protocol: 'json', version: 1 });
    await poll();
    await send({ type: 1, invocationId: '1', target: 'Subscribe', arguments: [TOPICS] });
    // The answer to Subscribe (type 3) carries every topic's full state.
    for (let i = 0; i < 4; i++) {
      for (const part of (await poll()).split(RS)) {
        let m;
        try {
          m = JSON.parse(part);
        } catch {
          continue;
        }
        if (m.type === 3 && m.invocationId === '1') {
          if (m.error || !m.result) throw new Error(`F1’s live timing refused: ${m.error ?? 'no state'}`);
          return m.result;
        }
        if (m.type === 7) throw new Error(`F1’s live timing closed the connection${m.error ? `: ${m.error}` : ''}`);
      }
    }
    throw new Error('F1’s live timing sent no state');
  } finally {
    // Hang up, so F1 isn't left holding the connection open.
    await call(url, { method: 'DELETE', signal: AbortSignal.timeout(1500) }).catch(() => {});
  }
}

/** A state in F1's shape from a URL, with the moment it stands for in "_at" (the replay script). */
async function fromUrl(url) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** The live view's data now: from F1, or the replay when testing, or OpenF1 if F1 fails. */
export async function liveState() {
  if (process.env.F1_LIVE_URL) {
    const raw = await fromUrl(process.env.F1_LIVE_URL);
    return tower(raw, { at: raw._at ? Date.parse(raw._at) : Date.now(), source: 'replay' });
  }
  try {
    const raw = await fromF1();
    return tower(raw, { at: Date.now(), source: 'f1' });
  } catch (e) {
    if (!openF1Ready()) throw e;
    return fromOpenF1();
  }
}
