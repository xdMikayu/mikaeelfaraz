// Server-only finance logic: auth, ingest (parse → dedupe → store) and
// categorization. Uses the Supabase service-role key, so never import this
// from a client component.
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import { parseEvent } from './parse.mjs';
import { ruleCategory, merchantKey, isBnplRepayment } from './categories.mjs';
import { DEFAULT_ACCOUNTS } from './accounts.mjs';
import { aiEnabled, categorizeMerchants } from './ai.mjs';

// A Wallet notification and a bank email/SMS for the same purchase can arrive
// minutes apart; within this window, same card + same amount = same purchase.
const MERGE_WINDOW_MS = 20 * 60 * 1000;

const GENERIC_MERCHANTS = new Set(['unknown', 'manual', 'apple pay', 'purchase', 'pos']);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let admin;
export function getAdmin() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_URL || process.env.SUPABASE_DATABASE_URL || ''
  ).replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Resolve the calling user from `Authorization: Bearer <token>`.
 * The token is either FINANCE_INGEST_TOKEN (iPhone Shortcuts, Gmail script,
 * scheduled job → acts as FINANCE_OWNER_USER_ID) or a Supabase session token
 * from the signed-in dashboard.
 */
export async function authenticate(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Missing bearer token');
  const ingestToken = process.env.FINANCE_INGEST_TOKEN;
  if (ingestToken && ingestToken.length >= 24 && safeEqual(token, ingestToken)) {
    const owner = process.env.FINANCE_OWNER_USER_ID;
    if (!owner) throw new HttpError(500, 'FINANCE_OWNER_USER_ID is not set');
    return { userId: owner, via: 'token' };
  }
  const { data, error } = await getAdmin().auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Invalid token');
  // The Supabase project is shared with other apps whose users can sign in, so
  // only the owner may use these endpoints (they can spend Anthropic credit).
  const owner = process.env.FINANCE_OWNER_USER_ID;
  if (owner && data.user.id !== owner) throw new HttpError(403, 'This dashboard is private');
  return { userId: data.user.id, via: 'session' };
}

export async function ensureAccounts(db, userId) {
  const { data, error } = await db.from('fin_accounts').select('*').eq('user_id', userId);
  if (error) throw error;
  const have = new Set(data.map((a) => a.slug));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !have.has(a.slug)).map((a) => ({ ...a, user_id: userId }));
  if (missing.length) {
    const { data: added, error: e2 } = await db.from('fin_accounts').upsert(missing, { onConflict: 'user_id,slug', ignoreDuplicates: true }).select();
    if (e2) throw e2;
    data.push(...(added || []));
  }
  return new Map(data.map((a) => [a.slug, a]));
}

async function loadRules(db, userId) {
  const { data, error } = await db.from('fin_merchant_rules').select('match, category, source').eq('user_id', userId);
  if (error) throw error;
  return data;
}

function dedupeKey(accountSlug, tx) {
  const minute = tx.occurredAt.slice(0, 16);
  return `${accountSlug}|${tx.amount.toFixed(2)}|${tx.currency}|${minute}|${merchantKey(tx.merchant)}`;
}

/**
 * Ingest a batch of raw events. Each event: { source?, text?, card?, merchant?,
 * amount?, account?, external_id?, received_at? }. Returns one result per event.
 */
export async function ingestEvents(db, userId, events, { now = new Date() } = {}) {
  const accounts = await ensureAccounts(db, userId);
  const rules = await loadRules(db, userId);
  const results = [];

  for (const event of events) {
    try {
      results.push(await ingestOne(db, userId, event, { accounts, rules, now }));
    } catch (err) {
      results.push({ status: 'error', reason: err.message || String(err) });
    }
  }
  return results;
}

