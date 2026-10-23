// The server half of /api/news/<club>/<gameweek>: one club's news before the next deadline,
// its press conference and fitness news, found with web search (news.mjs). Shared by every
// manager: the CDN keeps each club's answer until 45 minutes after a press conference still to
// come, or a couple of hours otherwise. The CDN's cache key is the path, so the gameweek is in it.
import { getStatic, getFixtures } from './fpl-server.mjs';
import { fetchClubNews, focusPlayers, newsTtl, NewsError } from './news.mjs';

const DAILY_LIMIT = Number(process.env.NEWS_DAILY_LIMIT || 120);
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

/** cacheable: the gameweek is in the request path, so the CDN may keep the answer. */
export async function newsResponse(teamParam, { cacheable }) {
  const team = /^\d{1,2}$/.test(teamParam ?? '') ? Number(teamParam) : null;
  if (!team || team > 20) return json({ error: 'Unknown club' }, 400);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'News checks are switched off on this server.', code: 'off' }, 503);
  try {
    const st = await getStatic();
    const target = st.events.find((e) => new Date(e.deadline) > Date.now());
    if (!target) return json({ error: 'No deadline left this season' }, 404);
    const key = `${team}:${target.id}`;
    const hit = memo.get(key);
    if (hit && Date.now() < hit.until) return json(hit.body, 200, cacheable ? Math.round((hit.until - Date.now()) / 1000) : 0);

    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      used = 0;
    }
    if (used >= DAILY_LIMIT) return json({ error: 'Today’s news-check limit is used up.', code: 'limit' }, 429);
    used += 1;

    const fixtures = await getFixtures();
    const club = st.teams.find((t) => t.id === team);
    const name = (id) => st.teams.find((t) => t.id === id)?.name ?? '';
    const fx = fixtures
      .filter((f) => f.event === target.id && (f.home === team || f.away === team))
      .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))
      .map((f) => ({ ...f, oppName: name(f.home === team ? f.away : f.home) }));
    const roster = st.elements.filter((e) => e.team === team && e.status !== 'u');
    const now = Date.now();
    const report = await fetchClubNews({ club, fixtures: fx, deadline: target.deadline, roster, focus: focusPlayers(roster), now });
    const body = { ...report, gw: target.id };
    const ttl = newsTtl(report, now, fx.length ? Date.parse(fx[0].kickoff) : null);
    memo.set(key, { until: now + ttl * 1000, body });
    if (memo.size > 60) memo.delete(memo.keys().next().value);
    return json(body, 200, cacheable ? ttl : 0);
  } catch (e) {
    const code = e instanceof NewsError ? e.code : 'failed';
    return json({ error: e.message || 'The news check failed', code }, 502);
  }
}
