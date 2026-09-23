// The cards we track by default. Colors are categorical slots of the chart palette
// in fixed order (slots 1–3 validate as a set for colour-vision deficiency); see finance.css.
export const DEFAULT_ACCOUNTS = [
  { slug: 'sib', name: 'SIB Card', kind: 'credit', sort: 1 },
  { slug: 'mashreq', name: 'Mashreq Cashback', kind: 'credit', sort: 2 },
  { slug: 'tabby', name: 'Tabby Card', kind: 'bnpl', sort: 3 },
];

export function accountColorVar(slug, accounts = DEFAULT_ACCOUNTS) {
  // Colour follows the account (its position in the list), never its rank in a chart.
  const i = Math.max(0, accounts.findIndex((a) => a.slug === slug));
  return `var(--fin-s${Math.min(i, 7) + 1})`;
}