async function ingestOne(db, userId, event, { accounts, rules, now }) {
  const source = String(event.source || (event.text ? 'text' : 'wallet')).slice(0, 20);
  const externalId = event.external_id ? String(event.external_id).slice(0, 200) : null;

  // 1. Store the raw event first. (user, source, external_id) is unique, so a
  //    re-sent Gmail message is recognised and skipped.
  const { data: raw, error: rawErr } = await db
    .from('fin_raw_events')
    .insert({ user_id: userId, source, external_id: externalId, payload: event, status: 'pending' })
    .select('id')
    .single();
  if (rawErr) {
    if (rawErr.code === '23505') return { status: 'duplicate', reason: 'Already received' };
    throw rawErr;
  }
  const finishRaw = (patch) => db.from('fin_raw_events').update(patch).eq('id', raw.id);

  // 2. Parse. Messages without a timestamp (Wallet) use when they were sent.
  const sentAt = event.received_at ? new Date(event.received_at) : now;
  const parsed = parseEvent(event, Number.isNaN(sentAt.getTime()) ? now : sentAt);
  if (!parsed.ok) {
    await finishRaw({ status: parsed.status, reason: parsed.reason });
    return { status: parsed.status, reason: parsed.reason };
  }

  const account = accounts.get(parsed.account);
  if (!account) {
    await finishRaw({ status: 'unparsed', reason: `No account "${parsed.account}"` });
    return { status: 'unparsed', reason: `No account "${parsed.account}"` };
  }
  if (parsed.last4 && !account.last4) {
    await db.from('fin_accounts').update({ last4: parsed.last4 }).eq('id', account.id);
    account.last4 = parsed.last4;
  }

  // 3. Same purchase already reported by another channel? Merge into it.
  const t = new Date(parsed.occurredAt).getTime();
  const { data: near, error: nearErr } = await db
    .from('fin_transactions')
    .select('id, source, sources, occurred_at, available_balance, merchant, merchant_raw')
    .eq('user_id', userId)
    .eq('account_id', account.id)
    .eq('amount', parsed.amount)
    .gte('occurred_at', new Date(t - MERGE_WINDOW_MS).toISOString())
    .lte('occurred_at', new Date(t + MERGE_WINDOW_MS).toISOString())
    .limit(5);
  if (nearErr) throw nearErr;
  const twin = (near || []).find((n) => !(n.sources || [n.source]).includes(parsed.source));
  if (twin) {
    const patch = { sources: Array.from(new Set([...(twin.sources || [twin.source]), parsed.source])) };
    if (twin.available_balance == null && parsed.availableBalance != null) patch.available_balance = parsed.availableBalance;
    // Bank alerts carry the real timestamp and descriptor; Wallet only has "now".
    if (twin.source === 'wallet' && parsed.source !== 'wallet') {
      patch.occurred_at = parsed.occurredAt;
      patch.merchant_raw = parsed.merchantRaw;
    }
    await db.from('fin_transactions').update(patch).eq('id', twin.id);
    await finishRaw({ status: 'merged', transaction_id: twin.id });
    return { status: 'merged', transaction_id: twin.id };
  }

  // 4. New transaction.
  const cat = ruleCategory(parsed.merchant, rules);
  const instalment = isBnplRepayment(`${parsed.merchant} ${parsed.merchantRaw}`, parsed.account);
  const row = {
    user_id: userId,
    account_id: account.id,
    occurred_at: parsed.occurredAt,
    amount: parsed.amount,
    currency: parsed.currency,
    amount_aed: parsed.amountAed,
    fx_estimated: parsed.fxEstimated,
    direction: parsed.direction,
    merchant_raw: parsed.merchantRaw,
    merchant: parsed.merchant,
    category: cat?.category ?? null,
    category_source: cat?.source ?? null,
    available_balance: parsed.availableBalance,
    ...(instalment && { excluded: true, category: 'Transfers & Fees', category_source: 'keyword', notes: 'BNPL instalment, purchase already counted on Tabby' }),
    source: parsed.source,
    sources: [parsed.source],
    dedupe_key: dedupeKey(parsed.account, parsed),
  };
  const { data: tx, error: txErr } = await db.from('fin_transactions').insert(row).select('id').single();
  if (txErr) {
    if (txErr.code === '23505') {
      await finishRaw({ status: 'duplicate', reason: 'Same transaction already stored' });
      return { status: 'duplicate', reason: 'Same transaction already stored' };
    }
    throw txErr;
  }
  await finishRaw({ status: 'parsed', transaction_id: tx.id });
  return {
    status: 'parsed',
    transaction_id: tx.id,
    account: parsed.account,
    amount: parsed.amount,
    currency: parsed.currency,
    merchant: parsed.merchant,
    category: row.category,
  };
}

