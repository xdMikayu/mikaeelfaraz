'use client';

import { useState } from 'react';
import { Archivo } from 'next/font/google';
import { standingsNow, withScores, moveWords } from '@/lib/sport/as-it-stands.mjs';
import { matchKits } from '@/lib/sport/kit-colors.mjs';
import { countdown } from '@/lib/sport/f1.mjs';
import CIRCUITS from '@/lib/sport/f1-circuits.json';

// Three of Matchday's ideas, on made-up numbers, run by Matchday's own code: the league table as it
// stands (src/lib/sport/as-it-stands.mjs), the kit colours (kit-colors.mjs), the circuit outlines and
// the countdown. Each says in one sentence what the score means, as the app does.

// Matchday's scoreboard type: Archivo, condensed for numbers.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-md' });

/* ------------------------------------------------------------ football: as it stands */

// A made-up six-team table, in order.
const TEAMS = {
  mci: { name: 'Man City', color: '6cabdd' },
  ars: { name: 'Arsenal', color: 'ef0107' },
  bha: { name: 'Brighton', color: '0057b8' },
  bre: { name: 'Brentford', color: 'e30613' },
  eve: { name: 'Everton', color: '003399' },
  liv: { name: 'Liverpool', color: 'c8102e' },
};
const row = (id, pts, gd, gf) => ({ id, pts, gd, gf, ga: gf - gd, p: 6 });
const TABLE = { groups: [{ rows: [row('mci', 18, 11, 15), row('ars', 15, 5, 12), row('bha', 13, 13, 18), row('bre', 10, 6, 11), row('eve', 10, 3, 9), row('liv', 9, 0, 8)] }] };
const live = (id, h, hs, a, as) => ({ id, status: { state: 'in' }, home: { id: h, score: hs }, away: { id: a, score: as } });

function Move({ name, move }) {
  const words = moveWords(move);
  const [, lead, place] = words.match(/^(.*?)(\d+\w\w|top)$/) ?? [null, words, ''];
  return (
    <span className="md-move">
      <strong>{name}</strong> {lead}
      <b>{place}</b>
    </span>
  );
}

