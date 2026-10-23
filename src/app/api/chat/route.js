// POST /api/chat  { id, horizon?, ft?, league?, messages: [{ role, content }] }
//   Matchday AI's transfer chat (src/lib/chat.mjs): answers the manager's latest message
//   from our numbers. The answer streams as lines of JSON: { t: 'status', text } while it looks
//   things up, { t: 'text', d } for each piece of it, then { t: 'done' } or { t: 'error', error }.
// Never cached at the CDN: it's a POST, and every answer is one manager's. Each manager's numbers
// are kept here for five minutes, so a conversation sees the same ones (and the model's prompt
// cache holds); a daily ceiling stops runaway use.
import { getStatic, getFixtures, getEntry, getNextSquad } from '@/lib/fpl-server.mjs';
import { makeKit, makeCtx } from '@/lib/kit.mjs';
import { chatEnabled, chatWorld, chatTurns, runChat, chatError } from '@/lib/chat.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT || 400);
const worlds = new Map();
let day = '';
let used = 0;

const json = (body, status) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const id10 = (v) => (Number.isInteger(v) && v > 0 && v < 1e10 ? v : null);

async function data(path, req) {
  const res = await fetch(new URL(`/data/pl/${path}`, req.url));
  if (!res.ok) throw new Error(`Matchup data ${res.status}`);
  return res.json();
}

/** One of this site's own CDN-cached routes, or null if it fails or is slow. */
async function cached(path, req) {
  try {
    const res = await fetch(new URL(path, req.url), { signal: AbortSignal.timeout(6000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  const id = id10(body?.id);
  const horizon = [3, 5, 8].includes(body?.horizon) ? body.horizon : 5;
  const ft = Number.isInteger(body?.ft) && body.ft >= 0 && body.ft <= 5 ? body.ft : null;
  const leagueAsked = id10(body?.league);
  const messages = chatTurns(body?.messages);
  if (!id) return json({ error: 'Need an FPL team id' }, 400);
  if (!messages) return json({ error: 'Ask a question first' }, 400);
  if (!chatEnabled()) return json({ error: 'Matchday AI is switched off on this server.' }, 503);
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  if (used >= DAILY_LIMIT) return json({ error: 'Today’s Matchday AI limit is used up. The Planner’s numbers still work; try again tomorrow.' }, 429);

  let world;
  const key = `${id}:${horizon}:${ft ?? ''}:${leagueAsked ?? ''}`;
  const hit = worlds.get(key);
  if (hit && Date.now() - hit.at < 5 * 60e3) world = hit.world;
  else {
    try {
      const st = await getStatic();
      const [fixtures, entry, ix, learned, odds, season, setpieces] = await Promise.all([
        getFixtures(),
        getEntry(id, st.current),
        data('index.json', req),
        data('netxg-model.json', req),
        cached('/api/odds', req),
        cached('/api/fpl/season', req),
        data('setpieces.json', req).catch(() => null),
      ]);
      if (!entry?.gw) return json({ error: `FPL has no picks for team ${id} yet` }, 404);
      // Only a league the team is in, from the same cached route the League tab reads.
      const leagueId = leagueAsked && entry.leagues.some((l) => l.id === leagueAsked) ? leagueAsked : null;
      const [next, league] = await Promise.all([getNextSquad(id, entry, st.current), leagueId ? cached(`/api/fpl/league/${leagueId}/${st.current}`, req) : null]);
      const kit = makeKit(ix, learned);
      const ctx = makeCtx(st, kit, undefined, odds?.fixtures ?? null);
      world = chatWorld({ st, fixtures, entry, next, ctx, ix, season, setpieces, league, horizon, free: ft, load: (path) => data(path, req) });
      worlds.set(key, { at: Date.now(), world });
      if (worlds.size > 30) worlds.delete(worlds.keys().next().value);
    } catch (e) {
      return json({ error: e.message || 'Couldn’t load your team' }, 502);
    }
  }

  used += 1;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o) => {
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`));
        } catch {
          // The page went away; nothing to tell it.
        }
      };
      try {
        await runChat({ world, messages, emit, signal: req.signal });
        emit({ t: 'done' });
      } catch (e) {
        emit({ t: 'error', error: chatError(e) });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
