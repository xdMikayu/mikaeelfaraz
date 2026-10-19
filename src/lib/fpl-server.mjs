// Server side of FPL: the game's API has no CORS headers, so the browser can't call it directly.
// Each function returns a trimmed shape (bootstrap-static is 1.7 MB raw, about 140 KB here);
// the route sets CDN cache headers so every viewer shares one upstream call per window.
import { addSources } from './fpl.mjs';

const BASE = 'https://fantasy.premierleague.com/api';
const UA = 'Mozilla/5.0 (personal FPL viewer; mikaeelfaraz.com)';

const memo = new Map(); // per function instance; picks for a past deadline never change

async function fpl(path, ttlMs = 0) {
  const hit = memo.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const res = await fetch(`${BASE}${path}`, { headers: { 'user-agent': UA, accept: 'application/json' }, cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`FPL ${res.status} on ${path}`);
  const data = await res.json();
  if (ttlMs) memo.set(path, { at: Date.now(), data });
  if (memo.size > 400) memo.delete(memo.keys().next().value);
  return data;
}

const num = (v) => (v == null || v === '' ? null : Number(v));

// Only players anywhere near a change carry the nightly projections; the rest are steady.
function priceOf(e) {
  const nights = (e.price_change_projections ?? []).map((p) => [p.offset, num(p.projected_percent), p.likelihood]);
  const near = nights.some(([, pct]) => Math.abs(pct ?? 0) >= 70) || Math.abs(num(e.price_change_percent) ?? 0) >= 70;
  return {
    progress: num(e.price_change_percent),
    ...(near ? { nights } : null),
    net: (e.transfers_in_event ?? 0) - (e.transfers_out_event ?? 0),
    changed: e.cost_change_event ?? 0,
  };
}

export async function getStatic() {
  const b = await fpl('/bootstrap-static/', 60e3);
  const current = b.events.find((e) => e.is_current) ?? b.events.find((e) => e.is_next);
  return {
    current: current?.id ?? 1,
    events: b.events.map((e) => ({
      id: e.id,
      deadline: e.deadline_time,
      finished: e.finished,
      checked: e.data_checked,
      current: e.is_current,
      next: e.is_next,
      average: e.average_entry_score || null,
      highest: e.highest_score ?? null,
    })),
    teams: b.teams.map((t) => ({ id: t.id, name: t.name, short: t.short_name, code: t.code })),
    elements: b.elements.map((e) => ({
      id: e.id,
      name: e.web_name,
      first: e.first_name,
      second: e.second_name,
      team: e.team,
      type: e.element_type,
      cost: e.now_cost / 10,
      start: (e.now_cost - (e.cost_change_start ?? 0)) / 10,
      owned: num(e.selected_by_percent),
      status: e.status,
      news: e.news || null,
      ...(e.news ? { newsAt: e.news_added } : null),
      chance: e.chance_of_playing_next_round,
      form: num(e.form),
      total: e.total_points,
      xg: num(e.expected_goals),
      xa: num(e.expected_assists),
      // Price changes: FPL's own progress towards a rise (+100) or fall (−100), and its projection
      // for tonight and the next two nights with a likelihood from −5 to 5.
      price: priceOf(e),
      // Set-piece order from FPL (1 = first choice), null when he isn't on the list.
      setPieces: [e.penalties_order, e.direct_freekicks_order, e.corners_and_indirect_freekicks_order],
      goals: e.goals_scored,
      assists: e.assists,
      ep: num(e.ep_next),
      epThis: num(e.ep_this),
      opta: e.opta_code,
      // Season totals for the projection model (fpl.mjs projectPlayer).
      minutes: e.minutes,
      starts: e.starts,
      xgc: num(e.expected_goals_conceded),
      saves: e.saves,
      bonus: e.bonus,
      dc90: num(e.defensive_contribution_per_90),
      dc: e.defensive_contribution ?? 0,
      ppg: num(e.points_per_game),
      yc: e.yellow_cards,
      playing: e.chance_of_playing_this_round,
    })),
    total: b.total_players,
  };
}

export async function getLive(event) {
  const [live, fixtures] = await Promise.all([fpl(`/event/${event}/live/`, 15e3), fpl(`/fixtures/?event=${event}`, 15e3)]);
  const pairs = (f, key) => {
    const s = f.stats?.find((x) => x.identifier === key);
    return Object.fromEntries([...(s?.h ?? []), ...(s?.a ?? [])].map((x) => [x.element, x.value]));
  };
  return {
    event,
    elements: Object.fromEntries(
      (live?.elements ?? [])
        .filter((e) => e.stats.minutes > 0 || e.explain.some((x) => x.stats.length))
        .map((e) => [
          e.id,
          {
            minutes: e.stats.minutes,
            points: e.stats.total_points,
            bonus: e.stats.bonus,
            bps: e.stats.bps,
            goals: e.stats.goals_scored,
            assists: e.stats.assists,
            xg: num(e.stats.expected_goals),
            xa: num(e.stats.expected_assists),
            // The rest of Opta's numbers FPL keeps per player, for ratings and the stats tab: defensive
            // contributions (tackles, clearances-blocks-interceptions, recoveries), saves, goals and xG
            // conceded while on, cards, and influence, creativity and threat.
            st: {
              dc: e.stats.defensive_contribution ?? 0,
              tk: e.stats.tackles ?? 0,
              cbi: e.stats.clearances_blocks_interceptions ?? 0,
              rec: e.stats.recoveries ?? 0,
              sv: e.stats.saves ?? 0,
              gc: e.stats.goals_conceded ?? 0,
              xgc: num(e.stats.expected_goals_conceded) ?? 0,
              cs: e.stats.clean_sheets ?? 0,
              yc: e.stats.yellow_cards ?? 0,
              rc: e.stats.red_cards ?? 0,
              og: e.stats.own_goals ?? 0,
              ps: e.stats.penalties_saved ?? 0,
              pm: e.stats.penalties_missed ?? 0,
              inf: num(e.stats.influence) ?? 0,
              cre: num(e.stats.creativity) ?? 0,
              thr: num(e.stats.threat) ?? 0,
              starts: e.stats.starts ?? 0,
            },
            explain: e.explain.map((x) => ({ fixture: x.fixture, stats: x.stats.map((s) => ({ identifier: s.identifier, points: s.points, value: s.value })) })),
          },
        ])
    ),
    fixtures: (fixtures ?? []).map((f) => ({
      id: f.id,
      kickoff: f.kickoff_time,
      home: f.team_h,
      away: f.team_a,
      hs: f.team_h_score,
      as: f.team_a_score,
      started: Boolean(f.started),
      finished: Boolean(f.finished),
      finishedProvisional: Boolean(f.finished_provisional),
      minutes: f.minutes,
      fdrH: f.team_h_difficulty,
      fdrA: f.team_a_difficulty,
      bps: pairs(f, 'bps'),
      bonus: pairs(f, 'bonus'),
    })),
    at: new Date().toISOString(),
  };
}

/**
 * The season so far for every player, gameweek by gameweek from FPL's live data: where their points
 * came from and how often their defensive contributions paid (fpl.mjs pointSources). Finished
 * gameweeks are kept for six hours, the current one for a minute.
 */
export async function getSeason() {
  const b = await fpl('/bootstrap-static/', 60e3);
  const gws = b.events.filter((e) => e.finished || e.is_current).map((e) => ({ id: e.id, done: e.finished && e.data_checked }));
  const lives = await Promise.all(gws.map((g) => fpl(`/event/${g.id}/live/`, g.done ? 6 * 3600e3 : 60e3)));
  const per = {};
  for (const live of lives) for (const e of live?.elements ?? []) addSources(per, e.id, e.explain);
  return { through: Math.max(0, ...gws.map((g) => g.id)), players: per, at: new Date().toISOString() };
}

const num10 = (v) => (/^\d{1,10}$/.test(v ?? '') ? Number(v) : null);
const KINDS = { static: 0, fixtures: 0, top: 0, season: 0, live: 1, entry: 2, league: 2 };

/**
 * What /api/sport/fpl/... asks for: { kind, id, event, legacy } or { error, status }.
 * Path form: static, fixtures, live/<gw>, entry/<team>/<gw>, league/<league>/<gw>. The old query
 * form (entry?id=&event=) is still read, and flagged `legacy` so it isn't cached.
 */
export function fplRequest(parts = [], q = new URLSearchParams()) {
  const [kind, ...rest] = parts;
  if (!(kind in KINDS)) return { error: 'Unknown', status: 404 };
  const legacy = rest.length === 0 && KINDS[kind] > 0;
  if (!legacy && rest.length !== KINDS[kind]) return { error: 'Unknown', status: 404 };
  if (KINDS[kind] === 0) return { kind, legacy: false };
  const event = num10(legacy ? q.get('event') : rest[rest.length - 1]);
  if (!event || event > 38) return { error: 'Need a gameweek', status: 400 };
  if (kind === 'live') return { kind, event, legacy };
  const id = num10(legacy ? q.get('id') : rest[0]);
  if (!id) return { error: 'Need an id', status: 400 };
  return { kind, id, event, legacy };
}

/** The overall leader: the team the fantasy page offers as an example to look around with. */
export async function getTop() {
  const s = await fpl('/leagues-classic/314/standings/?page_standings=1', 3600e3);
  const r = s?.standings?.results?.[0];
  return r ? { entry: r.entry, team: r.entry_name, manager: r.player_name } : null;
}

/** Every fixture of the season, for looking several gameweeks ahead. */
export async function getFixtures() {
  const all = await fpl('/fixtures/', 300e3);
  return (all ?? []).map((f) => ({
    id: f.id,
    event: f.event,
    kickoff: f.kickoff_time,
    home: f.team_h,
    away: f.team_a,
    hs: f.team_h_score,
    as: f.team_a_score,
    started: Boolean(f.started),
    finished: Boolean(f.finished),
    finishedProvisional: Boolean(f.finished_provisional),
    minutes: f.minutes,
    fdrH: f.team_h_difficulty,
    fdrA: f.team_a_difficulty,
  }));
}

const picksShape = (p) =>
  p && {
    chip: p.active_chip,
    hit: p.entry_history?.event_transfers_cost ?? 0,
    points: p.entry_history?.points ?? null,
    rank: p.entry_history?.rank ?? null,
    overall: p.entry_history?.overall_rank ?? null,
    bank: (p.entry_history?.bank ?? 0) / 10,
    value: (p.entry_history?.value ?? 0) / 10,
    picks: p.picks.map((x) => ({ element: x.element, position: x.position, multiplier: x.multiplier, captain: x.is_captain, vice: x.is_vice_captain })),
  };

export async function getEntry(id, event) {
  const [entry, picks, history] = await Promise.all([
    fpl(`/entry/${id}/`, 60e3),
    fpl(`/entry/${id}/event/${event}/picks/`, 30e3),
    fpl(`/entry/${id}/history/`, 300e3),
  ]);
  if (!entry) return null;
  return {
    id: entry.id,
    name: entry.name,
    manager: `${entry.player_first_name} ${entry.player_last_name}`.trim(),
    overall: entry.summary_overall_rank,
    total: entry.summary_overall_points,
    started: entry.started_event,
    leagues: (entry.leagues?.classic ?? [])
      .filter((l) => l.league_type === 'x') // private leagues; public ones are the giant system leagues
      .map((l) => ({ id: l.id, name: l.name, rank: l.entry_rank, size: l.rank_count ?? null })),
    gw: picksShape(picks),
    history: (history?.current ?? []).map((h) => ({ event: h.event, points: h.points, total: h.total_points, overall: h.overall_rank, rank: h.rank, hit: h.event_transfers_cost, transfers: h.event_transfers, bench: h.points_on_bench })),
    chips: (history?.chips ?? []).map((c) => ({ name: c.name, event: c.event })),
  };
}

/**
 * The squad the next deadline starts from, with the transfer history for selling prices. A Free Hit
 * squad lasts one gameweek, so after one the team goes back to the squad (and bank) from before it.
 * Transfers made since the last deadline aren't public until the next one.
 */
export async function getNextSquad(id, entry, event) {
  let gw = entry.gw;
  let ev = event;
  for (let i = 0; i < 2 && gw?.chip === 'freehit' && ev > 1; i++) {
    ev -= 1;
    gw = picksShape(await fpl(`/entry/${id}/event/${ev}/picks/`, 6 * 3600e3));
  }
  const transfers = (await fpl(`/entry/${id}/transfers/`, 60e3)) ?? [];
  return {
    picks: gw?.picks ?? [],
    bank: gw?.bank ?? 0,
    revertedFreeHit: ev !== event,
    transfers: transfers.map((t) => ({ element_in: t.element_in, element_in_cost: t.element_in_cost, element_out: t.element_out, element_out_cost: t.element_out_cost, event: t.event, time: t.time })),
  };
}

const pointsMemo = new Map();
/** Every player's points in one gameweek, { id: points }; only the totals are kept, for a day once it's finished. */
export async function getPoints(event, finished) {
  const hit = pointsMemo.get(event);
  if (hit && Date.now() - hit.at < (finished ? 24 * 3600e3 : 60e3)) return hit.map;
  const live = await fpl(`/event/${event}/live/`);
  const map = Object.fromEntries((live?.elements ?? []).map((e) => [e.id, e.stats.total_points]));
  pointsMemo.set(event, { at: Date.now(), map });
  return map;
}

/** First page of a classic league (50 managers) with every manager's picks for the gameweek. */
export async function getLeague(id, event) {
  const s = await fpl(`/leagues-classic/${id}/standings/?page_standings=1`, 60e3);
  if (!s) return null;
  const results = s.standings?.results ?? [];
  const picks = await Promise.allSettled(results.map((r) => fpl(`/entry/${r.entry}/event/${event}/picks/`, 6 * 3600e3)));
  return {
    id: s.league.id,
    name: s.league.name,
    more: Boolean(s.standings?.has_next),
    rows: results.map((r, i) => {
      const p = picks[i].status === 'fulfilled' ? picksShape(picks[i].value) : null;
      return {
        entry: r.entry,
        team: r.entry_name,
        manager: r.player_name,
        rank: r.rank,
        lastRank: r.last_rank,
        total: r.total,
        eventTotal: r.event_total,
        picks: p?.picks ?? null,
        chip: p?.chip ?? null,
        hit: p?.hit ?? 0,
      };
    }),
  };
}
