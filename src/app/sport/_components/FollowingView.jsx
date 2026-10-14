'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchTeams } from '@/lib/sport/espn.mjs';
import { LEAGUES, LEAGUE_BY_SLUG } from '@/lib/sport/leagues.mjs';
import { usePrefs, useFollow } from './prefs';
import Crest from './Crest';
import { Star } from './glyphs';

export default function FollowingView() {
  const { prefs, update } = usePrefs();
  const router = useRouter();
  // "About the data" and the xG notes moved to the settings; old links still land there.
  useEffect(() => {
    if (['#about', '#xg'].includes(window.location.hash)) router.replace(`/sport/settings${window.location.hash}`);
  }, [router]);
  return (
    <div className="sp-pad" style={{ paddingTop: 16 }}>
      <h1 className="sp-h1">Following</h1>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>
        Saved in this browser only. There are no accounts. Spoilers and dark mode are in{' '}
        <Link className="sp-link" href="/sport/settings">
          Settings
        </Link>
        .
      </p>

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

      <Alerts />

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
