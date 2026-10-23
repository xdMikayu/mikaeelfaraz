'use client';
import { useState } from 'react';
import Link from 'next/link';
import Crest from './Crest';
import { useDark } from './colors';
import { fillOf, lineOf } from '@/lib/kit-colors.mjs';
import { useSetPieces } from './matchupData';

// Set pieces club by club, from public/data/pl/setpieces.json (src/lib/setpieces.mjs):
// who each club aims for at corners and free kicks into the box, in its own colour, as the share of
// its attempts from them that each player had while he was on the pitch.

const logo = (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
export const seasonName = (s) => `${s}/${String(Number(s) + 1).slice(2)}`;
const share = (a, of) => (of ? Math.round((a / of) * 100) : 0);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : /(ch|sh|x)$/.test(word) ? 'es' : 's'}`;

/** A target row as an object: [id, name, attempts, headers, goals, xG, team attempts while on, minutes, FPL id, short name]. */
export const target = ([id, name, a, h, g, x, on, min, fpl, short]) => ({ id, name, a, h, g, x, on, min, fpl, short: short || name });
/** A delivery row: [id, name, attempts set up, goals set up, FPL id, short name]. */
export const deliverer = ([id, name, k, g, fpl, short]) => ({ id, name, k, g, fpl, short: short || name });

/** The data and the season picked: this season unless the viewer chooses last. */
export function useSetPieceSeason() {
  const sp = useSetPieces();
  const [pick, setPick] = useState(null);
  const seasons = sp.data?.seasons ?? [];
  const season = seasons.includes(pick) ? pick : seasons[0];
  return { ...sp, seasons, season, setSeason: setPick };
}

export function SeasonSwitch({ seasons, season, onPick, label = 'Season' }) {
  if (seasons.length < 2) return null;
  return (
    <div className="sp-tabs" role="radiogroup" aria-label={label} style={{ border: 0, gap: 14 }}>
      {seasons.map((s, i) => (
        <button key={s} role="radio" aria-checked={s === season} onClick={() => onPick(s)} style={{ height: 30, fontSize: 13.5 }}>
          {i === 0 ? 'This season' : seasonName(s)}
        </button>
      ))}
    </div>
  );
}

/** How it's counted, under every view of it. */
export function SetPieceNote({ mine }) {
  return (
    <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
      Attempts are shots and headers that came from a corner or a free kick played into the box, as Opta’s commentary on ESPN records them. A player’s share is of his club’s attempts
      while he was on the pitch. A flick-on or a header that’s cleared before anyone shoots isn’t recorded, so these are attempts, not Opta’s first contacts.
      {mine ? ' A ring marks your players.' : ''}
    </p>
  );
}

function Bar({ value, color }) {
  return (
    <span className="sp-spt-bar" aria-hidden>
      <i style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </span>
  );
}

/**
 * Every club in a grid, the three players it aims for most under its crest. `squad` (FPL ids) rings
 * the viewer's own players; `extra(espnId)` adds a line under a club (fantasy: FPL's takers).
 */
export function SetPieceGrid({ data, season, squad, extra }) {
  const dark = useDark();
  const table = data.data[season] ?? {};
  const clubs = Object.keys(table).sort((a, b) => (data.teams[a]?.short ?? '').localeCompare(data.teams[b]?.short ?? ''));
  return (
    <div className="sp-spg">
      {clubs.map((id) => {
        const t = table[id];
        const club = data.teams[id] ?? {};
        const color = lineOf(fillOf(club), dark);
        const top = t.targets.slice(0, 3).map(target);
        return (
          <div key={id} className="sp-spc">
            <Link href={`/team?id=${id}&l=eng.1`} className="sp-spc-head">
              <Crest src={logo(id)} size={22} />
              <b>{club.short ?? club.name}</b>
            </Link>
            <p className="sp-spc-vol">
              {plural(t.a, 'attempt')} · {plural(t.g, 'goal')}
            </p>
            {top.length ? (
              top.map((p) => (
                <div key={p.id} className={`sp-spt${squad?.has(p.fpl) ? ' sp-spt-mine' : ''}`}>
                  <span className="sp-spt-name">{p.short}</span>
                  <span className="sp-spt-n">
                    {p.a} <small>· {share(p.a, p.on)}%</small>
                  </span>
                  <Bar value={share(p.a, p.on)} color={color} />
                </div>
              ))
            ) : (
              <p className="sp-tiny sp-muted" style={{ margin: '6px 0 0' }}>No attempts yet.</p>
            )}
            {extra?.(id)}
          </div>
        );
      })}
    </div>
  );
}

/** The Premier League's table page: every club's set-piece targets, this season or last. */
export function LeagueSetPieces() {
  const sp = useSetPieceSeason();
  if (!sp.data || !sp.season) return null;
  return (
    <section className="sp-group" id="set-pieces">
      <header className="sp-ghead sp-section-head" style={{ marginBottom: 0 }}>
        <h2 className="sp-h3">Set pieces: who each club aims for</h2>
        <SeasonSwitch seasons={sp.seasons} season={sp.season} onPick={sp.setSeason} />
      </header>
      <p className="sp-tiny sp-muted sp-pad" style={{ margin: '0 0 8px' }}>
        Each club’s attempts and goals from set pieces, then the three players with the most attempts and their share of the club’s. Tap a club for its page.
      </p>
      <SetPieceGrid data={sp.data} season={sp.season} />
      <div className="sp-pad">
        <SetPieceNote />
      </div>
    </section>
  );
}

const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th'}`;

