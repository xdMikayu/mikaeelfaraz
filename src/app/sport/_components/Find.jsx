'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FEATURES, FEATURE_GROUPS, findFeatures, fold } from './nav';
import { LEAGUES } from '@/lib/sport/leagues.mjs';
import { fetchTeams } from '@/lib/sport/espn.mjs';
import { usePrefs } from './prefs';
import Crest from './Crest';
import { CloseIcon, SearchIcon } from './glyphs';

// Search for everything: with nothing typed, the whole of Matchday listed by sport, so nothing is
// only reachable by knowing where it is; typing narrows it to features, competitions, clubs and
// FPL players. Clubs come from ESPN and players from FPL, both loaded the first time they're needed.

const teamLists = {};
/** Clubs in the viewer's competitions with tables, each with the first of them it plays in. */
function loadTeams(slugs) {
  const one = (slug) =>
    (teamLists[slug] ??= fetchTeams(slug).then(
      (list) => list.map((t) => ({ ...t, slug })),
      () => {
        delete teamLists[slug];
        return [];
      }
    ));
  return Promise.all(slugs.map(one)).then((lists) => {
    const seen = new Map();
    for (const t of lists.flat()) if (!seen.has(t.id)) seen.set(t.id, t);
    return [...seen.values()];
  });
}

let fplStatic = null;
const loadFpl = () =>
  (fplStatic ??= fetch('/api/sport/fpl/static')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`FPL ${r.status}`))))
    .catch((e) => {
      fplStatic = null;
      throw e;
    }));

const POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

/** Every word of the query starts a word of the name (or is inside it, for longer queries). */
const matches = (name, words) => {
  const f = fold(name);
  const parts = f.split(' ');
  return words.every((w) => parts.some((p) => p.startsWith(w)) || (w.length >= 4 && f.includes(w)));
};

export function useFind() {
  const [open, setOpen] = useState(false);
  const proxy = useRef(null);
  // iPhone only brings the keyboard up for a field focused during the tap itself, and the sheet's
  // own field doesn't exist yet: a stand-in takes the focus, then hands it over (the keyboard stays).
  const show = useCallback(() => {
    try {
      const p = (proxy.current ??= Object.assign(document.createElement('input'), { className: 'sp-find-proxy', type: 'text', tabIndex: -1 }));
      p.setAttribute('aria-hidden', 'true');
      if (!p.isConnected) document.body.appendChild(p);
      p.focus({ preventScroll: true });
    } catch {}
    setOpen(true);
  }, []);
  // The field lets go of the keyboard as the sheet closes (some browsers don't say so when it goes inert).
  const close = useCallback(() => {
    const a = document.activeElement;
    if (a?.closest?.('.sp-find') || a?.classList?.contains('sp-find-proxy')) a.blur();
    setOpen(false);
  }, []);
  return { open, show, close };
}

