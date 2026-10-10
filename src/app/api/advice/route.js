// GET /api/sport/advice?id=<FPL team>&ft=<free transfers, optional>
// Claude's plan for the next deadline, built on our projections (src/lib/sport/advice.mjs).
// Public, so it guards the bill: the CDN keeps each answer for 30 minutes per team, the function
// keeps its own copy, and a daily ceiling stops runaway use.
import { getStatic, getFixtures, getEntry } from '@/lib/sport/fpl-server.mjs';
import { makeKit, makeCtx } from '@/lib/sport/kit.mjs';
import { adviceEnabled, buildPacket, askClaude, validate, MODEL } from '@/lib/sport/advice.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.ADVICE_DAILY_LIMIT || 200);
const memo = new Map();
let day = '';
let used = 0;

const json = (body, status, cacheSeconds = 0) =>
  Response.json(body, {
    status,
    headers: cacheSeconds
      ? { 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${cacheSeconds}`, 'netlify-cdn-cache-control': `public, s-maxage=${cacheSeconds}, durable` }
      : { 'cache-control': 'no-store' },
  });

async function data(path, req) {
  const res = await fetch(new URL(`/sport/data/pl/${path}`, req.url));
  if (!res.ok) throw new Error(`Matchup data ${res.status}`);
  return res.json();
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const id = /^\d{1,10}$/.test(q.get('id') ?? '') ? Number(q.get('id')) : null;
  const ft = /^[0-5]$/.test(q.get('ft') ?? '') ? Number(q.get('ft')) : null;
  if (!id) return json({ error: 'Need an FPL team id' }, 400);
  if (!adviceEnabled()) return json({ error: 'AI advice is switched off: ANTHROPIC_API_KEY isn’t set on the server.' }, 503);

  const key = `${id}:${ft ?? ''}`;
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < 30 * 60e3) return json(hit.body, 200, 1800);

  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }
  if (used >= DAILY_LIMIT) return json({ error: 'Today’s AI advice limit is used up. The numbers in the Planner still work; try again tomorrow.' }, 429);

  try {
    const st = await getStatic();
    const [fixtures, entry, ix, learned, nx] = await Promise.all([getFixtures(), getEntry(id, st.current), data('index.json', req), data('netxg-model.json', req), data('netxg.json', req)]);
    if (!entry?.gw) return json({ error: `FPL has no picks for team ${id} yet` }, 404);
    const kit = makeKit(ix, learned);
    const ctx = makeCtx(st, kit);
    const packet = buildPacket({ st, fixtures, entry, kit, ctx, learned, nx, free: ft });
    used += 1;
    const started = Date.now();
    const { advice, usage, model } = await askClaude(packet);
    const checked = validate(advice, packet);
    const body = {
      gw: packet.gw,
      deadline: packet.deadline,
      freeTransfers: packet.freeTransfers,
      freeEstimated: packet.freeEstimated,
      chipsAvailable: packet.chipsAvailable,
      model,
      configuredModel: MODEL,
      seconds: Math.round((Date.now() - started) / 1000),
      usage: { input: usage.input_tokens, output: usage.output_tokens },
      at: new Date().toISOString(),
      advice: checked,
    };
    memo.set(key, { at: Date.now(), body });
    if (memo.size > 300) memo.delete(memo.keys().next().value);
    return json(body, 200, 1800);
  } catch (e) {
    return json({ error: e.message || 'Something went wrong' }, 502);
  }
}
