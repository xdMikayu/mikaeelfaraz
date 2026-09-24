// Parsers for the card alerts we ingest. Pure functions (no I/O) so they run
// on the server, in the browser (setup page tester) and under `node --test`.
//
// Supported inputs:
//   - SIB SMS:        "A txn on your Card XXXX1234 at <merchant> for AED 6.30 on 21-Sep at 19:24 is approved. Your available balance is 8,000.00"
//   - Mashreq email:  "Your Mashreq Cashback Card ending with 1234 was used for a purchase of AED 1.00 at <merchant> on 23-SEP-2026 12:39 PM. Available limit is AED 11,000.00"
//   - Tabby alert:    "Transaction of AED 1.00 At DU Apple Pay was successful. Your available Tabby Card limit is AED 1,900.00"
//   - Apple Wallet:   iOS Shortcuts "Transaction" automation → { card, merchant, amount }

import { cleanMerchant } from './merchants.mjs';

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000; // UAE is UTC+4 all year (no DST)

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Approximate AED rates for foreign-currency purchases. USD/SAR/QAR/OMR/BHD
// are pegged, so those are exact; the rest are rough and flagged as estimates.
const FX_TO_AED = {
  AED: 1, USD: 3.6725, SAR: 0.9793, QAR: 1.0089, OMR: 9.5388, BHD: 9.7686,
  KWD: 12.0, EUR: 4.1, GBP: 4.8, INR: 0.043, PKR: 0.013, EGP: 0.075,
  TRY: 0.1, JPY: 0.025, CHF: 4.4, CAD: 2.7, AUD: 2.4, SGD: 2.8, THB: 0.1, IDR: 0.000225,
};
const PEGGED = new Set(['AED', 'USD', 'SAR', 'QAR', 'OMR', 'BHD']);

const SYMBOLS = { '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY', 'د.إ': 'AED' };

/** Build a UTC Date from a Dubai wall-clock time. Month is 0-based; overflow is fine. */
export function dubaiDate(y, m, d, hh = 0, mi = 0) {
  return new Date(Date.UTC(y, m, d, hh, mi) - DUBAI_OFFSET_MS);
}

/** Dubai wall-clock parts of an instant. Month is 0-based. */
export function dubaiParts(date) {
  const t = new Date(new Date(date).getTime() + DUBAI_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), hh: t.getUTCHours(), mi: t.getUTCMinutes(), dow: t.getUTCDay() };
}

