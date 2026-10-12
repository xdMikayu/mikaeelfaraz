// One ground under many spellings: "M.Chinnaswamy Stadium", "M Chinnaswamy Stadium, Bengaluru";
// "Sheikh Zayed Stadium" and its new name "Zayed Cricket Stadium, Abu Dhabi"; "The Oval" and
// "Kennington Oval". A ground is keyed by the distinctive words of its name plus its city, so
// Cricsheet's names (for the history) and ESPN's (for today's matches) meet in one place.

// Words that say "cricket ground" rather than which one.
const STOP = new Set(['the', 'cricket', 'stadium', 'ground', 'grounds', 'international', 'club', 'association', 'sports', 'complex', 'and', 'of', 'at', 'de', 'cc', 'csa']);
// Words that make a different ground of the same name: a nursery, an outer oval, ground No 2.
const SEPARATE = /^(\d+|no|nursery|outer|academy|indoor|b|ii|iii|west|east|north|south|turf|pitch|field\d*)$/;
// Extra words a ground can gain or lose and stay itself.
const OPTIONAL = new Set(['new', 'sheikh', 'dr', 'r', 'm', 'shri', 'sir']);

const CITY = {
  bangalore: 'bengaluru',
  bombay: 'mumbai',
  madras: 'chennai',
  calcutta: 'kolkata',
  'navi mumbai': 'mumbai',
  'port of spain': 'trinidad',
  'st georges': 'grenada',
  bridgetown: 'barbados',
  kingston: 'jamaica',
  basseterre: 'st kitts',
  'north sound': 'antigua',
  'st johns': 'antigua',
  gros: 'st lucia',
  'gros islet': 'st lucia',
  providence: 'guyana',
  georgetown: 'guyana',
  'chester le street': 'chester-le-street',
  centurion: 'centurion',
  'mount maunganui': 'tauranga',
  'abu dhabi': 'abu dhabi',
  dharmasala: 'dharamsala',
  'dharamshala': 'dharamsala',
  chattogram: 'chittagong',
  'mirpur': 'dhaka',
  'fatullah': 'dhaka',
};

const fold = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[.]/g, ' ')
    .replace(/[^a-z0-9& -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const cityKey = (city) => {
  const c = fold(city);
  return CITY[c] ?? c;
};

/** The distinctive words of a ground's name, sorted: "M.Chinnaswamy Stadium" → ['chinnaswamy', 'm']. */
export function nameWords(name) {
  const words = fold(name).split(/[ &-]+/).filter((w) => w && !STOP.has(w));
  return [...new Set(words.length ? words : fold(name).split(' ').filter(Boolean))].sort();
}

/**
 * A ground from how a feed writes it: { words, city } from "Holkar Cricket Stadium, Indore" or
 * ("Kingsmead", "Durban"). With no city given, the last part after a comma is taken as the city.
 */
export function parseVenue(venue, city) {
  const parts = String(venue ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const name = parts[0] ?? '';
  const c = city || (parts.length > 1 ? parts[parts.length - 1] : '');
  return { words: nameWords(name), city: cityKey(c) };
}

/**
 * Two spellings of one ground: the same words, or one set inside the other where the extra words
 * are only optional ones ("New Wanderers" and "Wanderers", "Sheikh Zayed" and "Zayed"), never
 * ones that name a second ground ("Eden Park" and "Eden Park No 2").
 */
export function sameGround(a, b) {
  const [small, big] = a.length <= b.length ? [a, b] : [b, a];
  if (!small.length || !small.every((w) => big.includes(w))) return false;
  const extra = big.filter((w) => !small.includes(w));
  return extra.every((w) => OPTIONAL.has(w) && !SEPARATE.test(w));
}

/**
 * Finds a ground in the index ([{ id, city, alias: [[words], ...] }]) for a feed's venue, or null.
 * Same city first; a name that only one ground has anywhere if the cities don't agree or the feed
 * gives none (ESPN writes "Port of Spain" where Cricsheet has "Trinidad").
 */
export function findGround(index, venue, city) {
  const v = parseVenue(venue, city);
  if (!v.words.length) return null;
  const fits = (g) => g.alias.some((a) => sameGround(a, v.words));
  const here = v.city ? index.filter((g) => g.city === v.city && fits(g)) : [];
  if (here.length) return here[0];
  const anywhere = index.filter(fits);
  return anywhere.length === 1 ? anywhere[0] : null;
}
