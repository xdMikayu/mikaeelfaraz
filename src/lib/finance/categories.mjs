// Spending categories and the built-in keyword rules that categorize most UAE
// merchants without needing AI. Order matters: the first matching rule wins,
// so specific rules (e.g. "talabat mart") sit above broad ones ("talabat").

export const CATEGORIES = [
  'Groceries',
  'Dining & Cafés',
  'Food Delivery',
  'Transport',
  'Fuel',
  'Shopping',
  'Subscriptions',
  'Bills & Utilities',
  'Government & Fees',
  'Health & Pharmacy',
  'Entertainment',
  'Travel',
  'Personal Care & Fitness',
  'Education',
  'Transfers & Fees',
  'Other',
];

export const UNCATEGORIZED = 'Uncategorized';

const KEYWORD_RULES = [
  // Checked first: names that would otherwise hit a broader keyword below.
  ['Groceries', ['amazon grocery', 'amazon fresh']],
  ['Shopping', ['apple store']],
  ['Dining & Cafés', ['emirates fast food', 'emirates leisure retail', 'mcdonald', 'hardee', 'peet s coffee']], // not Travel, Fuel or Shopping via "emirates", "enoc", "mall"
  ['Travel', ['qatar airways']],
  ['Entertainment', ['img worlds', 'topgolf', 'karting', 'ekart', 'billiards', 'ticketmaster', 'biletix', 'riot games', 'voicemod', 'photo booth']],
  ['Shopping', ['sun & sand sports', 'lenskart', 'stockx']],
  ['Government & Fees', ['typing centre', 'dubaipay', 'amer centre']],
  ['Bills & Utilities', ['vodafone']],
  ['Travel', ['mobimatter', 'esim']],
  ['Transport', ['karwa']],
  ['Groceries', ['supermarche', 'mini mart', 'minimart', 'talabat mart', 'noon minutes', 'instashop', 'carrefour', 'lulu', 'spinneys', 'waitrose', 'union coop', 'choithrams', 'grandiose', 'viva', 'kibsons', 'nesto', 'al maya', 'west zone', 'geant', 'supermarket', 'hypermarket', 'grocery', 'baqala']],
  ['Food Delivery', ['talabat', 'deliveroo', 'noon food', 'careem food', 'zomato', 'keeta', 'smiles']],
  ['Transport', ['careem', 'uber', 'udrive', 'ekar', 'lime', 'dott', 'rent a car', 'indigo rent', 'rta', 'salik', 'nol', 'parkin', 'parking', 'hala', 'taxi', 'metro', 'yango', 'bolt', 'darb', 'mawaqif']],
  ['Fuel', ['enoc', 'adnoc', 'emarat', 'eppco', 'petrol', 'fuel']],
  ['Bills & Utilities', ['du', 'etisalat', 'e&', 'eand', 'dewa', 'sewa', 'addc', 'aadc', 'fewa', 'etihad wateen', 'virgin mobile', 'empower', 'tabreed', 'lootah']],
  ['Government & Fees', ['digital dubai', 'dubai police', 'gdrfa', 'icp', 'amer', 'tasheel', 'mohre', 'municipality', 'dubai now', 'government', 'tamm', 'emirates id']],
  ['Subscriptions', ['netflix', 'spotify', 'apple com', 'itunes', 'icloud', 'youtube', 'google', 'prime video', 'amazon prime', 'osn', 'shahid', 'disney', 'chatgpt', 'openai', 'anthropic', 'claude', 'microsoft', 'adobe', 'anghami', 'starzplay', 'notion', 'canva', 'apple', 'google one', 'whoop', 'namecheap', 'linkedin', 'github', 'discord', 'twitch', 'google workspace']],
  ['Travel', ['emirates', 'flydubai', 'etihad', 'air arabia', 'booking com', 'agoda', 'airbnb', 'hotel', 'marriott', 'hilton', 'expedia', 'airline', 'airways', 'tiket com', 'trip com', 'atlys', 'vfs global', 'pelita air']],
  ['Health & Pharmacy', ['aster', 'life pharmacy', 'boots', 'bin sina', 'supercare', 'pharmacy', 'clinic', 'hospital', 'medcare', 'mediclinic', 'dental', 'medical']],
  ['Entertainment', ['vox', 'reel cinemas', 'novo', 'cinema', 'playstation', 'steam', 'xbox', 'nintendo', 'dubai parks', 'img worlds', 'ski dubai', 'bowling', 'platinumlist', 'virgin megastore']],
  ['Personal Care & Fitness', ['salon', 'barber', 'spa', 'gym', 'fitness', 'crossfit', 'padel', 'grooming', 'urban company', 'justlife', 'laundry']],
  ['Education', ['udemy', 'coursera', 'university', 'school', 'academy', 'books', 'kinokuniya', 'magrudy']],
  ['Dining & Cafés', ['starbucks', 'tim hortons', 'costa', 'mcdonald', 'kfc', 'burger', 'pizza', 'cafe', 'coffee', 'restaurant', 'shake shack', 'subway', 'dunkin', 'pret', 'bakery', 'grill', 'kitchen', 'eatery', 'shawarma', 'karak', 'chai', 'hardee', 'popeyes', 'nando', 'five guys', 'krispy kreme', 'baskin', 'bistro', 'diner', 'sushi']],
  ['Shopping', ['noon', 'amazon', 'namshi', 'shein', 'ikea', 'h m', 'zara', 'centrepoint', 'max fashion', 'sharaf dg', 'jumbo', 'apple store', 'mall', 'trendyol', 'temu', 'aliexpress', 'ace', 'dragon mart', 'decathlon', 'nike', 'adidas', 'sephora', 'faces', 'home centre', 'daiso', 'dubai duty free', 'tamara', 'postpay', 'cashew', 'spotii']],
  ['Transfers & Fees', ['tabby', 'annual fee', 'late fee', 'finance charge', 'cash advance', 'transfer']],
];

