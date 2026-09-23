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
  ['Groceries', ['talabat mart', 'noon minutes', 'instashop', 'carrefour', 'lulu', 'spinneys', 'waitrose', 'union coop', 'choithrams', 'grandiose', 'viva', 'kibsons', 'nesto', 'al maya', 'west zone', 'geant', 'supermarket', 'hypermarket', 'grocery', 'baqala']],
  ['Food Delivery', ['talabat', 'deliveroo', 'noon food', 'careem food', 'zomato', 'keeta', 'smiles']],
  ['Transport', ['careem', 'uber', 'rta', 'salik', 'nol', 'parkin', 'parking', 'hala', 'taxi', 'metro', 'yango', 'bolt', 'darb', 'mawaqif']],
  ['Fuel', ['enoc', 'adnoc', 'emarat', 'eppco', 'petrol', 'fuel']],
  ['Bills & Utilities', ['du', 'etisalat', 'e&', 'eand', 'dewa', 'sewa', 'addc', 'aadc', 'fewa', 'etihad wateen', 'virgin mobile', 'empower', 'tabreed', 'lootah']],
  ['Government & Fees', ['digital dubai', 'dubai police', 'gdrfa', 'icp', 'amer', 'tasheel', 'mohre', 'municipality', 'dubai now', 'government', 'tamm', 'emirates id']],
  ['Subscriptions', ['netflix', 'spotify', 'apple com', 'itunes', 'icloud', 'youtube', 'google', 'prime video', 'amazon prime', 'osn', 'shahid', 'disney', 'chatgpt', 'openai', 'anthropic', 'claude', 'microsoft', 'adobe', 'anghami', 'starzplay', 'notion', 'canva']],
  ['Travel', ['emirates', 'flydubai', 'etihad', 'air arabia', 'booking com', 'agoda', 'airbnb', 'hotel', 'marriott', 'hilton', 'expedia', 'airline', 'airways']],
  ['Health & Pharmacy', ['aster', 'life pharmacy', 'boots', 'bin sina', 'supercare', 'pharmacy', 'clinic', 'hospital', 'medcare', 'mediclinic', 'dental', 'medical']],
  ['Entertainment', ['vox', 'reel cinemas', 'novo', 'cinema', 'playstation', 'steam', 'xbox', 'nintendo', 'dubai parks', 'img worlds', 'ski dubai', 'bowling', 'platinumlist', 'virgin megastore']],
  ['Personal Care & Fitness', ['salon', 'barber', 'spa', 'gym', 'fitness', 'crossfit', 'padel', 'grooming']],
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

// When SIB or Mashreq is charged by Tabby, it is a repayment of purchases already
// counted on the Tabby card, so it must not be counted as spending a second time.
// Tamara, Postpay etc. aren't tracked as cards, so their charges are the spending.
const BNPL = /(^| )tabby( |$)/;

export function isBnplRepayment(merchant, accountSlug) {
  if (accountSlug === 'tabby') return false;
  return BNPL.test(merchantKey(merchant));
}
