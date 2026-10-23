'use client';
import Link from 'next/link';
import { band } from '@/lib/ratings.mjs';
import { Ball, Boot, Card, Star } from './glyphs';
import Disc from './PlayerDisc';

// Player ratings on the match page (src/lib/ratings.mjs): a pill coloured by band as FotMob does
// it (green from 7, orange for an ordinary game, red under 6, blue from 9), black figures on every band,
// and the best on the pitch blue with a star. Lists put each player's face (or shirt) first and line the
// pills up on the right.

export function RatingPlate({ r, best, size = 'md' }) {
  if (!r) return null;
  return (
    <span className={`sp-rating sp-rating-${band(r.rating)} sp-rating-${size}${best ? ' sp-rating-motm' : ''}`} title={`Rating ${r.rating.toFixed(1)}${best ? ', best on the pitch' : ''}`}>
      {best && <Star on size={size === 'lg' ? 13 : size === 'sm' ? 9 : 10} />}
      {r.rating.toFixed(1)}
    </span>
  );
}

const what = (p) =>
  [p.goals ? `${p.goals > 1 ? `${p.goals} goals` : 'goal'}` : null, p.assists ? `${p.assists > 1 ? `${p.assists} assists` : 'assist'}` : null, p.red ? 'sent off' : null].filter(Boolean).join(', ');

/** Overview: the best on the pitch, then each side's top five, and the way to everyone's. */
export function RatingsPanel({ ratings, lineups, names, colors, faces, onAll, live }) {
  const people = Object.fromEntries(['home', 'away'].flatMap((s) => [...(lineups[s]?.starters ?? []), ...(lineups[s]?.bench ?? [])].map((p) => [p.id, { ...p, side: s }])));
  const list = (side) =>
    Object.entries(ratings.players)
      .filter(([, r]) => r.side === side)
      .sort((a, b) => b[1].raw - a[1].raw)
      .slice(0, 5);
  const best = ratings.best && people[ratings.best];
  const bestR = ratings.best && ratings.players[ratings.best];
  if (!best) return null;
  return (
    <section className="sp-panel">
      <div className="sp-section-head">
        <h2 className="sp-h2">Player ratings</h2>
        <button className="sp-tiny sp-link sp-ink2" onClick={onAll}>Everyone’s</button>
      </div>
      <div className="sp-rating-best">
        <Disc srcs={faces?.[best.id]} number={best.jersey} color={colors[best.side]} size={52} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <b>{best.name}</b>
          <small className="sp-muted">
            {live ? 'Best on the pitch so far' : 'Best on the pitch'} · {names[best.side]}
            {what(best) ? ` · ${what(best)}` : ''}
          </small>
        </span>
        <RatingPlate r={bestR} best size="lg" />
      </div>
      <div className="sp-rating-cols">
        {['home', 'away'].map((side) => (
          <ol key={side} aria-label={`${names[side]} ratings`}>
            <li className="sp-rating-head">{names[side]}</li>
            {list(side).map(([id, r]) => {
              const p = people[id];
              return (
                <li key={id}>
                  <Disc srcs={faces?.[id]} number={p.jersey} color={colors[side]} size={28} />
                  <span className="sp-rating-name">{p.last || p.name}</span>
                  <span className="sp-rating-marks" aria-hidden>
                    {Array.from({ length: p.goals ?? 0 }, (_, i) => <Ball key={`g${i}`} size={11} />)}
                    {Array.from({ length: p.assists ?? 0 }, (_, i) => <Boot key={`a${i}`} size={11} />)}
                    {p.red ? <Card red size={10} /> : null}
                  </span>
                  <RatingPlate r={r} best={id === ratings.best} size="sm" />
                </li>
              );
            })}
          </ol>
        ))}
      </div>
      <p className="sp-tiny sp-muted" style={{ margin: '10px 0 0' }}>
        Our ratings, out of 10, from the match’s own data{live ? ', and they move as it goes' : ''}.{' '}
        <Link className="sp-link" href="/settings#ratings">
          How they’re worked out
        </Link>
      </p>
    </section>
  );
}
