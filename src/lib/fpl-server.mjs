// Server side of FPL: the game's API has no CORS headers, so the browser can't call it directly.
// Each function returns a trimmed shape (bootstrap-static is 1.7 MB raw, about 140 KB here);
// the route sets CDN cache headers so every viewer shares one upstream call per window.
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
      owned: num(e.selected_by_percent),
      status: e.status,
      news: e.news || null,
      chance: e.chance_of_playing_next_round,
      form: num(e.form),
      total: e.total_points,
      xg: num(e.expected_goals),
      xa: num(e.expected_assists),
      // Price changes: FPL's own progress towards a rise (+100) or fall (−100), and its projection
      // for tonight and the next two nights with a likelihood from −5 to 5.
      price: priceOf(e),
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
    leagues: (entry.leagues?.classic ?? [])
      .filter((l) => l.league_type === 'x') // private leagues; public ones are the giant system leagues
      .map((l) => ({ id: l.id, name: l.name, rank: l.entry_rank, size: l.rank_count ?? null })),
    gw: picksShape(picks),
    history: (history?.current ?? []).map((h) => ({ event: h.event, points: h.points, total: h.total_points, overall: h.overall_rank, rank: h.rank, hit: h.event_transfers_cost, transfers: h.event_transfers, bench: h.points_on_bench })),
    chips: (history?.chips ?? []).map((c) => ({ name: c.name, event: c.event })),
  };
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
