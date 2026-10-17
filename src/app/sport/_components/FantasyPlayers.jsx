'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { projectAhead, POS } from '@/lib/sport/fpl.mjs';
import { netFor } from '@/lib/sport/netxg.mjs';
import { fetchTeam, fetchMatch } from '@/lib/sport/espn.mjs';
import { usePrefs } from './prefs';
import { useLive } from './useLive';
import { useNetXgData, useNetXgModel } from './matchupData';
import { shirt, one, Face } from './fplbits';
import { Star } from './glyphs';
import Crest from './Crest';
import Prices, { priceOutlook } from './FantasyPrices';
import { useSetPieceSeason, SeasonSwitch, SetPieceGrid, SetPieceNote, seasonName, target } from './SetPieces';
import { useParam, useTabInView } from './useParam';

const VIEWS = [
  ['prices', 'Prices'],
  ['compare', 'Compare'],
  ['watch', 'Watchlist'],
  ['sets', 'Set pieces'],
  ['news', 'Team news'],
];
const norm = (s) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STATUS = { i: 'Injured', d: 'Doubtful', s: 'Suspended', u: 'Unavailable', n: 'Not in squad' };

/** Everything about individual players: prices, comparison, watchlist, set pieces and team news. */
export default function Players({ st, ctx, teams, squad, fixtures, kit }) {
  const [view, setView] = useParam('view', 'prices', VIEWS.map(([k]) => k));
  const row = useRef(null);
  useTabInView(row, view);
  const { prefs, update } = usePrefs();
  const watch = prefs.fplWatch ?? [];
  const toggleWatch = (id) => update((p) => ({ fplWatch: (p.fplWatch ?? []).includes(id) ? p.fplWatch.filter((x) => x !== id) : [...(p.fplWatch ?? []), id] }));
  // The next five gameweeks from the next deadline.
  const gws = useMemo(() => {
    const first = st.events.find((e) => new Date(e.deadline) > Date.now())?.id;
    return first ? Array.from({ length: 5 }, (_, i) => first + i).filter((g) => g <= 38) : [];
  }, [st]);
  return (
    <div>
      <div className="sp-pad" style={{ marginTop: 10 }}>
        <div className="sp-tabs" role="tablist" aria-label="Players" style={{ gap: 16 }} ref={row}>
          {VIEWS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k, ['p'])} style={{ height: 36, fontSize: 14 }}>
              {l}
              {k === 'watch' && watch.length ? ` ${watch.length}` : ''}
            </button>
          ))}
        </div>
      </div>
      {view === 'prices' && <Prices st={st} teams={teams} squad={squad} />}
      {view === 'compare' && fixtures && <Compare st={st} ctx={ctx} teams={teams} fixtures={fixtures} gws={gws} kit={kit} watch={watch} toggleWatch={toggleWatch} />}
      {view === 'watch' && fixtures && <Watchlist ids={watch} st={st} ctx={ctx} teams={teams} fixtures={fixtures} gws={gws} toggleWatch={toggleWatch} />}
      {view === 'sets' && <SetPieces st={st} ctx={ctx} teams={teams} squad={squad} />}
      {view === 'news' && <TeamNews st={st} teams={teams} kit={kit} />}
    </div>
  );
}

export function WatchStar({ id, on, toggle }) {
  return (
    <button className="sp-watch-star" aria-pressed={on} onClick={() => toggle(id)} aria-label={on ? 'Remove from watchlist' : 'Add to watchlist'} title={on ? 'On your watchlist' : 'Watch'}>
      <Star on={on} size={16} />
    </button>
  );
}