// Precompile each keyword as a whole-word regex over the normalized key, so
// "du" matches "du" but not "dubai".
const COMPILED = KEYWORD_RULES.flatMap(([category, words]) =>
  words.map((w) => ({ category, re: new RegExp(`(^| )${escapeRe(merchantKey(w))}( |$)`) }))
);

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lowercase, alphanumerics only, single-spaced. Used for rule matching. */
export function merchantKey(merchant) {
  return String(merchant || '')
    .toLowerCase()
    .replace(/&/g, ' & ')
    .replace(/[^a-z0-9&\u0600-\u06ff]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function keywordCategory(merchant) {
  const key = merchantKey(merchant);
  if (!key) return null;
  for (const { category, re } of COMPILED) {
    if (re.test(key)) return category;
  }
  return null;
}

/**
 * Categorize using the user's saved merchant rules first, then built-in
 * keywords. Returns { category, source } or null when nothing matched.
 * `rules` is an array of { match, category } where match is a merchantKey.
 */
export function ruleCategory(merchant, rules = []) {
  const key = merchantKey(merchant);
  if (!key) return null;
  const exact = rules.find((r) => r.match === key);
  if (exact) return { category: exact.category, source: exact.source === 'ai' ? 'ai' : 'rule' };
  const partial = rules
    .filter((r) => r.match && key.includes(r.match))
    .sort((a, b) => b.match.length - a.match.length)[0];
  if (partial) return { category: partial.category, source: partial.source === 'ai' ? 'ai' : 'rule' };
  const kw = keywordCategory(merchant);
  return kw ? { category: kw, source: 'keyword' } : null;
}

// A Tabby charge on SIB or Mashreq is one of two things: an instalment for a
// Tabby checkout purchase (tracked nowhere else, so it is spending) or a
// repayment of the Tabby card (its purchases are already counted on the card).
// Only a matching repayment on the Tabby card tells them apart; see planTabbyReconcile.
// Tamara, Postpay etc. aren't tracked as cards, so their charges are always spending.
const TABBY = /(^| )tabby( |$)/;
const REPAYMENT = /(^| )(re)?payment( |$)/;

export const TABBY_NOTES = {
  instalment: 'Tabby instalment',
  cardPayoff: 'Pays off the Tabby card, purchases already counted there',
  repayment: 'Tabby card repayment, not spending',
};
// Notes written by earlier versions; rows carrying them are still managed.
const LEGACY_NOTES = ['Tabby repayment, purchase already counted on the Tabby card', 'BNPL instalment, purchase already counted on Tabby'];
export const MANAGED_TABBY_NOTES = [TABBY_NOTES.instalment, TABBY_NOTES.cardPayoff, ...LEGACY_NOTES];

/** A bank-card charge whose merchant is Tabby. */
export function isTabbyCharge(merchant, accountSlug) {
  if (accountSlug === 'tabby') return false;
  return TABBY.test(merchantKey(merchant));
}

/** A credit on the Tabby card that is the card being paid off (not a refund). */
export function isTabbyCardRepayment(merchant, accountSlug, direction) {
  return accountSlug === 'tabby' && direction === 'credit' && REPAYMENT.test(merchantKey(merchant));
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Decide, for each Tabby charge on a bank card, whether it paid off the Tabby card
 * (same amount as a Tabby card repayment within 3 days: hide it) or is an instalment
 * (count it). Each repayment pairs with at most one charge. Returns the row patches needed.
 */
export function planTabbyReconcile(charges, repayments) {
  const paired = new Set();
  const updates = [];
  const byTime = (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at);
  for (const r of [...repayments].sort(byTime)) {
    const t = new Date(r.occurred_at).getTime();
    let best = null;
    for (const c of charges) {
      if (paired.has(c.id) || Math.abs(Number(c.amount_aed) - Number(r.amount_aed)) > 0.005) continue;
      const gap = Math.abs(new Date(c.occurred_at).getTime() - t);
      if (gap <= 3 * DAY && (!best || gap < best.gap)) best = { id: c.id, gap };
    }
    if (best) paired.add(best.id);
  }
  for (const c of charges) {
    const want = paired.has(c.id)
      ? { excluded: true, category: 'Transfers & Fees', notes: TABBY_NOTES.cardPayoff }
      : { excluded: false, category: 'Shopping', notes: TABBY_NOTES.instalment };
    if (c.excluded !== want.excluded || c.category !== want.category || c.notes !== want.notes) updates.push({ id: c.id, ...want });
  }
  return updates;
}
