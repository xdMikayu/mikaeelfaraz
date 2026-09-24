// Synthetic data for previewing the dashboard before Supabase is connected
// (/finance?demo=1). Deterministic so screenshots are stable.
import { dubaiDate, dubaiParts, normalizeMerchant } from '@/lib/finance/parse.mjs';
import { keywordCategory } from '@/lib/finance/categories.mjs';

const MERCHANTS = [
  ['sib', 'Carrefour City Centre', 40, 380, 5],
  ['sib', 'Talabat', 25, 120, 9],
  ['sib', 'Digital Dubai', 5, 60, 2],
  ['mashreq', 'Careem Hala', 15, 90, 10],
  ['mashreq', 'DU', 150, 350, 1],
  ['mashreq', 'Starbucks', 18, 45, 8],
  ['mashreq', 'ENOC', 80, 180, 3],
  ['mashreq', 'Netflix', 56, 56, 1],
  ['tabby', 'Noon', 60, 900, 3],
  ['tabby', 'Namshi', 120, 600, 1],
  ['sib', 'Salik', 4, 4, 12],
  ['sib', 'Life Pharmacy', 30, 140, 1],
  ['tabby', 'Vox Cinemas', 45, 160, 1],
  ['mashreq', 'Spotify', 21.99, 21.99, 1],
  ['sib', 'Al Reef Bakery', 12, 40, 3],
  ['mashreq_debit', 'OpenAI ChatGPT', 73, 73, 1],
  ['mashreq_debit', 'Grill Table Restaurant', 60, 200, 2],
];

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function demoData(now = new Date()) {
  const rand = rng(42);
  const accounts = [
    { id: 'demo-sib', slug: 'sib', name: 'SIB Card', last4: '0000', kind: 'credit', credit_limit: 15000, sort: 1 },
    { id: 'demo-mashreq', slug: 'mashreq', name: 'Mashreq Cashback', last4: '0000', kind: 'credit', credit_limit: 20000, sort: 2 },
    { id: 'demo-tabby', slug: 'tabby', name: 'Tabby Card', last4: null, kind: 'bnpl', credit_limit: null, sort: 3 },
    { id: 'demo-mashreq_debit', slug: 'mashreq_debit', name: 'Mashreq Debit', last4: '0000', kind: 'debit', credit_limit: null, sort: 4 },
  ];
  const { y, m, d } = dubaiParts(now);
  const transactions = [];
  let n = 0;
  for (let back = 8; back >= 0; back--) {
    const lastDay = back === 0 ? d : 28;
    for (const [acct, name, lo, hi, perMonth] of MERCHANTS) {
      const times = Math.max(0, Math.round(perMonth * (0.7 + rand() * 0.6) * (lastDay / 28)));
      for (let i = 0; i < times; i++) {
        const day = 1 + Math.floor(rand() * lastDay);
        const at = dubaiDate(y, m - back, day, 8 + Math.floor(rand() * 14), Math.floor(rand() * 60));
        if (at > now) continue;
        const amount = Math.round((lo + rand() * (hi - lo)) * 100) / 100;
        const merchant = normalizeMerchant(name);
        transactions.push({
          id: `demo-${n++}`,
          account_id: `demo-${acct}`,
          occurred_at: at.toISOString(),
          amount, currency: 'AED', amount_aed: amount, direction: 'debit', excluded: false,
          merchant, merchant_raw: name.toUpperCase(),
          category: keywordCategory(merchant) || (name === 'Al Reef Bakery' ? 'Dining & Cafés' : null),
          category_source: 'keyword',
          available_balance: null, source: acct === 'sib' ? 'sms' : acct.startsWith('mashreq') ? 'email' : 'wallet',
        });
      }
    }
  }
  transactions.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
  const sib = transactions.find((t) => t.account_id === 'demo-sib');
  if (sib) sib.available_balance = 8120.5;
  const mq = transactions.find((t) => t.account_id === 'demo-mashreq');
  if (mq) mq.available_balance = 11420.0;
  return {
    accounts, transactions,
    rules: [], budgets: [{ category: 'Food Delivery', monthly_amount: 700 }, { category: 'Dining & Cafés', monthly_amount: 400 }],
    activity: [],
    rawEvents: [{ id: 'demo-raw', received_at: now.toISOString(), source: 'sms', status: 'unparsed', reason: 'Not a recognised card alert', payload: { text: 'Dear customer, your statement is ready.' } }],
  };
}
