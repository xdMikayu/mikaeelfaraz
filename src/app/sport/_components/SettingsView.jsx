'use client';
import { usePrefs } from './prefs';
import { SPORTS } from './nav';
import { SportGlyph } from './glyphs';

// What applies to every sport: spoilers, the look, and where the data comes from.

export default function SettingsView() {
  const { prefs, update } = usePrefs();
  return (
    <div className="sp-pad" style={{ paddingTop: 16 }}>
      <h1 className="sp-h1">Settings</h1>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 0' }}>For every sport. Saved in this browser only; there are no accounts.</p>

      <Sports />

      <section className="sp-section">
        <h2 className="sp-h2">Spoilers</h2>
        <div className="sp-panel" style={{ padding: '0 16px', marginTop: 10 }}>
          {[
            ['off', 'Show every result'],
            ['mine', 'Hide scores for teams I follow', 'Until you tap Show. Covers their rows, match pages, results and red cards.'],
            ['all', 'Hide every result', 'Tables and championships are hidden too, since they give results away.'],
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

/** The order of the sports in the menu, and the one Matchday opens on. */
function Sports() {
  const { prefs, update } = usePrefs();
  const list = prefs.sports.map((k) => SPORTS.find((s) => s.key === k)).filter(Boolean);
  const move = (i, d) =>
    update((p) => {
      const o = [...p.sports];
      const j = i + d;
      if (j < 0 || j >= o.length) return {};
      [o[i], o[j]] = [o[j], o[i]];
      return { sports: o };
    });
  return (
    <section className="sp-section">
      <h2 className="sp-h2">Sports</h2>
      <p className="sp-small sp-ink2" style={{ margin: '4px 0 10px' }}>
        The order they come in the menu, and the one Matchday opens on.
      </p>
      <div className="sp-panel" style={{ padding: '0 16px' }} role="radiogroup" aria-label="Open Matchday on">
        {list.map((x, i) => (
          <div key={x.key} className="sp-toggle">
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0, flex: 1 }}>
              <input type="radio" name="start" checked={prefs.start === x.key} onChange={() => update({ start: x.key })} style={{ width: 18, height: 18, accentColor: 'var(--sp-ink)' }} />
              <SportGlyph sport={x.key} size={20} />
              <span style={{ fontWeight: 650 }}>{x.label}</span>
              {prefs.start === x.key && <span className="sp-tiny sp-muted">Opens first</span>}
            </label>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="sp-btn sp-btn-quiet sp-icon-btn sp-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${x.label} up`}>
                ↑
              </button>
              <button className="sp-btn sp-btn-quiet sp-icon-btn sp-btn-sm" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${x.label} down`}>
                ↓
              </button>
            </span>
          </div>
        ))}
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
      <p>
        Cricket and tennis come from ESPN through this site: cricket scores can be up to 30 seconds old, the tennis list up to 10 minutes and cricket
        fixtures up to 3 hours.
      </p>
      <p>
        F1 results, championships and the calendar come from Jolpica, the free continuation of the Ergast database. The analysis of each session (laps,
        tyres, pace) comes from F1’s own timing data through FastF1, an hour or two after it ends. During a session the timing is F1’s live feed, read
        every 3 seconds; if that feed is down, OpenF1 stands in where it’s been set up.
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