export default function Find({ open, onClose }) {
  const { prefs } = usePrefs();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [teams, setTeams] = useState(null);
  const [fpl, setFpl] = useState(null);
  const input = useRef(null);
  const words = useMemo(() => fold(q).split(' ').filter(Boolean), [q]);
  const typed = words.join('').length;

  useEffect(() => {
    if (!open) return undefined;
    input.current?.focus({ preventScroll: true });
    input.current?.select();
    const key = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', key);
    const root = document.documentElement;
    const was = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      root.style.overflow = was;
    };
  }, [open, onClose]);

  // Clubs from the second letter, FPL players from the third.
  const slugs = useMemo(() => prefs.order.filter((s) => !prefs.off.includes(s) && LEAGUES.find((l) => l.slug === s)?.table), [prefs.order, prefs.off]);
  useEffect(() => {
    if (!open || typed < 2 || teams) return;
    loadTeams(slugs).then(setTeams, () => setTeams([]));
  }, [open, typed, teams, slugs]);
  useEffect(() => {
    if (!open || typed < 3 || fpl) return;
    loadFpl().then(setFpl, () => setFpl({ elements: [], teams: [] }));
  }, [open, typed, fpl]);

  const results = useMemo(() => {
    if (!typed) return null;
    const features = findFeatures(q).slice(0, 8);
    const comps = LEAGUES.filter((l) => matches(`${l.name} ${l.short} ${l.country}`, words)).slice(0, 5);
    const mine = new Set(prefs.teams.map((t) => t.id));
    const clubs = [...prefs.teams.map((t) => ({ ...t, slug: t.leagues?.[0] })), ...(teams ?? []).filter((t) => !mine.has(t.id))]
      .filter((t) => matches(`${t.name} ${t.short ?? ''}`, words))
      .slice(0, 8);
    const fplTeams = Object.fromEntries((fpl?.teams ?? []).map((t) => [t.id, t]));
    const players = typed < 3 ? [] : (fpl?.elements ?? []).filter((e) => e.status !== 'u' && matches(`${e.name} ${e.first} ${e.second}`, words)).sort((a, b) => b.total - a.total).slice(0, 8);
    return { features, comps, clubs, players, fplTeams };
  }, [typed, q, words, prefs.teams, teams, fpl]);

  const first = results && (results.features[0]?.href ?? (results.clubs[0] && teamHref(results.clubs[0])) ?? (results.players[0] && playerHref(results.players[0])) ?? (results.comps[0] && compHref(results.comps[0])));
  const none = results && !results.features.length && !results.comps.length && !results.clubs.length && !results.players.length;
  const loading = results && ((typed >= 2 && !teams) || (typed >= 3 && !fpl));

  return (
    <div className={`sp-find${open ? ' sp-find-open' : ''}`} aria-hidden={!open} inert={open ? undefined : ''}>
      <div className="sp-find-scrim" onClick={onClose} />
      <div className="sp-find-panel" role="dialog" aria-modal="true" aria-label="Search Matchday">
        <form
          className="sp-find-top"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (first) {
              router.push(first);
              onClose();
            }
          }}
        >
          <label className="sp-find-field">
            <SearchIcon />
            <input
              ref={input}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Clubs, players, competitions, features"
              aria-label="Search Matchday"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="sp-find-clear"
                onClick={() => {
                  setQ('');
                  input.current?.focus();
                }}
                aria-label="Clear"
              >
                <CloseIcon />
              </button>
            )}
          </label>
          <button type="button" className="sp-find-done" onClick={onClose}>
            Done
          </button>
        </form>
        <div className="sp-find-body" onClick={(e) => e.target.closest('a') && onClose()}>
          {!results && <Everything teams={prefs.teams} />}
          {results && (
            <>
              <Group title="Features" items={results.features} render={(f) => <FeatureRow key={f.href + f.title} f={f} />} />
              <Group
                title="Clubs"
                items={results.clubs}
                render={(t) => (
                  <Link key={t.id} href={teamHref(t)} className="sp-find-row">
                    <Crest src={t.logo} size={24} />
                    <span>
                      <b>{t.name}</b>
                      <small>{LEAGUES.find((l) => l.slug === t.slug)?.name ?? 'Club'}</small>
                    </span>
                  </Link>
                )}
              />
              <Group
                title="Fantasy players"
                items={results.players}
                render={(e) => (
                  <Link key={e.id} href={playerHref(e)} className="sp-find-row">
                    <span className="sp-find-pos">{POS[e.type]}</span>
                    <span>
                      <b>
                        {e.first} {e.second}
                      </b>
                      <small>
                        {results.fplTeams[e.team]?.name} · £{e.cost.toFixed(1)}m · {e.total} points · compare
                      </small>
                    </span>
                  </Link>
                )}
              />
              <Group
                title="Competitions"
                items={results.comps}
                render={(l) => (
                  <Link key={l.slug} href={compHref(l)} className="sp-find-row">
                    <span>
                      <b>{l.name}</b>
                      <small>
                        {l.country} · {l.table ? 'table' : 'scores'}
                      </small>
                    </span>
                  </Link>
                )}
              />
              {loading && <p className="sp-find-note">Looking through clubs and players…</p>}
              {none && !loading && <p className="sp-find-note">Nothing called “{q.trim()}”. Try a club, a player’s surname, or what you want to see: prices, set pieces, lineups.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const teamHref = (t) => `/sport/team?id=${t.id}${t.slug ? `&l=${t.slug}` : ''}`;
const playerHref = (e) => `/sport/fantasy?tab=players&view=compare&p=${e.id}`;
const compHref = (l) => (l.table ? `/sport/table/${l.slug}` : '/sport');

function Group({ title, items, render }) {
  if (!items.length) return null;
  return (
    <section className="sp-find-group">
      <h2>{title}</h2>
      {items.map(render)}
    </section>
  );
}

function FeatureRow({ f }) {
  const sport = FEATURE_GROUPS.find(([k]) => k === f.sport)?.[1];
  return (
    <Link href={f.href} className="sp-find-row">
      <span>
        <b>{f.title}</b>
        <small>
          {sport === f.where ? sport : `${sport} › ${f.where}`} · {f.blurb}
        </small>
      </span>
    </Link>
  );
}

/** Nothing typed: the viewer's clubs, then every feature, sport by sport. */
function Everything({ teams }) {
  return (
    <>
      {teams.length > 0 && (
        <section className="sp-find-group">
          <h2>Your teams</h2>
          <div className="sp-find-chips">
            {teams.slice(0, 12).map((t) => (
              <Link key={t.id} href={teamHref({ ...t, slug: t.leagues?.[0] })}>
                <Crest src={t.logo} size={18} /> {t.name}
              </Link>
            ))}
          </div>
        </section>
      )}
      {FEATURE_GROUPS.map(([key, label]) => {
        const list = FEATURES.filter((f) => f.sport === key);
        return (
          <section key={key} className="sp-find-group">
            <h2>{label}</h2>
            {list.map((f) => (
              <Link key={f.href + f.title} href={f.href} className="sp-find-row">
                <span>
                  <b>{f.title}</b>
                  <small>
                    {f.where !== label ? `${f.where} · ` : ''}
                    {f.blurb}
                  </small>
                </span>
              </Link>
            ))}
          </section>
        );
      })}
    </>
  );
}
