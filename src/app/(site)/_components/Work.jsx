'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { selected } from '../_data/work';

// Columns: where data comes from, what processes it, where it is kept, where it ends up.
const COLS = [
  { x: 16, label: 'sources' },
  { x: 246, label: 'logic' },
  { x: 478, label: 'store' },
  { x: 694, label: 'where people see it' },
];
const W = 176;
const H = 30;

const NODES = {
  tableau: { c: 0, y: 44, t: 'BI tool' },
  crmsrc: { c: 0, y: 90, t: 'CRM' },
  desk: { c: 0, y: 136, t: 'Helpdesk' },
  panels: { c: 0, y: 182, t: 'Internal APIs' },
  forms: { c: 0, y: 228, t: 'Merchant forms' },
  sre: { c: 0, y: 274, t: 'Production alerts' },
  maps: { c: 0, y: 320, t: 'Public web data' },

  deluge: { c: 1, y: 90, t: 'CRM automation' },
  fns: { c: 1, y: 182, t: 'Serverless functions' },
  py: { c: 1, y: 320, t: 'Python jobs' },

  db: { c: 2, y: 136, t: 'Postgres' },
  blobs: { c: 2, y: 228, t: 'Background jobs' },

  tasks: { c: 3, y: 44, t: 'CRM tasks' },
  dash: { c: 3, y: 106, t: 'Dashboards' },
  chat: { c: 3, y: 168, t: 'Slack and WhatsApp' },
  tickets: { c: 3, y: 230, t: 'Support tickets' },
  venues: { c: 3, y: 274, t: 'Merchant setup' },
  decks: { c: 3, y: 320, t: 'Reports' },
};

// Each edge lists the projects that use it.
const EDGES = [
  ['tableau', 'deluge', ['crm']],
  ['crmsrc', 'deluge', ['crm']],
  ['panels', 'deluge', ['crm']],
  ['deluge', 'tasks', ['crm']],
  ['deluge', 'chat', ['crm']],
  ['tableau', 'fns', ['platform', 'reporting']],
  ['crmsrc', 'fns', ['platform', 'reporting', 'onboarding']],
  ['desk', 'fns', ['platform', 'incidents']],
  ['panels', 'fns', ['platform', 'onboarding']],
  ['forms', 'fns', ['onboarding']],
  ['sre', 'fns', ['incidents']],
  ['fns', 'db', ['platform', 'reporting', 'incidents']],
  ['fns', 'blobs', ['platform', 'onboarding']],
  ['db', 'dash', ['platform', 'reporting']],
  ['fns', 'chat', ['platform', 'reporting', 'onboarding']],
  ['fns', 'tickets', ['incidents']],
  ['fns', 'venues', ['onboarding']],
  ['maps', 'py', ['reviews']],
  ['panels', 'py', ['reviews']],
  ['py', 'decks', ['reviews']],
];

// Step-through traces: one edge per step, in the order a record actually moves.
const TRACES = {
  platform: [
    ['tableau', 'fns', 'Scheduled functions pull the numbers from the BI tool.'],
    ['crmsrc', 'fns', 'They read the matching records from the CRM.'],
    ['fns', 'db', 'Everything lands in Postgres, behind row-level security.'],
    ['db', 'dash', 'The dashboards read from there, behind a company sign-in.'],
    ['fns', 'chat', 'The same functions post alerts and summaries where people already work.'],
  ],
  onboarding: [
    ['crmsrc', 'fns', 'The deal starts in the CRM.'],
    ['forms', 'fns', 'The merchant fills in their details from a secure link.'],
    ['panels', 'fns', 'After a review, publishing sets them up through the company’s existing APIs and checks every setting was saved.'],
    ['fns', 'blobs', 'The slow work runs in the background.'],
    ['fns', 'venues', 'The merchant is live, with their print artwork ready.'],
    ['fns', 'chat', 'The team is told in Slack.'],
  ],
  reporting: [
    ['tableau', 'fns', 'A scheduled job queries the BI tool.'],
    ['crmsrc', 'fns', 'It reads the CRM.'],
    ['fns', 'db', 'The results are written to Postgres and match the BI tool’s totals.'],
    ['db', 'dash', 'The dashboards read from there.'],
    ['fns', 'chat', 'People get their own numbers in Slack.'],
  ],
  crm: [
    ['tableau', 'deluge', 'Venue numbers reach the CRM.'],
    ['crmsrc', 'deluge', 'The automation checks whether someone is already on it, then whether the change matters.'],
    ['deluge', 'tasks', 'If it does, one task goes to the right account manager.'],
    ['deluge', 'chat', 'The owner hears about it in Slack.'],
    ['panels', 'deluge', 'The task closes only once the venue has really recovered.'],
  ],
  incidents: [
    ['sre', 'fns', 'An alert arrives as a signed request.'],
    ['fns', 'db', 'It is claimed in a table that acts as a lock, so a duplicate cannot open a second ticket.'],
    ['desk', 'fns', 'The account is matched exactly in the helpdesk.'],
    ['fns', 'tickets', 'The ticket is sorted and created, or updated if it already exists.'],
  ],
  reviews: [
    ['panels', 'py', 'Build the month’s list of newly live merchants.'],
    ['maps', 'py', 'Collect their public review histories and build a before-and-after baseline.'],
    ['py', 'decks', 'Produce one report per market.'],
  ],
};

const box = (id) => {
  const n = NODES[id];
  return { x: COLS[n.c].x, y: n.y, w: W, h: H };
};

