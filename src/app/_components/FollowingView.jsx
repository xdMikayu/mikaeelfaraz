'use client';
import { useEffect, useState } from 'react';
import { fetchTeams } from '@/lib/sport/espn.mjs';
import { LEAGUES, LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { usePrefs, useFollow } from './prefs';
import Crest from './Crest';
import { Star } from './glyphs';

export default function FollowingView() {
  const { prefs, update } = usePrefs();
  return (
    <div className="sp-pad" style={{ paddingTop: 16 }}>
      <h1 className="sp-h1">Following</h1>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>Saved in this browser only. There are no accounts.</p>

      <Teams />

      <section className="sp-section">
        <h2 className="sp-h2">Competitions</h2>
        <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>The order here is the order on the scores page. A team you follow still shows up when its competition is off.</p>
        <div className="sp-panel" style={{ padding: '0 16px' }}>
          {prefs.order.map((slug, i) => {
            const l = LEAGUE_BY_SLUG[slug];
            const on = !prefs.off.includes(slug);
            const move = (d) =>
              update((p) => {
                const o = [...p.order];
                const j = i + d;
                if (j < 0 || j >= o.length) return {};
                [o[i], o[j]] = [o[j], o[i]];
                return { order: o };
              });
            return (
              <div key={slug} className="sp-toggle">
                <span style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 550, color: on ? 'var(--sp-ink)' : 'var(--sp-muted)' }}>{l.name}</span>
                  <span className="sp-tiny sp-muted" style={{ display: 'block' }}>{l.country}</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="sp-btn sp-btn-quiet sp-icon-btn sp-btn-sm" onClick={() => move(-1)} disabled={i === 0} aria-label={`Move ${l.name} up`}>↑</button>
                  <button className="sp-btn sp-btn-quiet sp-icon-btn sp-btn-sm" onClick={() => move(1)} disabled={i === prefs.order.length - 1} aria-label={`Move ${l.name} down`}>↓</button>
                  <button role="switch" aria-checked={on} aria-label={`Show ${l.name}`} className="sp-switch" style={{ marginLeft: 8 }} onClick={() => update((p) => ({ off: on ? [...p.off, slug] : p.off.filter((s) => s !== slug) }))} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sp-section">
        <h2 className="sp-h2">Spoilers</h2>
        <div className="sp-panel" style={{ padding: '0 16px', marginTop: 10 }}>
          {[
            ['off', 'Show every score'],
            ['mine', 'Hide scores for teams I follow', 'Until you tap Show. Covers their rows, match pages, results and red cards.'],
            ['all', 'Hide every score', 'Tables are hidden too, since they give results away.'],
          ].map(([k, label, note]) => (
            <label key={k} className="sp-toggle" style={{ cursor: 'pointer' }}>
              <span>
                <span style={{ fontWeight: 550 }}>{label}</span>
                {note && <span className="sp-tiny sp-muted" style={{ display: 'block' }}>{note}</span>}
              </span>
              <input type="radio" name="spoilers" checked={prefs.spoilers === k} onChange={() => update({ spoilers: k })} style={{ width: 18, height: 18, accentColor: 'var(--sp-ink)' }} />
            </label>
          ))}
        </div>
      </section>

      <Alerts />

      <section className="sp-section">
        <h2 className="sp-h2">Appearance</h2>
        <div className="sp-tabs" style={{ marginTop: 6 }} role="radiogroup" aria-label="Theme">
          {[['system', 'Match my device'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => (
            <button key={k} role="radio" aria-checked={prefs.theme === k} onClick={() => update({ theme: k })}>{l}</button>
          ))}
        </div>
      </section>

      <About />
    </div>
  );
}

function Teams() {
  const { teams, toggle, isFollowed } = useFollow();
  const { update } = usePrefs();
  const [slug, setSlug] = useState('');
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!slug) return setList(null);
    let off = false;
    setList(undefined);
    fetchTeams(slug).then((t) => !off && setList(t)).catch(() => !off && setList([]));
    return () => {
      off = true;
    };
  }, [slug]);
  const move = (i, d) =>
    update((p) => {
      const t = [...p.teams];
      const j = i + d;
      if (j < 0 || j >= t.length) return {};
      [t[i], t[j]] = [t[j], t[i]];
      return { teams: t };
    });
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Teams</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>Their matches go to the top of the scores page, whichever competition they’re in.</p>
      {teams.length > 0 && (
        <div className="sp-panel" style={{ padding: '0 16px', marginBottom: 12 }}>
          {teams.map((t, i) => (
            <div key={t.id} className="sp-toggle">
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Crest src={t.logo} size={22} />
                <span style={{ fontWeight: 550 }}>{t.name}</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="sp-btn sp-btn-quiet sp-icon-btn sp-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${t.name} up`}>↑</button>
                <button className="sp-btn sp-btn-quiet sp-icon-btn sp-btn-sm" onClick={() => move(i, 1)} disabled={i === teams.length - 1} aria-label={`Move ${t.name} down`}>↓</button>
                <button className="sp-btn sp-btn-sm" onClick={() => toggle(t)}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      )}
      <label className="sp-small sp-ink2" htmlFor="pick">Add teams from</label>
      <select id="pick" className="sp-select" style={{ display: 'block', marginTop: 6, width: '100%', maxWidth: 360 }} value={slug} onChange={(e) => setSlug(e.target.value)}>
        <option value="">Choose a competition</option>
        {LEAGUES.filter((l) => l.table).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
      </select>
      {list === undefined && <p className="sp-note">Loading clubs…</p>}
      {list?.length === 0 && <p className="sp-note">Couldn’t load the clubs for that competition.</p>}
      {list?.length > 0 && (
        <div className="sp-panel" style={{ padding: '0 16px', marginTop: 10 }}>
          {list.map((t) => {
            const on = isFollowed(t.id);
            return (
              <div key={t.id} className="sp-toggle">
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Crest src={t.logo} size={22} /> {t.name}</span>
                <button className="sp-btn sp-btn-sm" aria-pressed={on} onClick={() => toggle({ id: t.id, name: t.short, logo: t.logo, leagues: [slug] })}>
                  <Star on={on} size={13} /> {on ? 'Following' : 'Follow'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Alerts() {
  const { prefs, update } = usePrefs();
  const [perm, setPerm] = useState('default');
  useEffect(() => setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission), []);
  const turnOn = async () => {
    if (perm === 'unsupported') return;
    const p = perm === 'granted' ? 'granted' : await Notification.requestPermission();
    setPerm(p);
    update({ alerts: p === 'granted' ? !prefs.alerts : false });
  };
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Alerts</h2>
      <div className="sp-panel" style={{ padding: '0 16px', marginTop: 10 }}>
        <div className="sp-toggle">
          <span>
            <span style={{ fontWeight: 550 }}>Kick-off, goals, red cards and full time</span>
            <span className="sp-tiny sp-muted" style={{ display: 'block' }}>
              For teams you follow, while a Matchday tab is open (scores page or match page). Off for teams under spoiler protection.
              {perm === 'denied' && ' Your browser is blocking notifications for this site; allow them in its site settings.'}
              {perm === 'unsupported' && ' This browser doesn’t support notifications. On iPhone, add Matchday to your home screen first.'}
            </span>
          </span>
          <button role="switch" aria-checked={prefs.alerts && perm === 'granted'} aria-label="Alerts" className="sp-switch" onClick={turnOn} disabled={perm === 'denied' || perm === 'unsupported'} />
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="sp-section sp-prose" id="about" style={{ paddingBottom: 24 }}>
      <h2 className="sp-h2" style={{ marginBottom: 8, color: 'var(--sp-ink)' }}>About the data</h2>
      <p>
        Scores, events, lineups, stats and commentary come from ESPN’s public match feed, read straight from your browser. Pages refresh every 20 seconds
        while a match is on and stop when nothing is live. ESPN publishes a few seconds to a minute after the TV pictures, so this is not faster than
        watching.
      </p>
      <p>
        Fantasy numbers come from the official Fantasy Premier League game, fetched through this site because FPL doesn’t allow browsers to call it
        directly. Totals are FPL’s own, including the bonus it now projects during matches. Autosubs and vice-captaincy are worked out here as if every
        match ended now, and are marked as projected.
      </p>
      <h3 className="sp-h3" id="xg" style={{ margin: '18px 0 6px', color: 'var(--sp-ink)' }}>How the xG estimate works</h3>
      <p>
        Expected goals (xG) is the chance that a shot is scored, judged from shots like it. ESPN gives each shot’s position and Opta’s description of it
        (header or foot, from a cross or a through ball, a corner, a fast break). A logistic model turns those into a probability.
      </p>
      <p>
        It was fitted on 25,513 shots from StatsBomb’s free open data (the 2015/16 Premier League, Serie A, Bundesliga and Ligue 1, the 2022 World Cup
        and Euro 2024) and tested on 6,454 shots from 258 matches it hadn’t seen. On those it predicted 610 goals against 607 scored, and its team totals
        per match correlated 0.90 with StatsBomb’s own xG. It can’t see where defenders and the keeper were, which the paid models can, so single shots
        are rougher than the totals. Penalties count as 0.75.
      </p>
      <p>On Premier League matches the page also shows Opta’s xG, summed from FPL’s live player data, so you can compare the two.</p>
      <p className="sp-tiny sp-muted">
        Club crests and data belong to their owners. This is a personal, non-commercial project with no ads and no tracking.
      </p>
    </section>
  );
}
