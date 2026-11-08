'use client';
import { useMemo, useState } from 'react';
import { rootFixtures, placeAfter, MIN_SWING } from '@/lib/sport/fpl-root.mjs';
import { useEoAt } from './FantasyEo';
import { shirt } from './fplbits';
import { kickoff, shortDate } from './time';
import { Ball, Boot, Card, Shield, Wall } from './glyphs';

// What to root for: every match still to finish this gameweek, and what each thing that could still
// happen in it would do to you against a field of managers (src/lib/sport/fpl-root.mjs): your league,
// the managers ranked near you overall, or the world's top 50. Green is worth rooting for, red against.

const SHOW = 3; // events each way before "more"
const settled = (f) => f.finished || f.finishedProvisional;
const pts = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
const amount = (v) => (Math.abs(v - Math.round(v)) < 0.05 ? `${Math.round(v)}` : v.toFixed(1));
const pc = (p) => `${Math.min(99, Math.max(1, Math.round(p * 100)))}%`;
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}m` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : `${n}`);
const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`;
const ICON = { goal: <Ball size={15} />, assist: <Boot size={15} />, cs: <Shield size={15} />, defcon: <Wall size={15} />, yellow: <Card size={13} /> };
// Who the field is, in a sentence's words.
const WORDS = { league: 'your league', near: 'managers near you', top: 'the top 50' };

function label(e, ctx, teams) {
  const name = e.id ? ctx.elements[e.id]?.name : null;
  if (e.kind === 'goal') return `${name} goal`;
  if (e.kind === 'assist') return `${name} assist`;
  if (e.kind === 'yellow') return `${name} booked`;
  if (e.kind === 'defcon') return `${name} defensive contributions`;
  return `${teams[e.team]?.short} clean sheet`;
}

const whose = (m, owned) => (m === 3 ? 'Your triple captain' : m === 2 ? 'Your captain' : m === 1 ? 'Yours' : owned ? 'On your bench' : 'Not yours');

/** The line under an event: who has him (or what the clean sheet is worth to each side), and its chance. */
function detail(e, ctx, owned, words) {
  if (e.kind === 'cs') {
    const names = e.yours.map((id) => ctx.elements[id]?.name).join(', ');
    return `Worth ${amount(e.you)} to you${names ? ` (${names})` : ''}, ${amount(e.field)} to ${words} · ${pc(e.chance)} chance`;
  }
  const dc = e.kind === 'defcon' && e.have ? ` · ${e.have} of ${e.need} so far` : '';
  return `${whose(e.you, owned.has(e.id))} · EO ${Math.round(e.field)}% · ${pc(e.chance)} chance${dc}`;
}

function Head({ f, teams }) {
  const live = f.started && !settled(f);
  const side = (id) => (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={shirt(teams[id]?.code)} alt="" width={22} height={29} />
      <b>{teams[id]?.short}</b>
    </>
  );
  return (
    <div className="sp-root-head">
      <span className="sp-root-side">{side(f.home)}</span>
      <b className="sp-num sp-root-score">{f.started ? `${f.hs ?? 0}–${f.as ?? 0}` : 'v'}</b>
      <span className="sp-root-side sp-root-away">{side(f.away)}</span>
      <span className={`sp-pill ${live ? 'sp-pill-live' : 'sp-pill-time'}`} style={{ marginLeft: 'auto' }}>
        {live ? `Live · ${f.minutes ?? 0}′` : `${shortDate(f.kickoff)}, ${kickoff(f.kickoff)}`}
      </span>
    </div>
  );
}

