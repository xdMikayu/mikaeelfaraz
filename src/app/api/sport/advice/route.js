// GET /api/sport/advice?id=<FPL team>&ft=<free transfers, optional>&stage=prep
//   Which clubs' news matters for this team (doubts in the squad, the players the options move).
// GET /api/sport/advice?id=<FPL team>&ft=<optional>&news=<club ids>
//   Claude's plan for the next deadline (src/lib/sport/advice.mjs), with those clubs' news from
//   /api/sport/news/<club> applied. The page fetches the news in between, so each request stays
//   inside the function time limit and every manager shares each club's news.
// Public, so it guards the bill: the CDN keeps each answer for 30 minutes, the function keeps its
// own copy, and a daily ceiling stops runaway use.
import { getStatic, getFixtures, getEntry, getNextSquad } from '@/lib/sport/fpl-server.mjs';
import { makeKit, makeCtx } from '@/lib/sport/kit.mjs';
import { adviceEnabled, buildPacket, askClaude, validate, newsClubs, MODEL } from '@/lib/sport/advice.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DAILY_LIMIT = Number(process.env.ADVICE_DAILY_LIMIT || 200);
const NEWS_CLUBS = Number(process.env.ADVICE_NEWS_CLUBS || 4);
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

/** Each club's news from its own (CDN-cached) route; one that isn't ready in time is left out. */
async function clubNews(teams, gw, req) {
  const got = await Promise.allSettled(
    teams.map(async (t) => {
      const res = await fetch(new URL(`/api/sport/news/${t}?gw=${gw}`, req.url), { signal: AbortSignal.timeout(5000) });
      const body = await res.json();
      if (!res.ok) throw Object.assign(new Error(body.error || `News ${res.status}`), { code: body.code });
      return body;
    }),
  );
  const reports = got.filter((g) => g.status === 'fulfilled').map((g) => g.value);
  const failed = got.filter((g) => g.status === 'rejected').map((g) => g.reason);
  const off = failed.find((e) => e.code === 'web_search_off' || e.code === 'off');
  return { reports, error: off ? off.message : failed.length && !reports.length ? 'The news check didn’t come back in time, so this uses FPL’s injury flags only.' : null };
}

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const id = /^\d{1,10}$/.test(q.get('id') ?? '') ? Number(q.get('id')) : null;
  const ft = /^[0-5]$/.test(q.get('ft') ?? '') ? Number(q.get('ft')) : null;
  const prep = q.get('stage') === 'prep';
  const newsTeams = [...new Set((q.get('news') ?? '').split(',').filter((x) => /^\d{1,2}$/.test(x)).map(Number))].filter((t) => t >= 1 && t <= 20).slice(0, 6);
  if (!id) return json({ error: 'Need an FPL team id' }, 400);
  if (!adviceEnabled()) return json({ error: 'AI advice is switched off: ANTHROPIC_API_KEY isn’t set on the server.' }, 503);

  // The answer depends on the team, free transfers and the news used; the news part of the key is
  // filled in once the news is in, so changing the URL can't buy a fresh Claude call.
  const cached = (k, minutes) => {
    const hit = memo.get(k);
    return hit && Date.now() - hit.at < minutes * 60e3 ? hit.body : null;
  };
  const prepKey = `${id}:${ft ?? ''}:prep`;
  if (prep && cached(prepKey, 10)) return json(cached(prepKey, 10), 200, 600);

  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    used = 0;
  }

  try {
    const st = await getStatic();
    const [fixtures, entry, ix, learned, nx] = await Promise.all([getFixtures(), getEntry(id, st.current), data('index.json', req), data('netxg-model.json', req), data('netxg.json', req)]);
    if (!entry?.gw) return json({ error: `FPL has no picks for team ${id} yet` }, 404);
    const next = await getNextSquad(id, entry, st.current);
    const kit = makeKit(ix, learned);
    const ctx = makeCtx(st, kit);
    const base = { st, fixtures, entry, next, kit, ctx, learned, nx, free: ft };

    if (prep) {
      const packet = buildPacket(base);
      const short = (t) => st.teams.find((x) => x.id === t)?.short;
      const body = { gw: packet.gameweek, deadline: st.events.find((e) => e.id === packet.gameweek)?.deadline, clubs: newsClubs(packet, NEWS_CLUBS).map((c) => ({ ...c, short: short(c.team) })) };
      memo.set(prepKey, { at: Date.now(), body });
      return json(body, 200, 600);
    }

    const gw = st.events.find((e) => Date.parse(e.deadline) > Date.now())?.id;
    const news = newsTeams.length && gw ? await clubNews(newsTeams, gw, req) : { reports: [], error: null };
    const key = `${id}:${ft ?? ''}:${news.reports.map((r) => `${r.team}@${r.at}`).sort().join(',')}`;
    if (cached(key, 30)) return json(cached(key, 30), 200, 1800);
    if (used >= DAILY_LIMIT) return json({ error: 'Today’s AI advice limit is used up. The numbers in the Planner still work; try again tomorrow.' }, 429);
    const packet = buildPacket({ ...base, news: news.reports, newsError: news.error });
    used += 1;
    const started = Date.now();
    const { advice, usage, model } = await askClaude(packet);
    const checked = validate(advice, packet);
    const body = {
      gw: packet.gameweek,
      deadline: st.events.find((e) => e.id === packet.gameweek)?.deadline,
      freeTransfers: packet.manager.freeTransfers,
      freeEstimated: packet.manager.freeEstimated,
      chipsAvailable: packet.manager.chipsAvailable,
      revertedFreeHit: packet.manager.squadRevertsFromFreeHit,
      sellingPricesEstimated: packet.manager.sellingPricesEstimated,
      news: news.reports,
      newsError: news.error,
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
