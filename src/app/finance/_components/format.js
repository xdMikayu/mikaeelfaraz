import { dubaiParts } from '@/lib/finance/parse.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function aed(n, { decimals = 2, sign = false } = {}) {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const prefix = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return `${prefix}AED ${s}`;
}

/** Compact axis/tile figures: 950, 1.2K, 12.9K, 1.1M */
export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return `${Math.round(v)}`;
}

export function pct(p) {
  if (p == null || !Number.isFinite(p)) return 'new';
  const v = Math.round(p * 100);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}%`;
}

export function dateTime(iso) {
  const p = dubaiParts(iso);
  return `${p.d} ${MONTHS[p.m]} · ${String(p.hh).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

export function dateShort(iso) {
  const p = dubaiParts(iso);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
}

export function relative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Value for <input type="datetime-local"> in Dubai time. */
export function toLocalInput(iso) {
  const p = dubaiParts(iso || new Date());
  const z = (n) => String(n).padStart(2, '0');
  return `${p.y}-${z(p.m + 1)}-${z(p.d)}T${z(p.hh)}:${z(p.mi)}`;
}

export function fromLocalInput(v) {
  // Interpret as Dubai wall-clock time (UTC+4).
  return new Date(`${v}:00+04:00`).toISOString();
}