function Event({ e, ctx, teams, owned, words, extra }) {
  // A clean sheet is always shown, so one too small to matter says so instead of a colour.
  const flat = Math.abs(e.swing) < MIN_SWING;
  const up = e.swing > 0;
  return (
    <li className="sp-root-ev">
      <span className={`sp-root-ic ${flat ? 'is-flat' : up ? 'is-up' : 'is-down'}`}>{ICON[e.kind]}</span>
      <span style={{ minWidth: 0 }}>
        <span className="sp-small" style={{ display: 'block', fontWeight: 700 }}>{label(e, ctx, teams)}</span>
        <span className="sp-tiny sp-muted" style={{ display: 'block' }}>{flat ? `Makes no real difference to you · ${pc(e.chance)} chance` : detail(e, ctx, owned, words)}</span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <b className={`sp-num ${flat ? 'sp-muted' : up ? 'sp-up' : 'sp-down'}`} style={{ fontSize: 15 }}>{flat ? '0' : pts(e.swing)}</b>
        {!flat && extra && <span className="sp-tiny sp-muted" style={{ display: 'block', whiteSpace: 'nowrap' }}>{extra}</span>}
      </span>
    </li>
  );
}

/** Whether a match has anything in it for you: a player's event, or a clean sheet that moves you. */
const matters = (m) => m.events.length > 0 || m.cleanSheets.some((c) => Math.abs(c.swing) >= MIN_SWING);

function Match({ m, ctx, teams, owned, words, extra }) {
  const [all, setAll] = useState(false);
  const good = m.events.filter((e) => e.swing > 0);
  const bad = m.events.filter((e) => e.swing < 0);
  const show = (list) => (all ? list : list.slice(0, SHOW));
  const hidden = m.events.length - show(good).length - show(bad).length;
  const top = [...m.events, ...m.cleanSheets.filter((c) => Math.abs(c.swing) >= MIN_SWING)].sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))[0];
  const row = (e) => <Event key={e.key} e={e} ctx={ctx} teams={teams} owned={owned} words={words} extra={extra(e)} />;
  return (
    <article className="sp-root-match">
      <Head f={m.fixture} teams={teams} />
      <p className="sp-small sp-ink2" style={{ margin: '8px 0 0' }}>
        Biggest swing: <b style={{ color: 'var(--sp-ink)' }}>{label(top, ctx, teams)}</b>, <b className={top.swing > 0 ? 'sp-up' : 'sp-down'}>{pts(top.swing)}</b>
        {extra(top) ? ` (${extra(top)})` : ''}
      </p>
      {m.cleanSheets.length > 0 && (
        <>
          <p className="sp-root-k">Clean sheets</p>
          <ul className="sp-root-list">{m.cleanSheets.map(row)}</ul>
        </>
      )}
      {good.length > 0 && (
        <>
          <p className="sp-root-k sp-up">Good for you</p>
          <ul className="sp-root-list">{show(good).map(row)}</ul>
        </>
      )}
      {bad.length > 0 && (
        <>
          <p className="sp-root-k sp-down">Bad for you</p>
          <ul className="sp-root-list">{show(bad).map(row)}</ul>
        </>
      )}
      {(hidden > 0 || all) && (
        <button className="sp-link sp-small" style={{ margin: '4px 0 0' }} onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `${hidden} more`}
        </button>
      )}
    </article>
  );
}

/**
 * The panel. team: teamLive's; league, top: useEo's (your league, the overall top 50); rank: your
 * overall rank, for the managers near it; me: your entry id; event: the gameweek.
 */
