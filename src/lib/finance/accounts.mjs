// The cards we track by default. Each known card has its own brand colour (see finance.css);
// the five brand colours validate as a set for colour-vision deficiency and contrast.
export const DEFAULT_ACCOUNTS = [
  { slug: 'sib', name: 'SIB Card', kind: 'credit', sort: 1 },
  { slug: 'mashreq', name: 'Mashreq Cashback', kind: 'credit', sort: 2 },
  { slug: 'tabby', name: 'Tabby Card', kind: 'bnpl', sort: 3 },
];

// SIB blue, Mashreq orange, Tabby green, noon One gold, Mashreq Neo debit magenta.
const BRAND = { sib: 'sib', mashreq: 'mashreq', tabby: 'tabby', enbd: 'enbd', mashreq_debit: 'neo' };

export function accountColorVar(slug, accounts = DEFAULT_ACCOUNTS) {
  // Colour follows the account, never its rank in a chart. Cards without a brand colour
  // fall back to a palette slot by their position in the list.
  if (BRAND[slug]) return `var(--fin-c-${BRAND[slug]})`;
  const i = Math.max(0, accounts.findIndex((a) => a.slug === slug));
  return `var(--fin-s${Math.min(i, 7) + 1})`;
}