function Search({ st, teams, onPick, exclude }) {
  const [q, setQ] = useState('');
  const hits = q.trim().length < 2 ? [] : st.elements.filter((e) => !exclude.includes(e.id) && (norm(e.name).includes(norm(q)) || norm(`${e.first} ${e.second}`).includes(norm(q)))).sort((a, b) => b.total - a.total).slice(0, 8);
  return (
    <div className="sp-search">
      <input className="sp-input" placeholder="Search a player" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search a player" />
      {hits.length > 0 && (
        <div className="sp-search-list" role="listbox">
          {hits.map((e) => (
            <button key={e.id} role="option" aria-selected="false" onClick={() => { onPick(e.id); setQ(''); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shirt(teams[e.team]?.code, e.type === 1)} alt="" width="20" height="20" />
              <b>{e.name}</b>
              <span className="sp-tiny sp-muted">{teams[e.team]?.short} · {POS[e.type]} · £{e.cost.toFixed(1)}m</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Up to three players side by side, best value in each row in bold. */
function Compare({ st, ctx, teams, fixtures, gws, kit, watch, toggleWatch }) {
  // A player picked in search (?p=) comes first.
  const [picked] = useParam('p', null);
  const [ids, setIds] = useState(() => {
    const p = Number(picked);
    return p && ctx.elements[p] ? [p, ...watch.filter((id) => id !== p)].slice(0, 2) : watch.slice(0, 2);
  });
  // Picked again while Compare is open: he joins the ones already there.
  useEffect(() => {
    const p = Number(picked);
    if (p && ctx.elements[p]) setIds((x) => (x.includes(p) ? x : [p, ...x].slice(0, 3)));
  }, [picked, ctx.elements]);
  const nx = useNetXgData();
  const learned = useNetXgModel();
  const ahead = useMemo(() => projectAhead(ids, fixtures, gws, ctx), [ids, fixtures, gws, ctx]);
  const els = ids.map((id) => ctx.elements[id]).filter(Boolean);
  const nextFx = (el) => fixtures.filter((f) => f.event === gws[0] && (f.home === el.team || f.away === el.team));
  const net = (el) => {
    if (!kit || !nx.data || !learned.data) return null;
    return nextFx(el).reduce((t, f) => t + netFor(el, f, ctx, kit, nx.data.players[el.id], 'xg', learned.data).value, 0);
  };
  const per90 = (v, m) => (m >= 90 ? (v / m) * 90 : null);
  const recent = (el) => {
    const r = nx.data?.players[el.id]?.r;
    return r && r[0] ? ((r[1] + r[2]) / r[0]) * 90 : null;
  };
  const sp = (el) => ['Penalties', 'Free kicks', 'Corners'].map((l, i) => (el.setPieces?.[i] ? `${l} ${el.setPieces[i] === 1 ? '1st' : `#${el.setPieces[i]}`}` : null)).filter(Boolean).join(', ') || '–';
  const rows = [
    ['Price', (el) => el.cost, (v) => `£${v.toFixed(1)}m`, 'low'],
    ['Owned', (el) => el.owned, (v) => `${v}%`, null],
    ['Points this season', (el) => el.total, (v) => v, 'high'],
    ['xG per 90', (el) => per90(el.xg ?? 0, el.minutes ?? 0), (v) => v.toFixed(2), 'high'],
    ['xA per 90', (el) => per90(el.xa ?? 0, el.minutes ?? 0), (v) => v.toFixed(2), 'high'],
    ['xG + xA per 90, last 5', recent, (v) => v.toFixed(2), 'high'],
    [`Net xG, GW${gws[0]}`, net, (v) => v.toFixed(2), 'high'],
    ...gws.map((g) => [`GW${g}`, (el) => ahead[el.id]?.per[g]?.xp ?? 0, (v) => one(v), 'high', (el) => ahead[el.id]?.per[g]?.fx.map((x) => (x.home ? teams[x.opp]?.short : teams[x.opp]?.short.toLowerCase())).join(' ') || 'blank']),
    [`Next ${gws.length} total`, (el) => ahead[el.id]?.total ?? 0, (v) => one(v), 'high'],
    ['Set pieces', null, null, null, sp],
    ['Price tonight', null, null, null, (el) => { const o = priceOutlook(el); return o.dir && o.offset === 0 ? (o.dir > 0 ? '▲ likely rise' : '▼ likely fall') : 'steady'; }],
    ['Availability', null, null, null, (el) => (el.status === 'a' ? 'Fit' : `${STATUS[el.status] ?? 'Doubt'}${el.chance != null ? ` (${el.chance}%)` : ''}`)],
  ];
  return (
    <section className="sp-panel">
      <h2 className="sp-h2">Compare players</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>Up to three. The better value in each row is in bold. Projections are ours.</p>
      {ids.length < 3 && <Search st={st} teams={teams} onPick={(id) => setIds((x) => [...x, id].slice(0, 3))} exclude={ids} />}
      {els.length === 0 ? (
        <p className="sp-small sp-muted" style={{ marginTop: 10 }}>Search for a player to start{watch.length ? ', or star some to have them here' : ''}.</p>
      ) : (
        <div className="sp-heat-wrap" style={{ padding: 0, marginTop: 12 }}>
          <table className="sp-cmp-t">
            <thead>
              <tr>
                <th />
                {els.map((el) => (
                  <th key={el.id}>
                    <Face el={el} teams={teams} size={40} />
                    <b>{el.name}</b>
                    <span className="sp-tiny sp-muted">{teams[el.team]?.short} · {POS[el.type]}</span>
                    <span className="sp-cmp-act">
                      <WatchStar id={el.id} on={watch.includes(el.id)} toggle={toggleWatch} />
                      <button className="sp-tiny sp-link" onClick={() => setIds((x) => x.filter((i) => i !== el.id))}>Remove</button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, get, fmt, better, sub]) => {
                const vals = els.map((el) => (get ? get(el) : null));
                const nums = vals.filter((v) => v != null);
                const best = better === 'high' ? Math.max(...nums) : better === 'low' ? Math.min(...nums) : null;
                return (
                  <tr key={label}>
                    <th className="l sp-tiny">{label}</th>
                    {els.map((el, i) => (
                      <td key={el.id} className="sp-num" style={{ fontWeight: best != null && vals[i] === best && els.length > 1 ? 900 : 550 }}>
                        {get ? (vals[i] == null ? '–' : fmt(vals[i])) : null}
                        {sub && <span className={get ? 'sp-tiny sp-muted' : 'sp-tiny'} style={{ display: 'block' }}>{sub(el)}</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Watchlist({ ids, st, ctx, teams, fixtures, gws, toggleWatch }) {
  const ahead = useMemo(() => projectAhead(ids, fixtures, gws, ctx), [ids, fixtures, gws, ctx]);
  const list = ids.map((id) => ctx.elements[id]).filter(Boolean).sort((a, b) => (ahead[b.id]?.total ?? 0) - (ahead[a.id]?.total ?? 0));
  return (
    <section className="sp-panel">
      <h2 className="sp-h2">Watchlist</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 6px' }}>Star a player in Compare or on his card to keep him here. Saved in this browser only.</p>
      {list.length === 0 && <p className="sp-small sp-muted" style={{ margin: 0 }}>Nobody yet.</p>}
      {list.map((el) => {
        const o = priceOutlook(el);
        return (
          <div key={el.id} className="sp-wl">
            <Face el={el} teams={teams} size={34} />
            <span style={{ minWidth: 0 }}>
              <b className="sp-dif-name" style={{ display: 'block' }}>{el.name}</b>
              <span className="sp-tiny sp-muted">
                {teams[el.team]?.short} · £{el.cost.toFixed(1)}m{o.dir && o.offset === 0 ? (o.dir > 0 ? ' · ▲ rise tonight' : ' · ▼ fall tonight') : ''}
                {el.status !== 'a' ? ` · ${STATUS[el.status] ?? 'Doubt'}` : ''}
              </span>
              <span className="sp-wl-gws">
                {gws.map((g) => {
                  const c = ahead[el.id]?.per[g];
                  return (
                    <span key={g}>
                      <span className="sp-tiny sp-muted">{c?.fx.map((x) => (x.home ? teams[x.opp]?.short : teams[x.opp]?.short.toLowerCase())).join(' ') || '–'}</span>
                      <b className="sp-tiny sp-num">{c ? one(c.xp) : '–'}</b>
                    </span>
                  );
                })}
              </span>
            </span>
            <WatchStar id={el.id} on toggle={toggleWatch} />
          </div>
        );
      })}
    </section>
  );
}

const POS_PLURAL = [[0, 'All'], [2, 'Defenders'], [3, 'Midfielders'], [4, 'Forwards']];

/**
 * Set pieces both ways: who each club aims for (our count from the match commentary, this season or
 * last) and who takes them (FPL's own order, which it updates through the season).
 */
function SetPieces({ st, ctx, teams, squad }) {
  const sp = useSetPieceSeason();
  const [pos, setPos] = useState(0);
  const mine = useMemo(() => new Set(squad), [squad]);
  if (sp.error) return <p className="sp-empty">Couldn’t load the set-piece numbers ({sp.error}).</p>;
  if (!sp.data || !sp.season) return <div className="sp-skel" style={{ height: 600, margin: 16 }} />;
  const current = sp.season === sp.seasons[0];
  const fplTeamOf = Object.fromEntries(Object.entries(sp.data.fplTeams).map(([f, e]) => [e, Number(f)]));
  const table = sp.data.data[sp.season];
  const leaders = Object.entries(table)
    .flatMap(([club, t]) => t.targets.map((row) => ({ ...target(row), club })))
    .filter((p) => !pos || ctx.elements[p.fpl]?.type === pos)
    .sort((a, b) => b.a - a.a || b.x - a.x)
    .slice(0, 10);
  // FPL's takers only make sense against this season's clubs.
  const takers = (espnId) => {
    const club = fplTeamOf[espnId];
    if (!current || !club) return null;
    const of = (i) => st.elements.filter((e) => e.team === club && e.setPieces?.[i]).sort((a, b) => a.setPieces[i] - b.setPieces[i]).slice(0, 2);
    const parts = [['Corners', 2], ['Pens', 0], ['Free kicks', 1]].map(([label, i]) => [label, of(i)]).filter(([, list]) => list.length);
    if (!parts.length) return null;
    return (
      <p className="sp-spc-takers">
        {parts.map(([label, list]) => (
          <span key={label} style={{ display: 'block' }}>
            {label}{' '}
            {list.map((e, j) => (
              <b key={e.id} style={{ color: 'var(--sp-ink-2)', fontWeight: j ? 550 : 800 }}>
                {j ? ', ' : ''}
                {e.name}
              </b>
            ))}
          </span>
        ))}
      </p>
    );
  };
  return (
    <>
      <section className="sp-panel">
        <div className="sp-section-head" style={{ marginBottom: 4 }}>
          <h2 className="sp-h2">Set-piece threats</h2>
          <SeasonSwitch seasons={sp.seasons} season={sp.season} onPick={sp.setSeason} />
        </div>
        <p className="sp-small sp-ink2" style={{ margin: '0 0 8px' }}>
          The most shots and headers from corners and free kicks into the box{current ? ' this season' : ` in ${seasonName(sp.season)}`}. The share is of his club’s attempts while he was on the pitch.
        </p>
        <div className="sp-tabs" role="radiogroup" aria-label="Position" style={{ border: 0, gap: 12 }}>
          {POS_PLURAL.map(([k, l]) => (
            <button key={k} role="radio" aria-checked={pos === k} onClick={() => setPos(k)} style={{ height: 30, fontSize: 13.5 }}>{l}</button>
          ))}
        </div>
        {leaders.map((p, i) => {
          const el = ctx.elements[p.fpl];
          const club = sp.data.teams[p.club];
          return (
            <div key={`${p.club}-${p.id}`} className={`sp-cap${mine.has(p.fpl) ? ' sp-mine' : ''}`}>
              <span className="sp-cap-n sp-num">{i + 1}</span>
              {el ? <Face el={el} teams={teams} /> : <Crest src={`https://a.espncdn.com/i/teamlogos/soccer/500/${p.club}.png`} size={40} />}
              <span style={{ minWidth: 0 }}>
                <b className="sp-dif-name" style={{ display: 'block' }}>{el?.name ?? p.short}</b>
                <span className="sp-tiny sp-muted sp-dif-line">
                  {club?.short}
                  {el ? ` · ${POS[el.type]} · £${el.cost.toFixed(1)}m` : ''}
                  {mine.has(p.fpl) ? ' · in your team' : ''}
                </span>
                <span className="sp-tiny sp-ink2 sp-dif-line sp-num">
                  {p.h} header{p.h === 1 ? '' : 's'} · {p.g} goal{p.g === 1 ? '' : 's'} · {p.x.toFixed(2)} xG
                </span>
              </span>
              <span className="sp-cap-r">
                <b className="sp-num">{p.a}</b>
                <span className="sp-tiny sp-muted">attempts</span>
                <span className="sp-tiny sp-ink2 sp-num">{p.on ? Math.round((p.a / p.on) * 100) : 0}% share</span>
              </span>
            </div>
          );
        })}
        {leaders.length === 0 && <p className="sp-small sp-muted" style={{ margin: '8px 0 0' }}>Nobody yet.</p>}
      </section>
      <section className="sp-group">
        <header className="sp-ghead" style={{ display: 'block' }}>
          <h2 className="sp-h3">Who each club aims for</h2>
          <p className="sp-tiny sp-muted" style={{ margin: '2px 0 0' }}>
            Each club’s attempts and goals from set pieces, then the three players with the most attempts and their share.{current ? ' Under them, FPL’s first and second choice to take them.' : ''}
          </p>
        </header>
        <SetPieceGrid data={sp.data} season={sp.season} squad={mine} extra={takers} />
        <div className="sp-pad">
          <SetPieceNote mine={mine.size > 0} />
        </div>
      </section>
    </>
  );
}

/** A club's last starting eleven, today's FPL injury flags over it, and its confirmed lineup once out. */
function TeamNews({ st, teams, kit }) {
  const [team, setTeam] = useState(st.teams[0]?.id);
  const espn = kit?.fplTeams[team];
  const fplOfEspn = useMemo(() => Object.fromEntries(Object.entries(kit?.ix.fpl ?? {}).map(([f, e]) => [e, Number(f)])), [kit]);
  const club = useLive((signal) => (espn ? fetchTeam('eng.1', espn, { signal }) : Promise.resolve(null)), [espn], { every: 600000, live: () => false });
  const lastId = club.data?.results?.find((m) => m.league === 'eng.1')?.id;
  const nextId = club.data?.fixtures?.find((m) => m.league === 'eng.1')?.id;
  const last = useLive((signal) => (lastId ? fetchMatch('all', lastId, { signal }) : Promise.resolve(null)), [lastId], { every: 600000, live: () => false });
  const next = useLive((signal) => (nextId ? fetchMatch('all', nextId, { signal }) : Promise.resolve(null)), [nextId], { every: 120000, live: () => true });
  const side = (d) => (d ? (d.match.home.id === espn ? 'home' : 'away') : null);
  const confirmed = next.data && next.data.lineups[side(next.data)]?.starters?.length ? next.data : null;
  const shown = confirmed ?? last.data;
  const lu = shown?.lineups[side(shown)];
  // Injured, doubtful or suspended; players who've left the club ('u') aren't news for this side.
  const flagged = st.elements.filter((e) => e.team === team && e.status !== 'u' && (e.status !== 'a' || (e.chance != null && e.chance < 100)) && e.news);
  return (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">Team news</h2>
        <select className="sp-select" value={team} onChange={(e) => setTeam(Number(e.target.value))} aria-label="Club">
          {st.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <h3 className="sp-h3" style={{ margin: '4px 0 4px' }}>Flagged by FPL</h3>
      {flagged.length === 0 ? <p className="sp-small sp-muted" style={{ margin: 0 }}>Nobody flagged.</p> : flagged.map((e) => (
        <div key={e.id} className="sp-news">
          <b>{e.name}</b>
          <span className="sp-tiny">{STATUS[e.status] ?? 'Doubt'}{e.chance != null ? `, ${e.chance}% to play` : ''}</span>
          <span className="sp-tiny sp-muted">{e.news}</span>
        </div>
      ))}
      <h3 className="sp-h3" style={{ margin: '14px 0 4px' }}>
        {confirmed ? 'Confirmed lineup' : 'Last starting eleven'}
        {shown ? <span className="sp-tiny sp-muted" style={{ fontWeight: 600 }}> · {confirmed ? 'v' : `${shown.match.home.short} ${shown.match.home.score}–${shown.match.away.score} ${shown.match.away.short}`}{confirmed ? ` ${side(shown) === 'home' ? shown.match.away.short : shown.match.home.short}` : ''}{lu?.formation ? ` · ${lu.formation}` : ''}</span> : null}
      </h3>
      {!lu ? (
        <p className="sp-small sp-muted" style={{ margin: 0 }}>{club.error || last.error ? 'Couldn’t reach ESPN for the lineup.' : 'Loading…'}</p>
      ) : (
        (lu.lines ?? [lu.starters]).slice().reverse().map((line, i) => (
          <div key={i} className="sp-news-line">
            {line.map((p) => {
              const el = st.elements.find((e) => e.id === fplOfEspn[p.id]);
              const out = el && el.status !== 'a';
              return (
                <span key={p.id} className={out ? 'sp-news-out' : ''} title={el?.news || undefined}>
                  {p.last}
                  {out ? ` (${STATUS[el.status] ?? 'doubt'})` : ''}
                </span>
              );
            })}
          </div>
        ))
      )}
      <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
        Lineups come from ESPN; clubs announce them about an hour before kick-off, and this switches to the confirmed eleven when it’s out. Until then it’s the side that started last time, with anyone FPL has flagged marked.
      </p>
    </section>
  );
}
