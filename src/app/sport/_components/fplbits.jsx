'use client';
import { useState } from 'react';
import { kickoff, shortDate } from './time';

// Small pieces shared by the fantasy screens.

// The game's own artwork, served from its public CDN: kits by club code, photos by Opta id.
export const shirt = (code, gk) => `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}${gk ? '_1' : ''}-110.png`;
export const photo = (opta, big) => (opta ? `https://resources.premierleague.com/premierleague25/photos/players/${big ? '110x140' : '40x40'}/${String(opta).replace(/^p/, '')}.png` : null);

export const signed = (v) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);
export const one = (v) => (Math.round(v * 10) / 10).toFixed(1);

export const fixturesOf = (teamId, ctx) => ctx.fixtures.filter((f) => f.home === teamId || f.away === teamId);

const isDone = (f) => f.finished || f.finishedProvisional;

export function fxShort(f, teamId, teams) {
  const home = f.home === teamId;
  const opp = teams[home ? f.away : f.home]?.short ?? '';
  if (isDone(f)) return `${opp} ${home ? f.hs : f.as}–${home ? f.as : f.hs}`;
  if (f.started) return `${opp} ${f.minutes}′`;
  return `${opp} (${home ? 'H' : 'A'})`;
}

export function fxLong(f, teamId, teams) {
  const home = f.home === teamId;
  const opp = teams[home ? f.away : f.home]?.short ?? '';
  const vs = `${opp} (${home ? 'H' : 'A'})`;
  // The player's own side first, so "AVL (A) 0–1" means his team is behind.
  const score = home ? `${f.hs}–${f.as}` : `${f.as}–${f.hs}`;
  if (isDone(f)) return `${vs} ${score} FT`;
  if (f.started) return `${vs} ${score}, ${f.minutes}′`;
  return `${vs} ${shortDate(f.kickoff)} ${kickoff(f.kickoff)}`;
}

const day = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });

/**
 * Where a player is in his gameweek, for the pitch plates and list rows.
 * kind: done | live | bench (his match is on, he isn't) | todo | out (didn't play) | blank
 * when: short text for the plate or status column ("FT", "63′", "Sun 16:30").
 */
export function phase(state, fixtures) {
  const s = state.status;
  const live = fixtures.find((f) => f.started && !isDone(f));
  const next = fixtures.filter((f) => !f.started).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
  if (s === 'playing') return { kind: 'live', when: `${live?.minutes ?? ''}′` };
  if (s === 'not on yet') return { kind: 'bench', when: `${live?.minutes ?? ''}′` };
  if (s === 'to play') return { kind: 'todo', when: next ? `${day(next.kickoff)} ${kickoff(next.kickoff)}` : 'Later' };
  if (s === 'played') return { kind: 'done', when: 'FT' };
  if (s === 'did not play') return { kind: 'out', when: 'FT' };
  return { kind: 'blank', when: 'No match' };
}

/** Player photo, or his club kit when the game has no photo for him yet. */
export function Face({ el, teams, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const src = failed || !el.opta ? shirt(teams[el.team]?.code, el.type === 1) : photo(el.opta);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="sp-photo" src={src} alt="" width={size} height={size} onError={() => setFailed(true)} style={{ width: size, height: size, ...(failed ? { objectFit: 'contain', padding: 4 } : null) }} />
  );
}
