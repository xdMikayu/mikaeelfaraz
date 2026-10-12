// GET /api/sport/cricket/match/{league}/{event}: one match in full for the match page. From ESPN:
// the summary (each innings, every player's batting and bowling, the fall of wickets, who's in) and
// the ball-by-ball commentary (each over, the partnerships, how each batter was out). From Matchday's
// model: par, the projected total, each side's chance now and after every over, the ground's record.
// From Cricsheet: every player's form and record, and how the batters in have fared against these
// bowlers. Both ids are in the path, so the CDN's path-only key tells matches apart.
import { matchFromSummary, asListMatch, ballsOf, inningsBalls, phasesOf, quotaOf } from '@/lib/sport/cricket-match.mjs';
import { readMatch, formatOf } from '@/lib/sport/cricket-read.mjs';
import { formFor, matchupsFor } from '@/lib/sport/cricket-form.mjs';
import { cricketTable, modelTables } from '@/lib/sport/cricket-data.mjs';

export const dynamic = 'force-dynamic';

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/cricket';
const UA = { 'user-agent': 'Mozilla/5.0 (personal score viewer; mikaeelfaraz.com)' };
// The formats with player records (src/lib/sport/cricket/players), read the first time a match in
// that format is asked for.
const PLAYER_FORMATS = new Set(['t20-male', 't20-female', 'odi-male', 'odi-female', 'test-male', 'test-female', 'fc-male']);
const headers = (s) => ({ 'cache-control': 'public, max-age=0, must-revalidate', 'cdn-cache-control': `public, s-maxage=${s}`, 'netlify-cdn-cache-control': `public, s-maxage=${s}, durable` });
const failed = (status, error) => Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

async function get(url) {
  const res = await fetch(url, { headers: UA, cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

/** Every ball so far: the first page says how many pages there are (1,000 balls a page). */
async function commentary(league, event) {
  const page = (n) => get(`${ESPN}/${league}/playbyplay?event=${event}&limit=1000&page=${n}`);
  const first = await page(1).catch(() => null);
  const count = first?.commentary?.pageCount ?? 1;
  const rest = await Promise.all(Array.from({ length: Math.max(0, Math.min(count, 6) - 1) }, (_, i) => page(i + 2).catch(() => null)));
  return [first, ...rest].flatMap((p) => p?.commentary?.items ?? []);
}

export async function GET(_req, { params }) {
  const { league, event } = params;
  if (!/^\d+$/.test(league) || !/^\d+$/.test(event)) return failed(400, 'Not a match');
  let sum;
  let items;
  try {
    [sum, items] = await Promise.all([get(`${ESPN}/${league}/summary?event=${event}`), commentary(league, event)]);
  } catch (e) {
    return failed(502, e.message || 'ESPN didn’t answer');
  }
  const now = Date.now();
  const m = matchFromSummary(sum);
  const balls = ballsOf(items);
  for (const inn of m.innings) {
    const b = inningsBalls(balls, inn.number);
    inn.byOver = b.overs;
    inn.phases = phasesOf(b.overs, inn.ballLimit);
    inn.recent = inn.current ? b.recent : null;
    // ESPN's partnerships have no names; the commentary's do, and how each batter was out.
    inn.partnerships = b.partnerships.length ? b.partnerships : inn.partnerships;
    for (const row of inn.batting) row.how = b.how[row.id] ?? null;
    const quota = quotaOf(inn.ballLimit);
    for (const row of inn.bowling) row.left = quota == null ? null : Math.max(0, quota - row.balls);
  }

  // Matchday's read: the model sees the match as the scores list does.
  const list = asListMatch(sum, league);
  const oneDay = m.innings.slice(0, 2).map((inn) => ({ team: inn.team, runs: inn.runs, target: inn.target, ballLimit: inn.ballLimit, overs: inn.byOver }));
  const tables = await modelTables().catch(() => null);
  const read = tables && readMatch(list, tables, now, { whole: true, innings: oneDay });

  // Every player's record in this format, and the batters in against the side in the field.
  const key = formatOf(list);
  const table = PLAYER_FORMATS.has(key) ? await cricketTable(`players/${key}`).catch(() => null) : null;
  const form = table ? formFor(Object.keys(m.players), table) : {};
  const live = m.innings.find((inn) => inn.current) ?? null;
  const batters = live ? live.batting.filter((b) => !b.out).map((b) => b.id) : [];
  const fielders = live ? Object.keys(m.players).filter((id) => m.players[id].team !== live.team) : [];
  const matchups = table && batters.length ? matchupsFor(batters, fielders, table) : [];
  // Every batter against every bowler on the other side, the pairs that have met most.
  const side = (team) => Object.keys(m.players).filter((id) => m.players[id].team === team);
  const [A, B] = m.teams.map((t) => side(t.id));
  const headToHead = table ? [...matchupsFor(A, B, table), ...matchupsFor(B, A, table)].sort((x, y) => y.balls - x.balls).slice(0, 12) : [];

  const ttl = m.state === 'in' ? 30 : m.state === 'pre' ? 300 : 3600;
  // The scores-list view too, with kit colours, so the page can reuse the list's sums and words.
  const card = { ...list, teams: list.teams.map((t) => ({ ...t, color: m.teams.find((x) => x.id === t.id)?.color ?? null })) };
  return Response.json(
    { at: new Date(now).toISOString(), league, ...m, card, read, form, formFormat: key, formThrough: table?.through ?? null, matchups, headToHead },
    { headers: headers(ttl) },
  );
}
