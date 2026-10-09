'use client';

import { useMemo, useState } from 'react';
import { CategoryRing, ringSlices, PaceChart, NetWorthLine } from '@/app/finance/_components/charts';

// Mifolio's own chart components, fed with made-up numbers. Hover or tap to read them.
const CATEGORIES = [
  { category: 'Shopping', total: 4445, count: 10 },
  { category: 'Groceries', total: 3230, count: 16 },
  { category: 'Food delivery', total: 2297, count: 30 },
  { category: 'Transport', total: 1836, count: 66 },
  { category: 'Dining & cafés', total: 1764, count: 42 },
  { category: 'Fuel', total: 1275, count: 10 },
  { category: 'Bills', total: 693, count: 3 },
  { category: 'Subscriptions', total: 380, count: 8 },
  { category: 'Entertainment', total: 248, count: 3 },
  { category: 'Health', total: 248, count: 3 },
  { category: 'Government fees', total: 173, count: 6 },
];

const fmt = (n) => `AED ${Math.round(n).toLocaleString('en-US')}`;

// A deterministic wobble so the made-up series look like real spending, not straight lines.
const wobble = (i, seed) => Math.sin(i * 1.7 + seed) * 0.5 + Math.sin(i * 0.37 + seed * 2) * 0.5;

function paceData() {
  const days = 31;
  const today = 19;
  const typical = 5690;
  let cur = 0;
  let prev = 0;
  const points = [];
  for (let d = 1; d <= days; d += 1) {
    const i = d - 1;
    prev += Math.max(0, 150 + wobble(i, 2) * 140 + (d % 7 === 5 ? 220 : 0));
    if (d <= today) cur += Math.max(0, 170 + wobble(i, 5) * 160 + (d % 7 === 4 ? 260 : 0));
    points.push({ i, day: d, label: String(d), cur: d <= today ? Math.round(cur) : null, prev: Math.round(prev), even: Math.round((typical / days) * d) });
  }
  return { unit: 'month', points, projected: Math.round((cur / today) * days), complete: false };
}

function netWorthData() {
  const points = [];
  const start = new Date('2026-07-10T00:00:00Z');
  let v = 24800;
  for (let i = 0; i < 91; i += 1) {
    v += 32 + wobble(i, 1) * 120 + (i % 30 === 24 ? 900 : 0) - (i % 30 === 3 ? 600 : 0);
    const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
    points.push({ day: d, total: Math.round(v) });
  }
  return points;
}

function Ring() {
  const slices = useMemo(() => ringSlices(CATEGORIES), []);
  const total = slices.reduce((t, s) => t + s.total, 0);
  const [sel, setSel] = useState(null);
  // The ring only reacts to clicks; this adds hover by mapping the hovered arc back to its slice.
  const onOver = (e) => {
    const arcs = [...e.currentTarget.querySelectorAll('svg path, svg line')];
    const k = arcs.indexOf(e.target);
    if (k >= 0) setSel(slices[k].key);
  };
  return (
    <div className="mf-ring">
      <div onMouseOver={onOver} onMouseLeave={() => setSel(null)}>
        <CategoryRing
          slices={slices}
          selected={sel}
          onSelect={setSel}
          size={208}
          center={(s) => (
            <div>
              <p className="mf-c-label">{s ? s.label : 'Spent'}</p>
              <p className="mf-c-num">{fmt(s ? s.total : total)}</p>
              <p className="mf-c-sub">{s ? `${Math.round((s.total / total) * 100)}% · ${s.count} purchases` : `${CATEGORIES.length} categories`}</p>
            </div>
          )}
        />
      </div>
      <ul className="mf-chips">
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={sel === s.key}
              onMouseEnter={() => setSel(s.key)}
              onMouseLeave={() => setSel(null)}
              onFocus={() => setSel(s.key)}
              onBlur={() => setSel(null)}
              onClick={() => setSel(sel === s.key ? null : s.key)}
              style={{ opacity: sel && sel !== s.key ? 0.4 : 1 }}
            >
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{fmt(s.total)}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MifolioMini() {
  const pace = useMemo(paceData, []);
  const nw = useMemo(netWorthData, []);
  const last = nw[nw.length - 1].total;
  const first = nw[0].total;
  return (
    <div className="mf-mini">
      <figure className="mf-card mf-wide">
        <figcaption>
          <span>Where it went</span>
          <span className="mono faint">last 3 months · hover or tap a slice</span>
        </figcaption>
        <Ring />
      </figure>
      <figure className="mf-card">
        <figcaption>
          <span>This month’s pace</span>
          <span className="mono faint">against last month and a typical month</span>
        </figcaption>
        <PaceChart pace={pace} height={190} />
      </figure>
      <figure className="mf-card">
        <figcaption>
          <span>Net worth</span>
          <span className="mono faint">{fmt(last)} · {last >= first ? '+' : '−'}{fmt(Math.abs(last - first))} over 3 months</span>
        </figcaption>
        <NetWorthLine points={nw} height={190} />
      </figure>
      <p className="mf-note mono faint">
        Mifolio’s own charts, on made-up numbers. <a href="/finance?demo=1" target="_blank" rel="noopener">Open the full demo ↗</a>
      </p>
    </div>
  );
}
