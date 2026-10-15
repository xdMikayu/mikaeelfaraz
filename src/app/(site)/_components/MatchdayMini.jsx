import { Archivo } from 'next/font/google';
import { matchKits } from '@/lib/sport/kit-colors.mjs';
import { countdown } from '@/lib/sport/f1.mjs';
import CIRCUITS from '@/lib/sport/f1-circuits.json';
import { AsItStands, LastOver, RaceWeek } from './MatchdaySnippets';

// Three of Matchday's ideas, on made-up numbers, run by Matchday's own code: the league table as it
// stands (src/lib/sport/as-it-stands.mjs), the kit colours (kit-colors.mjs), the circuit outlines and
// the countdown (f1.mjs). Each says in one sentence what the score means, as the app does.
//
// This part runs when the page is built: what a tap can't change (the kits, the five circuits, the
// countdowns) is worked out here, so the browser loads the table maths but not the circuit file or
// the colour maths. The taps are in MatchdaySnippets.jsx.

// Matchday's scoreboard type: Archivo, condensed for numbers.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-md' });

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

// [circuit, race, round in 2026, button]
const RACES = [
  ['suzuka', 'Japanese Grand Prix', 3, 'Suzuka'],
  ['monaco', 'Monaco Grand Prix', 6, 'Monaco'],
  ['silverstone', 'British Grand Prix', 9, 'Silverstone'],
  ['marina_bay', 'Singapore Grand Prix', 17, 'Singapore'],
  ['americas', 'United States Grand Prix', 18, 'Austin'],
];
// [key, button, label, time to go]; no label while a session is on.
const MOMENTS = [
  ['week', 'Race week', 'Lights out in', (11 * 24 + 4) * 3600e3],
  ['sat', 'Saturday', 'Qualifying in', (3 * 60 + 12) * 60e3],
  ['live', 'On now', null, 0],
  ['sun', 'Race day', 'Lights out in', 40 * 60e3],
];

export default function MatchdayMini() {
  const kits = matchKits({ color: TEAMS.eve.color }, { color: TEAMS.liv.color });
  const races = RACES.map(([id, name, round, short]) => {
    const { name: circuit, w, h, path, length, firstGp } = CIRCUITS[id];
    return { id, name, round, short, circuit, w, h, path, length, firstGp };
  });
  const moments = MOMENTS.map(([key, button, label, ms]) => ({ key, button, label, count: label ? countdown(ms) : null }));
  return (
    <div className={`md-mini ${archivo.variable}`}>
      <figure className="mf-card mf-wide">
        <figcaption>
          <span>What the score means</span>
          <span className="mono faint">score for either side; the table moves</span>
        </figcaption>
        <AsItStands teams={TEAMS} standings={TABLE} kits={kits} />
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
        <RaceWeek races={races} moments={moments} />
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
