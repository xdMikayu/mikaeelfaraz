import { Archivo } from 'next/font/google';
import { crest } from '@/lib/sport/espn.mjs';
import { matchKits, inkOn } from '@/lib/sport/kit-colors.mjs';
import CIRCUITS from '@/lib/sport/f1-circuits.json';
import { Football, Cricket, Formula1 } from './MatchdaySnippets';

// Three of Matchday's screens, phone-sized, on made-up numbers: a derby with the table as it stands
// (src/lib/sport/as-it-stands.mjs), the last over of a chase, and the end of an F1 season with
// Matchday's title sums (f1.mjs). Drawn as the app draws them, with ESPN's crests, Matchday's kit
// colours (kit-colors.mjs) and its circuit maps.
//
// This part runs when the page is built: what a tap can't change (crests, kits, circuits, team
// colours) is worked out here, so the browser loads the screens and the sums, not the circuit file or
// the colour maths. The taps are in MatchdaySnippets.jsx.

// Matchday's scoreboard type: Archivo, condensed for numbers.
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap', variable: '--font-md' });

/* ------------------------------------------------------------ football */

// [name, ESPN id, colour]
const CLUBS = {
  mci: ['Man City', 382, '6cabdd'],
  ars: ['Arsenal', 359, 'ef0107'],
  bha: ['Brighton', 331, '0057b8'],
  bre: ['Brentford', 337, 'e30613'],
  eve: ['Everton', 368, '003399'],
  liv: ['Liverpool', 364, 'c8102e'],
};
// A made-up top six after six games, in order: [club, points, goal difference, scored].
const row = ([id, pts, gd, gf]) => ({ id, pts, gd, gf, ga: gf - gd, p: 6 });
const TABLE = {
  groups: [
    {
      rows: [
        ['mci', 18, 11, 15],
        ['ars', 15, 5, 12],
        ['bha', 13, 13, 18],
        ['bre', 10, 6, 11],
        ['eve', 10, 3, 9],
        ['liv', 9, 0, 8],
      ].map(row),
    },
  ],
};

/* ------------------------------------------------------------ cricket */

const CHASE = {
  meta: 'T20 international · Bridgetown',
  team: 'India',
  other: 'West Indies',
  otherScore: '167/7',
  colors: { first: '7b1e3a', chase: '1f5fbf' },
  target: 168,
  runs: 154,
  wickets: 5,
  balls: 114,
  bowler: 'Holder',
  prev: { bowler: 'Joseph', balls: ['1', '1', '4', '•', '2', '1'] },
  // On strike first; `part` is each one's share of the partnership.
  batters: [
    { name: 'Pandya', runs: 38, balls: 22, part: 30, partBalls: 17 },
    { name: 'Jadeja', runs: 11, balls: 8, part: 11, partBalls: 8 },
  ],
  next: ['Axar', 'Kuldeep', 'Arshdeep', 'Bumrah', 'Siraj'],
};

/* ------------------------------------------------------------ F1 */

// The 2026 season's last six rounds: [circuit, round, race, country, where, city].
const ROUNDS = [
  ['americas', 18, 'United States Grand Prix', 'USA', 'Circuit of the Americas, Austin', 'Austin'],
  ['rodriguez', 19, 'Mexico City Grand Prix', 'Mexico', 'Autódromo Hermanos Rodríguez', 'Mexico City'],
  ['interlagos', 20, 'São Paulo Grand Prix', 'Brazil', 'Interlagos, São Paulo', 'São Paulo'],
  ['vegas', 21, 'Las Vegas Grand Prix', 'USA', 'Las Vegas Strip Circuit', 'Las Vegas'],
  ['losail', 22, 'Qatar Grand Prix', 'Qatar', 'Lusail International Circuit', 'Lusail'],
  ['yas_marina', 23, 'Abu Dhabi Grand Prix', 'UAE', 'Yas Marina Circuit', 'Abu Dhabi'],
];
// Team colours as F1 has them for 2026 (the app reads them from its season index).
const TEAMS = { mercedes: ['Mercedes', '00D7B6'], red_bull: ['Red Bull', '4781D7'], ferrari: ['Ferrari', 'ED1131'], mclaren: ['McLaren', 'F47600'] };
// A made-up title fight going into round 18: [id, surname, team, points].
const DRIVERS = [
  ['russell', 'Russell', 'mercedes', 298],
  ['verstappen', 'Verstappen', 'red_bull', 291],
  ['leclerc', 'Leclerc', 'ferrari', 280],
  ['norris', 'Norris', 'mclaren', 268],
  ['antonelli', 'Antonelli', 'mercedes', 262],
];

export default function MatchdayMini() {
  const logo = (id, dark) => crest(`https://a.espncdn.com/i/teamlogos/soccer/${dark ? '500-dark' : '500'}/${id}.png`, 32);
  const clubs = Object.fromEntries(Object.entries(CLUBS).map(([k, [name, id, color]]) => [k, { name, color, crest: logo(id), crestDark: logo(id, true) }]));
  const kits = matchKits({ color: CLUBS.eve[2] }, { color: CLUBS.liv[2] });
  const ck = matchKits({ color: CHASE.colors.first }, { color: CHASE.colors.chase });
  const rounds = ROUNDS.map(([id, round, name, country, where, city]) => {
    const { name: circuit, w, h, path, length, firstGp } = CIRCUITS[id];
    return { id, round, name, country, where, city, circuit, w, h, path, length, firstGp };
  });
  const drivers = DRIVERS.map(([id, last, team, points]) => ({ id, last, points, team: TEAMS[team][0], color: `#${TEAMS[team][1]}`, ink: inkOn(TEAMS[team][1]) }));
  return (
    <div className={`mdp ${archivo.variable}`}>
      <p className="mdp-swipe mono faint" aria-hidden="true">
        Swipe for cricket and F1 →
      </p>
      <div className="mdp-row">
        <figure className="mdp-item">
          <div className="mdp-phone">
            <Football clubs={clubs} standings={TABLE} kits={{ home: kits.home, away: kits.away }} />
          </div>
          <figcaption>
            <b>What the score means</b>
            Tap a crest to score, in either match. The band and the table move as it stands.
          </figcaption>
        </figure>
        <figure className="mdp-item">
          <div className="mdp-phone">
            <Cricket chase={CHASE} kits={{ first: ck.home, chase: ck.away }} />
          </div>
          <figcaption>
            <b>The last over</b>
            Bowl it a ball at a time. The band keeps the sum: runs needed off the balls left.
          </figcaption>
        </figure>
        <figure className="mdp-item">
          <div className="mdp-phone">
            <Formula1 drivers={drivers} rounds={rounds} total={23} season={2026} />
          </div>
          <figcaption>
            <b>The title race</b>
            Pick who wins each of the last six races. Matchday’s sums say who can still take it.
          </figcaption>
        </figure>
      </div>
      <p className="mf-note mono faint">
        Matchday’s own screens and sums, on a made-up table, chase and title race.{' '}
        <a href="/sport" target="_blank" rel="noopener">
          Open Matchday ↗
        </a>
      </p>
    </div>
  );
}