export function toNumber(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** "AED 1.00", "1,234.50 AED", "$4.99", "د.إ.‏ 12" → { amount, currency } */
export function parseAmount(input, defaultCurrency = 'AED') {
  if (typeof input === 'number') return Number.isFinite(input) ? { amount: Math.abs(input), currency: defaultCurrency } : null;
  const s = String(input || '');
  const num = s.match(/-?\d[\d,]*(?:\.\d+)?|-?\.\d+/);
  if (!num) return null;
  const amount = toNumber(num[0]);
  if (amount == null) return null;
  const code = s.toUpperCase().match(/\b([A-Z]{3})\b/);
  let currency = code ? code[1] : null;
  if (!currency) {
    for (const [sym, cur] of Object.entries(SYMBOLS)) if (s.includes(sym)) currency = cur;
  }
  return { amount: Math.abs(amount), currency: currency || defaultCurrency };
}

export function toAed(amount, currency) {
  const rate = FX_TO_AED[currency];
  if (!rate) return { amountAed: amount, fxEstimated: currency !== 'AED' };
  return { amountAed: Math.round(amount * rate * 100) / 100, fxEstimated: !PEGGED.has(currency) };
}

/** Clean display name for a raw merchant descriptor; see merchants.mjs. */
export function normalizeMerchant(raw) {
  return cleanMerchant(raw);
}

/**
 * The first version of the merchant cleaner, kept only so rows it named can be recognised
 * and renamed with cleanMerchant (rows you renamed yourself won't match it).
 */
const LOWER_WORDS = new Set(['al', 'el', 'bin', 'abu', 'of', 'the', 'and', 'de', 'la', 'le', 'st', 'my', 'by', 'at', 'in', 'on', 'to']);

// Brand names that stay upper-case; everything else from the all-caps bank
// descriptors is title-cased ("SOME NEW SHOP" → "Some New Shop").
const ACRONYMS = new Set(['rta', 'dewa', 'sewa', 'addc', 'fewa', 'enoc', 'adnoc', 'eppco', 'ikea', 'vox', 'img', 'bbq', 'tgi', 'dxb', 'auh', 'uae', 'usa', 'fze', 'llc', 'mcd', 'ace', 'dhl', 'ups', 'nyu', 'ksa']);

export function normalizeMerchantLegacy(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  s = s
    .replace(/\b(?:apple|google|samsung)\s*pay\b/gi, ' ')
    .replace(/\*+/g, ' ')
    .replace(/\b\d{3,}\b/g, ' ') // store numbers, phone numbers, terminal ids
    .replace(/\s+/g, ' ')
    .trim()
    // "... DUBAI AE" → "..."; a bare city is kept ("Digital Dubai").
    .replace(/\s+(?:dubai|abu dhabi|sharjah|ajman|al ain|fujairah|ras al khaimah|rak)\s+(?:ae|are|uae)$/i, '')
    .replace(/\s+(?:ae|are|uae)$/i, '')
    .trim();
  if (!s) s = String(raw || '').trim();
  return s
    .split(' ')
    .map((w) => {
      if (LOWER_WORDS.has(w.toLowerCase())) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); // "AL" → "Al"
      if (/^[a-z]{1,2}$/i.test(w)) return w.toUpperCase(); // "du" → "DU"
      if (ACRONYMS.has(w.toLowerCase()) || /^[bcdfghjklmnpqrstvwxz]{3,4}$/i.test(w)) return w.toUpperCase(); // KFC, RTA, ENOC
      if (/[0-9&.]/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

function collapse(text) {
  return String(text || '').replace(/[\u00a0\u200e\u200f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Pick a year for a date that came without one: the most recent that isn't in the future. */
function inferYear(m, d, hh, mi, now) {
  const { y } = dubaiParts(now);
  const candidate = dubaiDate(y, m, d, hh, mi);
  return candidate.getTime() > now.getTime() + 24 * 3600 * 1000 ? y - 1 : y;
}

export function parseSibSms(text, now = new Date()) {
  const s = collapse(text);
  if (!/txn on your card/i.test(s)) return null;
  if (/declined|rejected|not approved|unsuccessful/i.test(s)) {
    return { ok: false, status: 'ignored', reason: 'Declined transaction' };
  }
  const m = s.match(
    /txn on your card\s+[x*]*(\d{4})\s+at\s+(.+?)\s+for\s+([A-Z]{3})\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s+on\s+(\d{1,2})[-\s]([A-Za-z]{3})[a-z]*(?:[-\s](\d{2,4}))?\s+at\s+(\d{1,2}):(\d{2})/i
  );
  if (!m) return { ok: false, status: 'unparsed', reason: 'Looks like SIB but the format was not recognised' };
  const [, last4, merchantRaw, cur, amt, dd, mon, yy, hh, mi] = m;
  const month = MONTHS[mon.toLowerCase()];
  if (month == null) return { ok: false, status: 'unparsed', reason: `Unknown month "${mon}"` };
  let year = yy ? Number(yy.length === 2 ? `20${yy}` : yy) : inferYear(month, +dd, +hh, +mi, now);
  const occurredAt = dubaiDate(year, month, +dd, +hh, +mi);
  const bal = s.match(/available (?:balance|limit) is\s*(?:([A-Z]{3})\s*)?(\d[\d,]*(?:\.\d+)?|\.\d+)/i);
  return finish({
    account: 'sib',
    last4,
    amount: toNumber(amt),
    currency: cur.toUpperCase(),
    merchantRaw: merchantRaw.trim(),
    occurredAt,
    availableBalance: bal ? toNumber(bal[2]) : null,
    source: 'sms',
    wallet: /apple\s*pay/i.test(merchantRaw),
  });
}

/**
 * A date (and optional time) written the ways bank emails write them: "23-SEP-2026 12:39 PM",
 * "23 Sep 2026 at 20:52", "23/09/2026 20:52:10", "2026-09-23 20:52", "23-Sep-26". Day comes
 * before month (UAE style). Returns Dubai wall-clock parts, or null. No time means noon.
 */
function findDateTime(s) {
  const time = String.raw`(?:\s*(?:at|,)?\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?)?`;
  const patterns = [
    [new RegExp(String.raw`\b(\d{1,2})[-\s/]([A-Za-z]{3})[a-z]*[-\s/,]+(\d{2,4})` + time, 'i'), (m) => [m[3], MONTHS[m[2].toLowerCase()], m[1], m[4], m[5], m[6]]],
    [new RegExp(String.raw`\b(\d{4})-(\d{1,2})-(\d{1,2})(?:T|\s)?` + time, 'i'), (m) => [m[1], +m[2] - 1, m[3], m[4], m[5], m[6]]],
    [new RegExp(String.raw`\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})` + time, 'i'), (m) => [m[3], +m[2] - 1, m[1], m[4], m[5], m[6]]],
  ];
  for (const [re, pick] of patterns) {
    const m = s.match(re);
    if (!m) continue;
    let [y, mo, d, h, mi, ampm] = pick(m);
    if (mo == null || mo < 0 || mo > 11) continue;
    y = +y < 100 ? 2000 + +y : +y;
    let hh = h == null ? 12 : +h;
    if (ampm) {
      const pm = ampm.toUpperCase() === 'PM';
      if (pm && hh < 12) hh += 12;
      if (!pm && hh === 12) hh = 0;
    }
    return { y, mo, d: +d, hh, mi: mi == null ? 0 : +mi, index: m.index };
  }
  return null;
}

/**
 * Mashreq card alert email (Cashback credit card, or the Neo debit card), e.g.
 * "Your Mashreq Cashback Card ending with 1234 was used for a purchase of AED 1.00 at
 * DU Apple Pay 800188 AE on 23-SEP-2026 12:39 PM. Available limit is AED 9,876.54".
 * Each part is found on its own, so small wording or date-format differences still read.
 */
export function parseMashreqEmail(text) {
  const s = collapse(text);
  if (!/mashreq/i.test(s) || !/(?:was|has been) used for (?:a|an)\s*(?:online\s+)?purchase/i.test(s)) return null;
  const amt = s.match(/purchase (?:of|for)\s+([A-Z]{3})\s*(\d[\d,]*(?:\.\d+)?|\.\d+)/i);
  if (!amt) return { ok: false, status: 'unparsed', reason: 'Mashreq alert without a readable amount' };
  const after = s.slice(amt.index + amt[0].length);
  const when = findDateTime(after);
  if (!when) return { ok: false, status: 'unparsed', reason: 'Mashreq alert without a readable date' };
  // The merchant sits between "at" and the date ("… at NOON DUBAI AE on 23-SEP-2026 …").
  const head = after.slice(0, when.index).replace(/\s+on\s*$/i, '').replace(/[,.]\s*$/, '');
  const mer = head.match(/^\s*(?:at|with|from)\s+(.+)$/i);
  const merchantRaw = (mer ? mer[1] : head).trim() || 'Mashreq purchase';
  const last4 = (s.match(/card\s+(?:number\s+)?ending\s+(?:with|in)?\s*[x*]*(\d{4})/i) || [])[1] || null;
  // Credit and debit card alerts read alike; debit ones say so. (The server also routes by
  // card number, since the Cashback card's digits are known.)
  const debit = /debit\s+card|mashreq\s+debit/i.test(s);
  const bal = s.match(/available (?:credit )?(?:limit|balance)\s*(?:is|of|:)\s*:?\s*(?:([A-Z]{3})\s*)?(\d[\d,]*(?:\.\d+)?|\.\d+)/i);
  return finish({
    account: debit ? 'mashreq_debit' : 'mashreq',
    last4,
    amount: toNumber(amt[2]),
    currency: amt[1].toUpperCase(),
    merchantRaw,
    occurredAt: dubaiDate(when.y, when.mo, when.d, when.hh, when.mi),
    availableBalance: bal ? toNumber(bal[2]) : null,
    source: 'email',
    wallet: /apple\s*pay/i.test(merchantRaw),
  });
}

/**
 * Tabby Card alert, e.g. "Transaction of AED 1.00 At DU Apple Pay was successful.
 * Your available Tabby Card limit is AED 1,974.76." No timestamp in the text, so
 * it uses when the alert was received.
 */
export function parseTabbyAlert(text, now = new Date(), channel = 'alert') {
  const s = collapse(text);
  if (!/tabby/i.test(s) || !/transaction of/i.test(s)) return null;
  if (/declined|failed|unsuccessful|reversed|refund/i.test(s)) {
    return { ok: false, status: 'ignored', reason: 'Tabby alert is not a successful purchase' };
  }
  // "…transaction of AED 56.00 at RISE LLC was successful…" or
  // "Transaction of AED 420.00 At Digital Dubai. Your Tabby Card limit is now AED 1,408.26…"
  const m = s.match(/transaction of\s+([A-Z]{3})\s*(\d[\d,]*(?:\.\d{1,2})?|\.\d{1,2})\s*at\s+(.+?)(?:\s+(?:was|is|has been)\s+(?:successful|approved|completed)|\.(?:\s|$)|\s+your\s|$)/i);
  if (!m) return { ok: false, status: 'unparsed', reason: 'Looks like Tabby but the format was not recognised' };
  const [, cur, amt, merchantRaw] = m;
  const bal = s.match(/(?:available tabby card limit is|tabby card limit is now)\s*(?:([A-Z]{3})\s*)?(\d[\d,]*(?:\.\d+)?|\.\d+)/i);
  return finish({
    account: 'tabby',
    last4: null,
    amount: toNumber(amt),
    currency: cur.toUpperCase(),
    merchantRaw: merchantRaw.trim(),
    occurredAt: now,
    availableBalance: bal ? toNumber(bal[2]) : null,
    source: ['sms', 'email'].includes(channel) ? channel : 'alert',
    wallet: /apple\s*pay/i.test(merchantRaw),
  });
}

/** Work out which of our accounts a Wallet card name refers to. */
export function accountFromCardName(card) {
  const c = String(card || '').toLowerCase();
  if (c.includes('tabby')) return 'tabby';
  if (c.includes('mashreq') || c.includes('cashback')) return 'mashreq';
  if (c.includes('sib') || c.includes('sharjah')) return 'sib';
  return null;
}

export function parseWalletEvent(input, now = new Date()) {
  const account = accountFromCardName(input.card) || (input.account ? String(input.account).toLowerCase() : null);
  if (!account) return { ok: false, status: 'unparsed', reason: `Unknown Wallet card "${input.card || ''}"` };
  const amt = parseAmount(input.amount);
  if (!amt) return { ok: false, status: 'unparsed', reason: 'Wallet event had no amount' };
  const when = input.occurred_at ? new Date(input.occurred_at) : now;
  return finish({
    account,
    last4: null,
    amount: amt.amount,
    currency: amt.currency,
    merchantRaw: String(input.merchant || input.name || 'Apple Pay').trim(),
    occurredAt: Number.isNaN(when.getTime()) ? now : when,
    availableBalance: null,
    source: 'wallet',
    wallet: true,
  });
}

/**
 * A row read off a card statement or app history: { source: 'statement', account,
 * merchant, amount, occurred_at, currency?, amount_aed?, direction?, merchant_raw?, category? }. Statements have
 * no live channel, so the row keeps its own source instead of posing as a Wallet tap.
 */
export function parseStatementRow(input) {
  const account = input.account ? String(input.account).toLowerCase() : accountFromCardName(input.card);
  if (!account) return { ok: false, status: 'unparsed', reason: 'Statement row has no account' };
  const amt = parseAmount(input.amount);
  if (!amt) return { ok: false, status: 'unparsed', reason: 'Statement row has no amount' };
  const when = new Date(input.occurred_at);
  if (!input.occurred_at || Number.isNaN(when.getTime())) return { ok: false, status: 'unparsed', reason: 'Statement row has no date' };
  const currency = input.currency ? String(input.currency).toUpperCase() : amt.currency;
  const parsed = finish({
    account,
    last4: null,
    amount: amt.amount,
    currency,
    merchantRaw: String(input.merchant_raw || input.merchant || 'Unknown').trim(),
    occurredAt: when,
    availableBalance: null,
    source: 'statement',
  });
  if (!parsed.ok) return parsed;
  if (input.merchant) parsed.merchant = String(input.merchant).trim();
  if (input.category) parsed.category = String(input.category);
  if (input.direction === 'credit') parsed.direction = 'credit'; // refund
  // Statements print what the bank actually charged in AED, so no FX estimate is needed.
  const billed = input.amount_aed != null ? parseAmount(input.amount_aed) : null;
  if (billed) {
    parsed.amountAed = billed.amount;
    parsed.fxEstimated = false;
  }
  return parsed;
}

function finish(tx) {
  if (tx.amount == null || !(tx.amount > 0)) return { ok: false, status: 'unparsed', reason: 'Could not read the amount' };
  const { amountAed, fxEstimated } = toAed(tx.amount, tx.currency);
  return {
    ok: true,
    ...tx,
    direction: 'debit',
    merchant: normalizeMerchant(tx.merchantRaw),
    amountAed,
    fxEstimated,
    occurredAt: tx.occurredAt.toISOString(),
  };
}

/**
 * Parse any ingest event. `event` is { source?, text?, card?, merchant?, amount?, account? }.
 * Returns { ok: true, ...transaction } or { ok: false, status, reason }.
 */
export function parseEvent(event, now = new Date()) {
  if (!event || typeof event !== 'object') return { ok: false, status: 'unparsed', reason: 'Empty event' };
  if (event.source === 'statement') return parseStatementRow(event);
  const isWallet = event.source === 'wallet' || (event.amount != null && (event.card != null || event.merchant != null) && !event.text);
  if (isWallet) return parseWalletEvent(event, now);
  // Notification automations may send the pieces separately (title / subtitle / body).
  const pieces = [event.title, event.subtitle, event.body].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
  // Last resort: whole-object fields (e.g. the Notification variable itself, Shortcut Input).
  const extras = [event.notification, event.input, event.extra, event.name].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');
  const text = String(event.text ?? '').trim() || pieces || extras;
  if (!text) return { ok: false, status: 'unparsed', reason: 'No text in event (notification arrived empty)' };
  const parsed = parseSibSms(text, now) || parseMashreqEmail(text) || parseTabbyAlert(text, now, event.source);
  if (parsed) return parsed;
  // App-notification automations also forward chats, promos and reminders; those aren't purchases.
  if (event.source === 'alert') return { ok: false, status: 'ignored', reason: 'Not a purchase notification' };
  return { ok: false, status: 'unparsed', reason: 'Not a recognised card alert' };
}

/** Split a pasted blob of many messages into individual messages. */
export function splitPastedMessages(blob) {
  const s = String(blob || '').replace(/\r\n/g, '\n').trim();
  if (!s) return [];
  const count = (re) => (s.match(re) || []).length;
  const nSib = count(/txn on your card/gi);
  const nMashreq = count(/was used for a purchase/gi) + count(/transaction of [A-Z]{3}/gi);
  const parts = (re) => s.split(re).map((x) => x.trim()).filter(Boolean);
  if (nSib + nMashreq <= 1) return nSib + nMashreq === 1 ? [s] : parts(/\n\s*\n+/);
  // Cut right before each alert's opening phrase so multi-paragraph emails stay whole.
  return parts(/(?=A txn on your Card)|(?=Dear Customer)|(?=Transaction of [A-Z]{3})/i).filter((x) => /txn on your card|was used for a purchase|transaction of [a-z]{3}/i.test(x));
}
