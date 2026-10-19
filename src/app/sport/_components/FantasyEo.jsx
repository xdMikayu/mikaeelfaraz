'use client';
import { useMemo, useState } from 'react';
import { leagueLive, POS } from '@/lib/sport/fpl.mjs';
import { useLive } from './useLive';
import { Face } from './fplbits';

// Effective ownership (EO): every manager's multiplier on a player added up, as a share of the
// managers. A starter counts 100%, a captain 200%, a triple captain 300%, a benched player nothing
// (everyone counts under a Bench Boost), all after the autosubs as things stand. What one of a player's
// points does to you against them is your multiplier minus the player's EO: captain Haaland (×2) when a
// league has Haaland at 250% and each of those points still drops you half a point against it.

// FPL's overall league: its first page is the 50 best managers in the world right now.
export const OVERALL = 314;

async function api(path, signal) {
  const res = await fetch(`/api/sport/fpl/${path}`, { signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `FPL ${res.status}`);
  return json;
}

/** EO among a league's first 50 managers this gameweek: { name, managers, eo: { element: { eo, owners, captains, multSum } } }. */
export function useEo(id, event, ctx) {
  const lg = useLive((signal) => (id ? api(`league/${id}/${event}`, signal) : Promise.resolve(null)), [id, event], { every: 90000, live: () => true });
  return useMemo(() => {
    if (!id) return null;
    if (!lg.data) return { loading: !lg.error, error: lg.error };
    const r = leagueLive(lg.data.rows, ctx);
    return { name: lg.data.name, managers: r.managers, eo: Object.fromEntries(r.ownership.map((o) => [o.element, o])) };
  }, [id, lg.data, lg.error, ctx]);
}

const pct = (v) => `${Math.round(v)}%`;
const per = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;
const ahead = (v) => (Math.abs(v) < 0.05 ? 'level with' : `${Math.abs(v).toFixed(1)} points ${v > 0 ? 'ahead of' : 'behind'}`);
const role = (l) => (!l ? 'not in your team' : l.mult === 3 ? 'you ×3, triple captain' : l.mult === 2 ? 'you ×2, captain' : l.mult === 1 ? 'you ×1' : 'you ×0, on your bench');

/** One player's line for the pitch card and the list: the player's EO there and what it means for you. */
export function eoWords(el, l, src) {
  const eo = src?.eo?.[el.id]?.eo ?? 0;
  const stake = (l?.mult ?? 0) - eo / 100;
  const where = src.label;
  if (Math.abs(stake) < 0.05) return `EO ${pct(eo)} ${where}: ${el.name}’s points barely move you against them.`;
  return `EO ${pct(eo)} ${where} (${role(l)}): each point ${el.name} scores ${stake > 0 ? 'lifts you' : 'drops you'} ${Math.abs(stake).toFixed(2)} against them.`;
}

/**
 * Who moves your rank this gameweek: your players and anyone the managers compared own a lot of,
 * biggest effect first, against your mini-league or the world's top 50.
 */
export function EoPanel({ team, ctx, teams, league, top }) {
  const sources = [league?.eo && { key: 'league', label: `in ${league.name}`, short: league.name, ...league }, top?.eo && { key: 'top', label: 'among the top 50', short: 'Top 50 in the world', ...top }].filter(Boolean);
  const [pick, setPick] = useState(null);
  const src = sources.find((s) => s.key === pick) ?? sources[0];
  const rows = useMemo(() => {
    if (!src) return [];
    const mine = Object.fromEntries(team.lines.map((l) => [l.element, l]));
    const ids = new Set([...team.lines.map((l) => l.element), ...Object.values(src.eo).filter((o) => o.eo >= 25).map((o) => o.element)]);
    return [...ids]
      .map((id) => {
        const l = mine[id];
        const eo = src.eo[id]?.eo ?? 0;
        const stake = (l?.mult ?? 0) - eo / 100;
        return { id, el: ctx.elements[id], l, eo, stake, pts: ctx.live[id]?.points ?? 0, captains: src.eo[id]?.captains ?? 0 };
      })
      .filter((r) => r.el && Math.abs(r.stake) >= 0.05)
      .sort((a, b) => Math.abs(b.stake) - Math.abs(a.stake) || b.eo - a.eo)
      .slice(0, 12);
  }, [src, team, ctx]);
  if (!sources.length) {
    const loading = league?.loading || top?.loading;
    return loading ? <div className="sp-skel" style={{ height: 260, margin: '14px 16px 0' }} /> : null;
  }
  // Your points against their average this gameweek: the sum of every player's (your multiplier − EO) × points.
  const all = new Set([...team.lines.map((l) => l.element), ...Object.keys(src.eo).map(Number)]);
  const mult = Object.fromEntries(team.lines.map((l) => [l.element, l.mult]));
  const net = [...all].reduce((t, id) => t + ((mult[id] ?? 0) - (src.eo[id]?.eo ?? 0) / 100) * (ctx.live[id]?.points ?? 0), 0);
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.stake)));
  return (
    <section className="sp-panel" id="eo" style={{ marginTop: 12 }}>
      <div className="sp-section-head" style={{ marginBottom: 4 }}>
        <h2 className="sp-h2">Effective ownership</h2>
        {sources.length > 1 && (
          <div className="sp-tabs" role="radiogroup" aria-label="Compared with" style={{ border: 0, gap: 12 }}>
            {sources.map((s) => (
              <button key={s.key} role="radio" aria-checked={s.key === src.key} onClick={() => setPick(s.key)} style={{ height: 30, fontSize: 13 }}>
                {s.key === 'league' ? 'Your league' : 'Top 50'}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>
        Against {src.key === 'league' ? <b style={{ color: 'var(--sp-ink)' }}>{src.short}</b> : <b style={{ color: 'var(--sp-ink)' }}>the world’s top 50 managers</b>}
        {src.key === 'league' && src.managers >= 50 ? ', its first 50 managers' : ''}: your gameweek so far is{' '}
        <b className={net > 0.05 ? 'sp-up' : net < -0.05 ? 'sp-down' : ''}>{ahead(net)}</b> their average, before hits.
      </p>
      {rows.map((r) => {
        const w = (Math.abs(r.stake) / max) * 50;
        const up = r.stake > 0;
        return (
          <div key={r.id} className="sp-div">
            <Face el={r.el} teams={teams} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.el.name}</b>
                <b className={`sp-num ${up ? 'sp-up' : 'sp-down'}`} style={{ fontSize: 14 }}>
                  {per(r.stake)} <span className="sp-tiny" style={{ fontWeight: 650 }}>a point</span>
                </b>
              </span>
              <span className="sp-tiny sp-muted sp-num" style={{ display: 'block' }}>
                EO {pct(r.eo)}
                {r.captains ? ` · ${r.captains} captained` : ''} · {role(r.l)} · {POS[r.el.type]} · {r.pts} pts so far
              </span>
              <span className="sp-div-track" role="img" aria-label={`${up ? 'Lifts' : 'Drops'} you ${Math.abs(r.stake).toFixed(2)} a point`}>
                <i className="sp-div-bar" style={{ left: up ? '50%' : `${50 - w}%`, width: `${w}%`, background: up ? 'var(--sp-win)' : 'var(--sp-loss)' }} />
              </span>
            </span>
          </div>
        );
      })}
      <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
        EO adds up every manager’s multiplier on a player: in the team counts 100%, captain 200%, triple captain 300%, on the bench nothing, after the autosubs as things stand. Your
        multiplier minus a player’s EO is what each of that player’s points does to you against them, so a captain (×2) still costs you when enough of them used a triple captain on the
        same player (EO above 200%). Green lifts you, red drops you.
      </p>
    </section>
  );
}
