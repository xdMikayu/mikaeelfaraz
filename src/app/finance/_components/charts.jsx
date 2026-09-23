'use client';
// Hand-rolled SVG charts following the dataviz mark specs: 2px lines, <=24px
// bars with a 4px rounded data-end, 2px surface gaps between stacked segments,
// hairline grid, crosshair/per-mark tooltips, text in ink tokens only.
import { useEffect, useRef, useState } from 'react';
import { aed, compact } from './format';
import { accountColorVar } from '@/lib/finance/accounts.mjs';

function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Clean axis ticks: 0, 500, 1,000 … */
function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Path for a column with rounded top (data end) and square base. */
function columnPath(x, y, w, h, r) {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

const PAD = { top: 16, right: 16, bottom: 26, left: 44 };

export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((it) => (
        <span key={it.label} className="fin-chip">
          {it.line ? (
            <span style={{ width: 14, height: 2, background: it.color, display: 'inline-block', borderRadius: 2 }} />
          ) : (
            <span className="fin-dot" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** This month's running total vs last month's, by day of month. */
export function CumulativeChart({ current, previous, daysInMonth, currentLabel, previousLabel, height = 220 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const days = Math.max(daysInMonth, previous.length);
  const max = Math.max(1, ...current.map((p) => p.value), ...previous.map((p) => p.value));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const x = (day) => PAD.left + ((day - 1) / Math.max(1, days - 1)) * iw;
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = current[current.length - 1];

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const day = Math.min(days, Math.max(1, Math.round(((px - PAD.left) / iw) * (days - 1)) + 1));
    setHover(day);
  };
  const hc = hover ? current[hover - 1] : null;
  const hp = hover ? previous[hover - 1] : null;

  return (
    <div>
      <div className="mb-2">
        <Legend items={[{ label: currentLabel, color: 'var(--fin-s1)', line: true }, { label: previousLabel, color: 'var(--fin-compare)', line: true }]} />
      </div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
            aria-label={`Cumulative spend: ${currentLabel} ${aed(last?.value || 0, { decimals: 0 })} so far`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
              </g>
            ))}
            {[1, 8, 15, 22, days].filter((d, i, a) => a.indexOf(d) === i && d <= days).map((d) => (
              <text key={d} x={x(d)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--fin-muted)">{d}</text>
            ))}
            <path d={line(previous)} fill="none" stroke="var(--fin-compare)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {current.length > 0 && (
              <>
                <path d={`${line(current)}L${x(last.day)},${y(0)}L${x(1)},${y(0)}Z`} fill="var(--fin-s1)" opacity="0.1" />
                <path d={line(current)} fill="none" stroke="var(--fin-s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(last.day)} cy={y(last.value)} r="5" fill="var(--fin-s1)" stroke="var(--fin-surface)" strokeWidth="2" />
              </>
            )}
            {hover && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--fin-axis)" strokeWidth="1" />
            )}
            {hc && <circle cx={x(hover)} cy={y(hc.value)} r="4" fill="var(--fin-s1)" stroke="var(--fin-surface)" strokeWidth="2" />}
            {hp && <circle cx={x(hover)} cy={y(hp.value)} r="4" fill="var(--fin-compare)" stroke="var(--fin-surface)" strokeWidth="2" />}
          </svg>
        )}
        {hover && width > 0 && (
          <div className="fin-tooltip" style={{ left: Math.min(x(hover) + 12, width - 170), top: 8 }}>
            <div className="mb-1 font-semibold">Day {hover}</div>
            {hc && <Row color="var(--fin-s1)" label={currentLabel} value={aed(hc.value, { decimals: 0 })} sub={hc.daily ? `${aed(hc.daily, { decimals: 0 })} that day` : null} />}
            {hp && <Row color="var(--fin-compare)" label={previousLabel} value={aed(hp.value, { decimals: 0 })} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ color, label, value, sub }) {
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="fin-chip"><span className="fin-dot" style={{ background: color }} />{label}</span>
      <span className="text-right">
        <span className="fin-num font-medium">{value}</span>
        {sub && <span className="block fin-muted">{sub}</span>}
      </span>
    </div>
  );
}

/** Monthly totals, stacked by card. */
export function MonthlyBars({ months, accounts, height = 220 }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.map((m) => m.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / months.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const GAP = 2;

  return (
    <div>
      <div className="mb-2"><Legend items={accounts.map((a) => ({ label: a.name, color: accountColorVar(a.slug, accounts) }))} /></div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Monthly spend by card">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
              </g>
            ))}
            {months.map((mo, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x0 = cx - bw / 2;
              let acc = 0;
              const segs = accounts
                .map((a) => ({ a, v: Math.max(0, mo.parts[a.id] || 0) }))
                .filter((s) => s.v > 0);
              return (
                <g key={mo.fullLabel} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={PAD.left + band * i} y={PAD.top} width={band} height={ih} fill="transparent" />
                  {segs.map((s, j) => {
                    const y1 = y(acc + s.v);
                    const y0 = y(acc);
                    acc += s.v;
                    const isTop = j === segs.length - 1;
                    const h = Math.max(0, y0 - y1 - (j > 0 ? GAP : 0));
                    const color = accountColorVar(s.a.slug, accounts);
                    return isTop ? (
                      <path key={s.a.id} d={columnPath(x0, y1, bw, h, 4)} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} />
                    ) : (
                      <rect key={s.a.id} x={x0} y={y1} width={bw} height={h} fill={color} opacity={hover == null || hover === i ? 1 : 0.55} />
                    );
                  })}
                  {(band >= 30 || (months.length - 1 - i) % 2 === 0 || hover === i) && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={hover === i ? 'var(--fin-ink)' : 'var(--fin-muted)'}>{mo.label}</text>
                  )}
                  {i === months.length - 1 && mo.total > 0 && (
                    <text x={cx} y={y(mo.total) - 6} textAnchor="middle" fontSize="11" fill="var(--fin-ink-2)" className="fin-num">{compact(mo.total)}</text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hover != null && width > 0 && (
          <div className="fin-tooltip" style={{ left: Math.min(PAD.left + band * hover + band / 2 + 14, width - 190), top: 8 }}>
            <div className="mb-1 flex justify-between gap-4 font-semibold">
              <span>{months[hover].fullLabel}</span>
              <span className="fin-num">{aed(months[hover].total, { decimals: 0 })}</span>
            </div>
            {accounts.map((a) => (
              <Row key={a.id} color={accountColorVar(a.slug, accounts)} label={a.name} value={aed(months[hover].parts[a.id] || 0, { decimals: 0 })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Horizontal magnitude bars (single hue) with a value at the tip. */
export function HBar({ value, max, budget }) {
  const w = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const over = budget && value > budget;
  return (
    <div className="relative h-2.5 w-full">
      <div className="absolute inset-y-0 left-0" style={{ width: `${w * 100}%`, background: 'var(--fin-s1)', borderRadius: '0 4px 4px 0', minWidth: value > 0 ? 3 : 0 }} />
      {budget > 0 && max > 0 && (
        <div className="absolute" title={`Budget ${aed(budget, { decimals: 0 })}`}
          style={{ left: `${Math.min(1, budget / max) * 100}%`, top: -3, bottom: -3, width: 2, background: over ? 'var(--fin-bad)' : 'var(--fin-ink-2)', borderRadius: 1 }} />
      )}
    </div>
  );
}
