'use client';
// Hand-rolled SVG charts following the dataviz mark specs: 2px lines, <=24px
// bars with a 4px rounded data-end, 2px surface gaps between stacked segments,
// hairline grid, crosshair/per-mark tooltips, text in ink tokens only.
import { useEffect, useId, useRef, useState } from 'react';
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

/** Running total through the selected period vs the comparison period, aligned by day. */
export function CumulativeChart({ current, previous: prevAll, length, ticks, currentLabel, previousLabel, height = 220 }) {
  const [ref, width] = useWidth();
  // No spend at all in the comparison window: drop the line rather than draw it along the axis.
  const previous = prevAll.some((p) => p.value !== 0) ? prevAll : [];
  const [hover, setHover] = useState(null);
  const n = Math.max(2, length);
  const max = Math.max(1, ...current.map((p) => p.value), ...previous.map((p) => p.value));
  const yTicks = niceTicks(max);
  const top = yTicks[yTicks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (i / (n - 1)) * iw;
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const line = (pts) => pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const last = current[current.length - 1];
  const gid = `fin-area-${useId().replace(/:/g, '')}`;
  // Keep axis labels at least 34px apart (month names on a 12-month axis, phones).
  const shown = [];
  for (const t of ticks) {
    if (t.i < 0 || t.i > n - 1 || shown.some((s) => s.i === t.i)) continue;
    if (shown.length && x(t.i) - x(shown[shown.length - 1].i) < 34) continue;
    shown.push(t);
  }

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - PAD.left) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const hc = hover != null ? current[hover] : null;
  const hp = hover != null ? previous[hover] : null;

  return (
    <div>
      <div className="mb-2">
        <Legend items={[{ label: currentLabel, color: 'var(--fin-s1)', line: true }, ...(previous.length ? [{ label: previousLabel, color: 'var(--fin-compare)', line: true }] : [])]} />
      </div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
            aria-label={`Running total: ${currentLabel} ${aed(last?.value || 0, { decimals: 0 })}`}>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
              </g>
            ))}
            {shown.map((t) => (
              <text key={t.i} x={x(t.i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--fin-muted)">{t.label}</text>
            ))}
            {previous.length > 0 && <path d={line(previous)} fill="none" stroke="var(--fin-compare)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {current.length > 0 && (
              <>
                <defs>
                  <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--fin-s1)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--fin-s1)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${line(current)}L${x(last.i)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${gid})`} />
                <path d={line(current)} fill="none" stroke="var(--fin-s1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <circle cx={x(last.i)} cy={y(last.value)} r="5" fill="var(--fin-s1)" stroke="var(--fin-surface)" strokeWidth="2" />
              </>
            )}
            {hover != null && (
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--fin-axis)" strokeWidth="1" />
            )}
            {hc && <circle cx={x(hover)} cy={y(hc.value)} r="4" fill="var(--fin-s1)" stroke="var(--fin-surface)" strokeWidth="2" />}
            {hp && <circle cx={x(hover)} cy={y(hp.value)} r="4" fill="var(--fin-compare)" stroke="var(--fin-surface)" strokeWidth="2" />}
          </svg>
        )}
        {hover != null && width > 0 && (hc || hp) && (
          <div className="fin-tooltip" style={{ left: Math.min(x(hover) + 12, width - 190), top: 8 }}>
            <div className="mb-1 font-semibold">{(hc || hp).label}</div>
            {hc && <Row color="var(--fin-s1)" label={currentLabel} value={aed(hc.value, { decimals: 0 })} sub={hc.daily ? `${aed(hc.daily, { decimals: 0 })} that day` : null} />}
            {hp && <Row color="var(--fin-compare)" label={previousLabel} value={aed(hp.value, { decimals: 0 })} sub={hc ? `by ${hp.label}` : null} />}
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
        <span className="fin-num whitespace-nowrap font-medium">{value}</span>
        {sub && <span className="block fin-muted">{sub}</span>}
      </span>
    </div>
  );
}

/** Spend per week or month, stacked by card. `highlight` marks the selected month. */
export function SpendBars({ buckets, accounts, highlight = null, height = 220, label = 'Spend by card' }) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  // Legend lists the cards in view; colour still follows each card's fixed slot.
  const present = accounts.filter((a) => buckets.some((b) => (b.parts[a.id] || 0) > 0));
  const max = Math.max(1, ...buckets.map((m) => m.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const iw = Math.max(10, width - PAD.left - PAD.right);
  const ih = height - PAD.top - PAD.bottom;
  const band = iw / buckets.length;
  const bw = Math.min(24, band * 0.6);
  const y = (v) => PAD.top + ih - (v / top) * ih;
  const GAP = 2;
  const labelled = highlight ?? buckets.length - 1;
  // Show every k-th axis label so they never touch (~6.5px per character at 11px, plus a gap).
  const longest = Math.max(...buckets.map((b) => b.label.length));
  const step = Math.max(1, Math.ceil((longest * 6.5 + 12) / band));
  const dim = (i) => (hover != null ? hover !== i : highlight != null && highlight !== i);

  return (
    <div>
      <div className="mb-2"><Legend items={present.map((a) => ({ label: a.name, color: accountColorVar(a.slug, accounts) }))} /></div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={label}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fin-axis)' : 'var(--fin-grid)'} strokeWidth="1" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--fin-muted)" className="fin-num">{compact(t)}</text>
              </g>
            ))}
            {buckets.map((mo, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x0 = cx - bw / 2;
              let acc = 0;
              const segs = present
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
                    const opacity = dim(i) ? 0.4 : 1;
                    return isTop ? (
                      <path key={s.a.id} d={columnPath(x0, y1, bw, h, 4)} fill={color} opacity={opacity} />
                    ) : (
                      <rect key={s.a.id} x={x0} y={y1} width={bw} height={h} fill={color} opacity={opacity} />
                    );
                  })}
                  {((buckets.length - 1 - i) % step === 0 || highlight === i) && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill={hover === i || highlight === i ? 'var(--fin-ink)' : 'var(--fin-muted)'} fontWeight={highlight === i ? 600 : 400}>{mo.label}</text>
                  )}
                  {i === labelled && mo.total > 0 && (
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
              <span>{buckets[hover].fullLabel}</span>
              <span className="fin-num">{aed(buckets[hover].total, { decimals: 0 })}</span>
            </div>
            {present.map((a) => (
              <Row key={a.id} color={accountColorVar(a.slug, accounts)} label={a.name} value={aed(buckets[hover].parts[a.id] || 0, { decimals: 0 })} />
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
    <div className="relative h-2 w-full rounded-full" style={{ background: 'var(--fin-surface-2)' }}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${w * 100}%`, background: 'var(--fin-s1)', borderRadius: '0 4px 4px 0', minWidth: value > 0 ? 3 : 0 }} />
      {budget > 0 && max > 0 && (
        <div className="absolute" title={`Budget ${aed(budget, { decimals: 0 })}`}
          style={{ left: `${Math.min(1, budget / max) * 100}%`, top: -3, bottom: -3, width: 2, background: over ? 'var(--fin-bad)' : 'var(--fin-ink-2)', borderRadius: 1 }} />
      )}
    </div>
  );
}
