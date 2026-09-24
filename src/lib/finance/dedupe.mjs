// Matching a statement row (date only) with the live alert for the same purchase, and the
// periodic tidy-up plans built on it. Pure functions; server.mjs applies them.
import { dubaiParts } from './parse.mjs';
import { cleanMerchant } from './merchants.mjs';
import { merchantKey } from './categories.mjs';

// A card's app often dates a purchase by when it posted, the alert by when it happened,
// so the two can be a day apart.
export const STATEMENT_WINDOW_MS = 36 * 60 * 60 * 1000;

const STOP = new Set(['the', 'and', 'llc', 'dubai', 'sharjah', 'abu', 'dhabi', 'card', 'pay', 'apple', 'google', 'com', 'www', 'online', 'store', 'shop', 'uae']);

function tokens(row) {
  const out = new Set();
  for (const v of [row.merchant, row.merchant_raw, row.merchantRaw]) {
    if (!v) continue;
    for (const s of [v, cleanMerchant(v)]) {
      for (const t of merchantKey(s).split(' ')) if (t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)) out.add(t);
    }
  }
  return out;
}

/** Do two rows name the same merchant ("Agoda" vs "AGODA.COM 8B DPS-CGK INTERNET")? */
export function sameMerchant(a, b) {
  const ta = tokens(a);
  for (const t of tokens(b)) if (ta.has(t)) return true;
  return false;
}

function sameDubaiDay(a, b) {
  const x = dubaiParts(a);
  const y = dubaiParts(b);
  return x.y === y.y && x.m === y.m && x.d === y.d;
}

/**
 * Is `live` (an alert with a real time) the same purchase as `statement` (date only)?
 * Same card, amount and direction; within 36 hours; and either on the same Dubai day or
 * naming the same merchant. Rows use DB column names; a parsed alert may pass
 * { occurredAt, merchantRaw } instead.
 */
export function isStatementTwin(statement, live) {
  const at = (r) => new Date(r.occurred_at ?? r.occurredAt).getTime();
  if (Math.abs(at(statement) - at(live)) > STATEMENT_WINDOW_MS) return false;
  return sameDubaiDay(at(statement), at(live)) || sameMerchant(statement, live);
}

const onlyStatement = (r) => r.source === 'statement' && (r.sources || [r.source]).every((s) => s === 'statement');
const hasStatement = (r) => (r.sources || [r.source]).includes('statement');

/**
 * Pairs of rows that are one purchase recorded twice: a statement-only row and a live row
 * (no statement in its sources) on the same card, same amount/currency/direction, that
 * isStatementTwin accepts. Each row is used once; the closest in time wins.
 */
export function planDuplicateMerges(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = [r.account_id, Number(r.amount).toFixed(2), r.currency, r.direction].join('|');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const merges = [];
  for (const g of groups.values()) {
    const statements = g.filter(onlyStatement);
    const lives = g.filter((r) => !hasStatement(r));
    if (!statements.length || !lives.length) continue;
    const pairs = [];
    for (const s of statements) for (const l of lives) {
      if (isStatementTwin(s, l)) pairs.push({ s, l, gap: Math.abs(new Date(s.occurred_at) - new Date(l.occurred_at)) });
    }
    pairs.sort((a, b) => a.gap - b.gap);
    const used = new Set();
    for (const { s, l } of pairs) {
      if (used.has(s.id) || used.has(l.id)) continue;
      used.add(s.id);
      used.add(l.id);
      merges.push({
        keep: s.id,
        drop: l.id,
        // The statement row keeps its clean name and category; it gains the alert's exact
        // time, descriptor and balance, and becomes a live-tracked row.
        patch: {
          occurred_at: l.occurred_at,
          merchant_raw: l.merchant_raw,
          available_balance: s.available_balance ?? l.available_balance ?? null,
          source: l.source,
          sources: Array.from(new Set([...(s.sources || ['statement']), ...(l.sources || [l.source])])),
          ...(s.category == null && l.category != null ? { category: l.category, category_source: l.category_source } : {}),
        },
      });
    }
  }
  return merges;
}

/**
 * Rows still carrying a name the old cleaner produced get the new, cleaner name. Rows you
 * renamed (or that came from a statement with a hand-picked name) don't match the old
 * cleaner's output and are left alone. Returns Map(newName → ids).
 */
export function planRenames(rows, legacyClean, clean) {
  const out = new Map();
  for (const r of rows) {
    if (!r.merchant_raw || r.source === 'statement') continue;
    if (r.merchant !== legacyClean(r.merchant_raw)) continue;
    const next = clean(r.merchant_raw);
    if (!next || next === r.merchant) continue;
    if (!out.has(next)) out.set(next, []);
    out.get(next).push(r.id);
  }
  return out;
}