/**
 * Categorize transactions that have no category yet: saved rules and keywords
 * first, then Claude for merchants nothing matched. Claude's answers are saved
 * as merchant rules, so each new merchant is only ever sent once.
 */
export async function categorizePending(db, userId, { maxMerchants = 40 } = {}) {
  const { data: pending, error } = await db
    .from('fin_transactions')
    .select('id, merchant, merchant_raw, amount_aed')
    .eq('user_id', userId)
    .is('category', null)
    .order('occurred_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  if (!pending.length) return { pending: 0, byRule: 0, byAi: 0, remaining: 0, ai: aiEnabled() };

  const rules = await loadRules(db, userId);
  const updates = new Map(); // category|source → ids
  const unknown = new Map(); // merchant → sample
  const push = (category, source, id) => {
    const k = `${category}|${source}`;
    if (!updates.has(k)) updates.set(k, []);
    updates.get(k).push(id);
  };

  let byRule = 0;
  for (const tx of pending) {
    const hit = ruleCategory(tx.merchant, rules);
    if (hit) {
      push(hit.category, hit.source, tx.id);
      byRule++;
    } else {
      const m = (tx.merchant || tx.merchant_raw || '').trim();
      // Placeholder names must never become merchant rules for everything else.
      if (!m || GENERIC_MERCHANTS.has(merchantKey(m))) continue;
      if (!unknown.has(m)) unknown.set(m, { merchant: m, raw: tx.merchant_raw, amountAed: tx.amount_aed, ids: [] });
      unknown.get(m).ids.push(tx.id);
    }
  }

  let byAi = 0;
  let aiError = null;
  if (unknown.size && aiEnabled()) {
    const batch = [...unknown.values()].slice(0, maxMerchants);
    try {
      const answers = await categorizeMerchants(batch);
      const newRules = [];
      for (const item of batch) {
        const category = answers.get(item.merchant);
        if (!category) continue;
        item.ids.forEach((id) => push(category, 'ai', id));
        byAi += item.ids.length;
        unknown.delete(item.merchant);
        const match = merchantKey(item.merchant);
        if (match) newRules.push({ user_id: userId, match, category, source: 'ai' });
      }
      if (newRules.length) {
        await db.from('fin_merchant_rules').upsert(newRules, { onConflict: 'user_id,match', ignoreDuplicates: true });
      }
    } catch (err) {
      aiError = err.message || String(err);
    }
  }

  for (const [k, ids] of updates) {
    const [category, source] = k.split('|');
    for (let i = 0; i < ids.length; i += 200) {
      const { error: upErr } = await db
        .from('fin_transactions')
        .update({ category, category_source: source })
        .in('id', ids.slice(i, i + 200))
        .is('category', null); // never overwrite a category set meanwhile
      if (upErr) throw upErr;
    }
  }

  const remaining = [...unknown.values()].reduce((n, u) => n + u.ids.length, 0);
  return { pending: pending.length, byRule, byAi, remaining, ai: aiEnabled(), aiError };
}

export function jsonError(err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) console.error('[finance]', err);
  return Response.json({ error: err.message || 'Server error' }, { status });
}
