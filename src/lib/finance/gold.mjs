// Gold prices and holdings. Prices are AED per gram by karat.

export const KARATS = [24, 22, 21, 18];
const PURITY = { 24: 1, 22: 0.916, 21: 0.875, 18: 0.75 };
const GRAMS_PER_TROY_OUNCE = 31.1034768;
const AED_PER_USD = 3.6725; // pegged

/**
 * Malabar's rate widget: "<td>24 KT(999) - </td><td>AED  530.25/g</td>…". Returns
 * { currency, perGram: { 24: 530.25, … }, updated } or null.
 */
export function parseMalabarRates(html) {
  const s = String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const perGram = {};
  let currency = null;
  for (const m of s.matchAll(/(\d{2})\s*K[T]?\s*(?:\(\d+\))?\s*-\s*([A-Z]{3})\s*([\d,]*\.?\d+)\s*\/\s*g/gi)) {
    perGram[+m[1]] = Number(m[3].replace(/,/g, ''));
    currency = m[2].toUpperCase();
  }
  if (!perGram[24] && !perGram[22]) return null;
  const date = s.match(/Updated on\s*:\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  let updated = null;
  if (date) {
    let h = +(date[4] || 0);
    if (date[6]?.toUpperCase() === 'PM' && h < 12) h += 12;
    if (date[6]?.toUpperCase() === 'AM' && h === 12) h = 0;
    updated = new Date(Date.UTC(+date[3], +date[2] - 1, +date[1], h - 4, +(date[5] || 0))).toISOString(); // Dubai time
  }
  return { currency, perGram, updated };
}

/** Spot price (USD per troy ounce) → AED per gram for each karat, by purity. */
export function spotPerGram(usdPerOunce) {
  const pure = (usdPerOunce * AED_PER_USD) / GRAMS_PER_TROY_OUNCE;
  return Object.fromEntries(KARATS.map((k) => [k, Math.round(pure * PURITY[k] * 100) / 100]));
}

/** Fill karats a source didn't list (Malabar skips 21K) from the 24K price by purity. */
export function fillKarats(perGram) {
  const base = perGram[24] || (perGram[22] ? perGram[22] / PURITY[22] : null);
  if (!base) return perGram;
  return Object.fromEntries(KARATS.map((k) => [k, perGram[k] ?? Math.round(base * PURITY[k] * 100) / 100]));
}

/** Value, cost and gain of holdings ({ karat, grams, cost_aed }) at the given prices. */
export function valueHoldings(holdings, perGram) {
  const rows = holdings.map((h) => {
    const price = perGram?.[h.karat] ?? null;
    const value = price == null ? null : Number(h.grams) * price;
    const cost = h.cost_aed == null || h.cost_aed === '' ? null : Number(h.cost_aed);
    return { ...h, price, value, cost, gain: value != null && cost ? value - cost : null };
  });
  const sum = (key) => rows.reduce((t, r) => t + (r[key] || 0), 0);
  const withCost = rows.filter((r) => r.cost && r.value != null);
  return {
    rows,
    grams: rows.reduce((t, r) => t + Number(r.grams || 0), 0),
    pureGrams: rows.reduce((t, r) => t + Number(r.grams || 0) * (PURITY[r.karat] || 1), 0),
    value: sum('value'),
    cost: withCost.reduce((t, r) => t + r.cost, 0),
    gain: withCost.length ? withCost.reduce((t, r) => t + r.value - r.cost, 0) : null,
  };
}