function AsItStands() {
  const [score, setScore] = useState({ eve: 0, liv: 0, mci: 0, bha: 0 });
  const goal = (id) => setScore((s) => ({ ...s, [id]: s[id] + 1 }));
  const match = live('m1', 'eve', score.eve, 'liv', score.liv);
  const other = live('m2', 'mci', score.mci, 'bha', score.bha);
  const r = standingsNow(TABLE, match, [other]);
  const table = withScores(TABLE.groups[0].rows, [match, other].map((m) => ({ homeId: m.home.id, awayId: m.away.id, hs: m.home.score, as: m.away.score })));
  const kits = matchKits({ color: TEAMS.eve.color }, { color: TEAMS.liv.color });
  const half = (id, kit) => (
    <div className="md-half" style={{ background: kit.fill, color: kit.ink }}>
      <span>{TEAMS[id].name}</span>
      <button type="button" onClick={() => goal(id)} style={{ color: kit.ink, borderColor: kit.ink }}>
        Goal
      </button>
    </div>
  );
  const changed = Object.values(score).some(Boolean);
  return (
    <div className="md-fb">
      <div>
        <div className="md-hero">
          {half('eve', kits.home)}
          {half('liv', kits.away)}
          <b className="md-plate">
            {score.eve}–{score.liv}
          </b>
        </div>
        <div className="md-band" aria-live="polite">
          <span className="md-band-label">As it stands</span>
          <span className="md-band-main">
            <Move name="Everton" move={r.home} />
            <Move name="Liverpool" move={r.away} />
          </span>
        </div>
        <p className="md-also">
          <span>Also live:</span> <b>Man City {score.mci}–{score.bha} Brighton</b>
          <span className="seg">
            <button type="button" onClick={() => goal('mci')}>
              City goal
            </button>
            <button type="button" onClick={() => goal('bha')}>
              Brighton goal
            </button>
            <button type="button" disabled={!changed} onClick={() => setScore({ eve: 0, liv: 0, mci: 0, bha: 0 })}>
              Kick off again
            </button>
          </span>
        </p>
      </div>
      <ol className="md-table" aria-label="The table as it stands">
        {table.map((t) => {
          const moved = t.was - t.at;
          const playing = ['eve', 'liv', 'mci', 'bha'].includes(t.id);
          return (
            <li key={t.id} className={['eve', 'liv'].includes(t.id) ? 'md-mine' : undefined}>
              <span className="md-pos">{t.at}</span>
              <span className="md-team">
                <i style={{ background: `#${TEAMS[t.id].color}` }} />
                {TEAMS[t.id].name}
                {playing && <small> live</small>}
              </span>
              <span className="md-mv" aria-label={moved ? `${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)}` : 'no change'}>
                {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : ''}
              </span>
              <b className="md-pts">{t.pts}</b>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------ cricket: the last over */

const TARGET = 168;
const START = { runs: 154, wickets: 5, balls: 114 };
const OUTCOMES = [
  ['•', 0, 'a dot ball'],
  ['1', 1, 'one run'],
  ['2', 2, 'two runs'],
  ['4', 4, 'a four'],
  ['6', 6, 'a six'],
  ['W', 0, 'a wicket'],
];
const INDIA = '#1f5fbf';

function LastOver() {
  const [balls, setBalls] = useState([]);
  const runs = START.runs + balls.reduce((t, b) => t + (b === 'W' ? 0 : Number(b === '•' ? 0 : b)), 0);
  const wickets = START.wickets + balls.filter((b) => b === 'W').length;
  const bowled = START.balls + balls.length;
  const left = 120 - bowled;
  const need = TARGET - runs;
  let main;
  if (need <= 0) main = <><strong>India</strong> win by <b>{10 - wickets}</b> wickets{left ? `, ${left} ${left === 1 ? 'ball' : 'balls'} to spare` : ''}</>;
  else if (wickets >= 10 || left === 0) {
    main = need === 1 ? <>Scores level: a <strong>Super Over</strong> decides it</> : <><strong>West Indies</strong> win by <b>{need - 1}</b> runs</>;
  } else main = <><strong>India</strong> need <b>{need}</b> off <b>{left}</b> {left === 1 ? 'ball' : 'balls'}</>;
  const over = need <= 0 || wickets >= 10 || left === 0;
  return (
    <div className="md-ck">
      <p className="md-ck-score">
        <span className="md-ck-team" style={{ background: INDIA }}>
          India <b>{runs}/{wickets}</b>
        </span>
        <span className="mono faint">
          {Math.floor(bowled / 6)}.{bowled % 6} of 20 overs · chasing {TARGET}
        </span>
      </p>
      <div className="md-band" aria-live="polite">
        <span className="md-band-main md-one">{main}</span>
      </div>
      <ol className="md-over" aria-label="This over">
        {Array.from({ length: 6 }, (_, i) => {
          const b = balls[i];
          if (b == null) return <li key={i} className="md-ball md-yet" aria-label="still to come" />;
          const kind = b === 'W' ? 'md-w' : b === '6' ? 'md-six' : b === '4' ? 'md-four' : b === '•' ? 'md-dot' : 'md-run';
          return (
            <li key={i} className={`md-ball ${kind}`} style={b === '4' || b === '6' ? { background: INDIA } : undefined}>
              {b}
            </li>
          );
        })}
      </ol>
      <div className="seg md-ck-btns" aria-label="Bowl the next ball">
        {OUTCOMES.map(([mark, , words]) => (
          <button key={mark} type="button" disabled={over} aria-label={`Bowl ${words}`} onClick={() => setBalls((x) => [...x, mark])}>
            {mark}
          </button>
        ))}
        <button type="button" disabled={!balls.length} onClick={() => setBalls([])}>
          Again
        </button>
      </div>
      <p className="md-legend">
        A four takes the batting side’s colour and a six gets a ring as well, so it still reads for the one man in twelve who
        is colour-blind. A wicket is red.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ F1: the race weekend */

// [circuit, race, round in 2026]
const RACES = [
  ['suzuka', 'Japanese Grand Prix', 3],
  ['monaco', 'Monaco Grand Prix', 6],
  ['silverstone', 'British Grand Prix', 9],
  ['marina_bay', 'Singapore Grand Prix', 17],
  ['americas', 'United States Grand Prix', 18],
];
const MOMENTS = [
  ['week', 'Race week', 'Lights out in', (11 * 24 + 4) * 3600e3],
  ['sat', 'Saturday', 'Qualifying in', (3 * 60 + 12) * 60e3],
  ['live', 'On now', null, 0],
  ['sun', 'Race day', 'Lights out in', 40 * 60e3],
];

function RaceWeek() {
  const [race, setRace] = useState('monaco');
  const [moment, setMoment] = useState('week');
  const c = CIRCUITS[race];
  const [, name, round] = RACES.find(([k]) => k === race);
  const [, , label, ms] = MOMENTS.find(([k]) => k === moment);
  return (
    <div className="md-f1">
      <div className="md-card-ink">
        <svg className="md-track" viewBox={`-3 -3 ${c.w + 6} ${c.h + 6}`} role="img" aria-label={`The ${c.name}`}>
          <path d={c.path} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <p className="md-kick">Round {round} of 23</p>
        <p className="md-name">{name}</p>
        <div className="md-now" aria-live="polite">
          {label ? (
            <>
              <span className="md-label">{label}</span>
              <span className="md-count">
                {countdown(ms).map(([n, unit]) => (
                  <span key={unit}>
                    <b>{n}</b> {unit}
                  </span>
                ))}
              </span>
            </>
          ) : (
            <>
              <span className="md-label md-on">
                <i aria-hidden="true" /> On now
              </span>
              <span className="md-count">
                <b>Qualifying</b>
              </span>
            </>
          )}
        </div>
        <p className="md-facts">
          {(c.length / 1000).toFixed(1)} km a lap · first Grand Prix here {c.firstGp}
        </p>
      </div>
      <div className="md-pick">
        <span className="seg" aria-label="Circuit">
          {RACES.map(([k, n]) => (
            <button key={k} type="button" aria-pressed={race === k} onClick={() => setRace(k)}>
              {n.replace(/ Grand Prix$/, '').replace('United States', 'Austin')}
            </button>
          ))}
        </span>
        <span className="seg" aria-label="When">
          {MOMENTS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={moment === k} onClick={() => setMoment(k)}>
              {l}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

export default function MatchdayMini() {
  return (
    <div className={`md-mini ${archivo.variable}`}>
      <figure className="mf-card mf-wide">
        <figcaption>
          <span>What the score means</span>
          <span className="mono faint">score for either side; the table moves</span>
        </figcaption>
        <AsItStands />
      </figure>
      <figure className="mf-card">
        <figcaption>
          <span>The last over of a chase</span>
          <span className="mono faint">bowl it ball by ball</span>
        </figcaption>
        <LastOver />
      </figure>
      <figure className="mf-card">
        <figcaption>
          <span>The race weekend</span>
          <span className="mono faint">pick a circuit and a moment</span>
        </figcaption>
        <RaceWeek />
      </figure>
      <p className="mf-note mono faint">
        Matchday’s own table maths, kit colours and circuit maps, on a made-up table and a made-up chase.{' '}
        <a href="/sport" target="_blank" rel="noopener">
          Open Matchday ↗
        </a>
      </p>
    </div>
  );
}