/** A club's own page: who it aims for and who delivers, and how it does at both ends of a set piece. */
export function TeamSetPieces({ teamId, color }) {
  const sp = useSetPieceSeason();
  if (!sp.data || !sp.season) return null;
  const table = sp.data.data[sp.season];
  const t = table?.[teamId];
  if (!t) return null;
  const ids = Object.keys(table);
  // Where the club stands among them, in words: "the most", "the fewest", or "the 4th most".
  const standing = (k, way) => {
    const more = ids.filter((id) => table[id][k] > t[k]).length;
    const fewer = ids.filter((id) => table[id][k] < t[k]).length;
    const [top, other] = way === 'most' ? [more, fewer] : [fewer, more];
    if (!top) return `the ${way}`;
    if (!other) return `the ${way === 'most' ? 'fewest' : 'most'}`;
    return `the ${ordinal(top + 1)} ${way}`;
  };
  const count = (n, word) => (n ? plural(n, word) : `no ${word}s`);
  const headers = t.hd === 0 ? 'none of them headers' : t.hd === 1 ? 'one of them a header' : `${t.hd} of them headers`;
  const list = t.targets.slice(0, 6).map(target);
  const by = t.deliver.slice(0, 3).map(deliverer);
  return (
    <div className="sp-mu-block" id="set-pieces">
      <div className="sp-section-head" style={{ marginBottom: 4 }}>
        <h3 className="sp-mu-h" style={{ margin: 0 }}>Set pieces</h3>
        <SeasonSwitch seasons={sp.seasons} season={sp.season} onPick={sp.setSeason} />
      </div>
      <p className="sp-tiny sp-ink2" style={{ margin: '0 0 8px' }}>
        <b style={{ color: 'var(--sp-ink)' }}>{count(t.a, 'attempt')}</b> from corners and free kicks into the box in {plural(t.m, 'match')}, {standing('a', 'most')} in the league
        {t.a ? `, ${headers}` : ''}: {count(t.g, 'goal')} from {t.x.toFixed(1)} xG. Against them, {count(t.aa, 'attempt')} and {count(t.ga, 'goal')}, {standing('aa', 'fewest')}.{' '}
        {plural(t.c, 'corner')} won.
      </p>
      {list.length > 0 && (
        <>
          <p className="sp-tiny sp-muted" style={{ margin: '0 0 2px', fontWeight: 700 }}>Who they aim for: his share of the club’s attempts while he was on</p>
          {list.map((p) => (
            <div key={p.id} className="sp-role">
              <span className="sp-tiny" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.short}</span>
              <span className="sp-bar-track">
                <i style={{ width: `${share(p.a, p.on)}%`, background: color }} />
              </span>
              <span className="sp-tiny sp-num" style={{ textAlign: 'right' }}>
                <b>{share(p.a, p.on)}%</b> <span className="sp-muted">{p.a} of {p.on}</span>
              </span>
            </div>
          ))}
        </>
      )}
      {by.length > 0 && (
        <p className="sp-tiny sp-ink2" style={{ margin: '8px 0 0' }}>
          Set up most by {by.map((d, i) => `${i ? (i === by.length - 1 ? ' and ' : ', ') : ''}${d.short} (${d.k})`).join('')}.
        </p>
      )}
      <SetPieceNote />
    </div>
  );
}