function edgePath(a, b) {
  const s = box(a);
  const e = box(b);
  const x1 = s.x + s.w;
  const y1 = s.y + s.h / 2;
  const x2 = e.x;
  const y2 = e.y + e.h / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

export default function Work() {
  const [hover, setHover] = useState(null);
  const [pin, setPin] = useState(null);
  const [step, setStep] = useState(0);
  const router = useRouter();
  const on = pin || hover;
  const trace = pin ? TRACES[pin] : null;
  const cur = trace ? trace[step] : null;

  const edgeLit = (a, b, ps) => {
    if (trace) return trace.slice(0, step + 1).some(([x, y]) => x === a && y === b);
    return on && ps.includes(on);
  };
  const litNodes = new Set();
  EDGES.forEach(([a, b, ps]) => { if (edgeLit(a, b, ps)) { litNodes.add(a); litNodes.add(b); } });

  const choose = (node) => {
    if (pin === node) { setPin(null); return; }
    setPin(node); setStep(0);
  };
  const title = (node) => selected.find((w) => w.node === node)?.system;

  return (
    <>
      <section className="sec" aria-labelledby="work-h">
        <div className="sec-head">
          <h2 id="work-h">Selected work at qlub</h2>
          <p className="hint">Hover a row to light its path in the map below</p>
        </div>
        <table className="ledger">
          <thead>
            <tr><th style={{ paddingLeft: 8 }}>System</th><th>What it does</th><th>Stack</th><th>Since</th></tr>
          </thead>
          <tbody>
            {selected.map((w) => (
              <tr
                key={w.slug}
                className={`row${hover === w.node ? ' on' : ''}`}
                onMouseEnter={() => setHover(w.node)}
                onMouseLeave={() => setHover(null)}
                onClick={() => router.push(`/work/${w.slug}`)}
              >
                <td className="sys">
                  <Link href={`/work/${w.slug}`} onFocus={() => setHover(w.node)} onBlur={() => setHover(null)}>
                    {w.system}
                  </Link>
                  <span className="arrow" aria-hidden="true">→</span>
                </td>
                <td className="out">{w.outcome}</td>
                <td className="stack">{w.stack}</td>
                <td className="when mono">
                  <span className="ok">{w.since}</span>
                  <div className="faint" style={{ marginTop: 2 }}>{w.status}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sec" aria-labelledby="map-h">
        <div className="sec-head">
          <h2 id="map-h">How the pieces connect</h2>
          <p>Pick a system to trace it step by step. Simplified on purpose</p>
        </div>
        <div className={`map${on ? ' dim' : ''}`} onKeyDown={(e) => { if (!trace) return; if (e.key === 'ArrowRight' && step < trace.length - 1) setStep(step + 1); if (e.key === 'ArrowLeft' && step > 0) setStep(step - 1); if (e.key === 'Escape') setPin(null); }}>
          <svg viewBox="0 0 886 364" role="img" aria-labelledby="map-title">
            <title id="map-title">Data flow from sources through logic and storage to the places people see the results</title>
            {COLS.map((c) => (
              <text key={c.label} className="col" x={c.x} y={22}>{c.label}</text>
            ))}
            {EDGES.map(([a, b, ps]) => (
              <path key={`${a}-${b}`} className={`edge${edgeLit(a, b, ps) ? ' lit' : ''}`} d={edgePath(a, b)} />
            ))}
            {cur && <path key={`${pin}-${step}`} className="edge cur" pathLength="1" d={edgePath(cur[0], cur[1])} />}
            {Object.entries(NODES).map(([id, n]) => {
              const b = box(id);
              return (
                <g key={id} className={`node${litNodes.has(id) ? ' lit' : ''}${cur && (cur[0] === id || cur[1] === id) ? ' cur' : ''}`}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} />
                  <text x={b.x + 12} y={b.y + 19}>{n.t}</text>
                </g>
              );
            })}
          </svg>
          <div className="keys" role="group" aria-label="Trace a system">
            <span className="mono faint">trace</span>
            {selected.map((w) => (
              <button
                key={w.node}
                type="button"
                aria-pressed={pin === w.node}
                onMouseEnter={() => setHover(w.node)}
                onMouseLeave={() => setHover(null)}
                onClick={() => choose(w.node)}
              >
                {w.system}
              </button>
            ))}
          </div>
          {trace && (
            <div className="trace" aria-live="polite">
              <div className="trace-head mono faint">
                <span>{title(pin)} · step {step + 1} of {trace.length}</span>
                <span>{NODES[cur[0]].t} → {NODES[cur[1]].t}</span>
              </div>
              <p>{cur[2]}</p>
              <div className="trace-nav">
                <button type="button" onClick={() => setStep((n) => n - 1)} disabled={step === 0}>← back</button>
                {step < trace.length - 1
                  ? <button type="button" onClick={() => setStep((n) => n + 1)}>next →</button>
                  : <Link href={`/work/${selected.find((w) => w.node === pin).slug}`}>read the case study →</Link>}
                <button type="button" className="faint" onClick={() => setPin(null)}>close</button>
              </div>
            </div>
          )}
          <div className="map-text">
            <ol>
              <li>Data comes from the BI tool, the CRM, the helpdesk and internal APIs.</li>
              <li>CRM automation turns it into tasks and Slack messages.</li>
              <li>Serverless functions write it to Postgres, which the dashboards read, and send alerts to Slack and WhatsApp.</li>
              <li>Production alerts become support tickets; merchant forms become live setups.</li>
              <li>Separately, Python jobs turn public web data into monthly reports.</li>
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