export default function RootFor({ team, ctx, teams, league, top, rank, me, event }) {
  const owned = useMemo(() => new Set(team.lines.map((l) => l.element)), [team]);
  const mine = useMemo(() => Object.fromEntries(team.lines.map((l) => [l.element, l.mult])), [team]);
  const options = [league && ['league', 'Your league'], rank && ['near', 'Near you'], ['top', 'Top 50']].filter(Boolean);
  const [pick, setPick] = useState(null);
  const key = options.some(([k]) => k === pick) ? pick : options[0][0];
  const near = useEoAt(key === 'near' ? `near/${Math.max(1, Math.ceil(rank / 50))}/${event}` : null, ctx);
  const src = key === 'league' ? league : key === 'near' ? near : top;
  const field = useMemo(() => (src?.eo ? Object.fromEntries(Object.values(src.eo).map((o) => [o.element, o.eo])) : null), [src]);
  const list = useMemo(() => (field ? rootFixtures(ctx, mine, field) : null), [ctx, mine, field]);
  if (!ctx.fixtures.some((f) => !settled(f))) return null;
  const words = WORDS[key];
  const ppp = key === 'near' ? src?.placesPerPoint : null;
  const now = key === 'league' && src?.table ? placeAfter({ parts: [] }, src.table, me)?.now : null;
  // What an event would do beyond the points: places overall, or a place in your league.
  const extra = (e) => {
    if (ppp) return `≈ ${e.swing > 0 ? '+' : '−'}${compact(Math.abs(Math.round(e.swing * ppp)))} places`;
    if (key !== 'league' || !src?.table) return null;
    const p = placeAfter(e, src.table, me);
    return p && p.after !== p.now ? `${p.after < p.now ? 'up' : 'down'} to ${ordinal(p.after)}` : null;
  };
  const quiet = list?.filter((m) => !matters(m)) ?? [];
  return (
    <section className="sp-panel" id="root-for" style={{ marginTop: 12 }}>
      <div className="sp-section-head" style={{ marginBottom: 4, flexWrap: 'wrap', rowGap: 2 }}>
        <h2 className="sp-h2">What to root for</h2>
        {options.length > 1 && (
          <div className="sp-tabs" role="radiogroup" aria-label="Against" style={{ border: 0, gap: 12 }}>
            {options.map(([k, l]) => (
              <button key={k} role="radio" aria-checked={k === key} onClick={() => setPick(k)} style={{ height: 30, fontSize: 13 }}>
                {l}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="sp-small sp-ink2" style={{ margin: '0 0 4px' }}>
        What anything still to happen in this gameweek’s matches would win or cost you against{' '}
        {key === 'league' && src?.name
          ? <><b style={{ color: 'var(--sp-ink)' }}>{src.name}</b>{src.managers >= 50 ? '’s first 50' : ''}{now ? <> (you’re <b style={{ color: 'var(--sp-ink)' }}>{ordinal(now)}</b> as it stands)</> : ''}.</>
          : key === 'near' && src?.from
            ? <>the {src.managers} managers ranked around <b style={{ color: 'var(--sp-ink)' }}>{compact(src.from)}</b> overall{ppp ? <>, where a point is worth about <b style={{ color: 'var(--sp-ink)' }}>{compact(ppp)}</b> places</> : ''}.</>
            : key === 'top'
              ? <>the world’s top 50 managers.</>
              : <>{words}.</>}
      </p>
      {!list ? (
        src?.error ? <p className="sp-note">Couldn’t load {words} ({src.error}).</p> : <div className="sp-skel" style={{ height: 240, marginTop: 8 }} aria-label="Loading" />
      ) : (
        <>
          {list.filter(matters).map((m) => <Match key={m.fixture.id} m={m} ctx={ctx} teams={teams} owned={owned} words={words} extra={extra} />)}
          {quiet.length > 0 && (
            <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
              Nothing much in it for you either way: {quiet.map((m) => `${teams[m.fixture.home]?.short} v ${teams[m.fixture.away]?.short}`).join(', ')}.
            </p>
          )}
        </>
      )}
      <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
        Each number is what the event would win (green) or cost (red) you against {words}: for every player it pays, your multiplier on him minus his effective ownership
        among them, times the points. A clean sheet counts the keeper, defenders and midfielders still on for the hour. Chances are our projections’ for the time left; a
        player taken off or on the bench of a live match isn’t counted.{ppp ? ' Places are a rough guide, from how tightly packed the overall table is around your rank.' : ''}
      </p>
    </section>
  );
}
