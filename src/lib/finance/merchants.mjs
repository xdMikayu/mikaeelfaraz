// Clean display names for card descriptors.
//
// Bank descriptors are noisy: "AMZN MKTP US AMZN.COM/BILL US", "SP GUINNESS WORLD RECO + GB",
// "GEIDEA*TABBY FZ LLC dubai ARE". Known brands are mapped to their proper name first; anything
// else has processor prefixes, store numbers, domains, company suffixes and trailing
// city/country codes stripped, then is title-cased.

// [pattern tested against the lower-cased descriptor, display name] — most specific first.
const ALIASES = [
  // Marketplaces & shopping
  [/amazon grocery|amazon fresh/, 'Amazon Grocery'], [/\bamzn|amazon/, 'Amazon'], [/noon food/, 'Noon Food'], [/noon minutes/, 'Noon Minutes'],
  [/\bnoon\b|noon\.com|noon e-?commerce/, 'Noon'], [/namshi/, 'Namshi'], [/\bshein\b/, 'Shein'], [/\btemu\b/, 'Temu'], [/aliexpress/, 'AliExpress'],
  [/trendyol/, 'Trendyol'], [/\bebay\b/, 'eBay'], [/\bikea\b/, 'IKEA'], [/sharaf dg/, 'Sharaf DG'], [/brands for less/, 'Brands For Less'],
  [/\bzara\b/, 'Zara'], [/\bh ?& ?m\b|\bh and m\b/, 'H&M'], [/pull ?(?:and|&) ?bear/, 'Pull&Bear'], [/bershka/, 'Bershka'], [/levi.?s/, "Levi's"],
  [/hollister/, 'Hollister'], [/abercrombie/, 'Abercrombie & Fitch'], [/\bnike\b/, 'Nike'], [/adidas/, 'Adidas'], [/decathlon/, 'Decathlon'],
  [/sephora/, 'Sephora'], [/\bfaces\b/, 'Faces'], [/virgin megastore/, 'Virgin Megastore'], [/apple store|apple\.com\/ae|apple retail/, 'Apple Store'],
  [/cicek ?sepeti/, 'Çiçeksepeti'], [/\bz2u\b/, 'Z2U'], [/\bmynted\b/, 'Mynted'], [/dragon mart/, 'Dragon Mart'], [/\bcartier\b/, 'Cartier'],
  // Subscriptions & digital
  [/discord/, 'Discord'], [/openai|chatgpt/, 'OpenAI'], [/anthropic|claude\.ai/, 'Anthropic'], [/youtube ?premium|youtubepremium/, 'YouTube Premium'], [/google ?one/, 'Google One'],
  [/google.*(?:play|storage)|google \*|googl/, 'Google'], [/apple\.com\/bill|itunes/, 'Apple'], [/netflix/, 'Netflix'], [/spotify/, 'Spotify'],
  [/disney ?plus|disney\+/, 'Disney+'], [/\bosn\b/, 'OSN+'], [/shahid/, 'Shahid'], [/anghami/, 'Anghami'], [/microsoft|msft/, 'Microsoft'],
  [/\badobe\b/, 'Adobe'], [/\bnotion\b/, 'Notion'], [/\bcanva\b/, 'Canva'], [/name-?cheap/, 'Namecheap'], [/\bwhoop\b/, 'Whoop'], [/playstation|sony interactive/, 'PlayStation'],
  [/\bsteam(?:games|powered)?\b/, 'Steam'], [/roblox/, 'Roblox'], [/facebk|facebook|meta platforms/, 'Meta'], [/linkedin/, 'LinkedIn'], [/github/, 'GitHub'],
  // Food delivery & dining
  [/talabat/, 'Talabat'], [/deliveroo/, 'Deliveroo'], [/keeta/, 'Keeta'], [/careem ?food/, 'Careem Food'], [/instashop/, 'Instashop'],
  [/mc ?donald|mcdonalds|\bmcd\b/, "McDonald's"], [/\bkfc\b/, 'KFC'], [/burger ?king|burgerking/, 'Burger King'], [/five guys/, 'Five Guys'],
  [/shake shack/, 'Shake Shack'], [/nando/, "Nando's"], [/texas chicken/, 'Texas Chicken'], [/popeyes/, 'Popeyes'], [/pizza hut/, 'Pizza Hut'],
  [/domino/, "Domino's"], [/papa john/, "Papa John's"], [/\bsubway\b/, 'Subway'], [/starbucks/, 'Starbucks'], [/tim hortons/, 'Tim Hortons'],
  [/costa coffee|\bcosta\b/, 'Costa Coffee'], [/\bpret\b/, 'Pret A Manger'], [/dunkin/, "Dunkin'"], [/krispy kreme/, 'Krispy Kreme'], [/\btgif\b|tgi fridays/, 'TGI Fridays'],
  [/chili.?s/, "Chili's"], [/cold ?stone/, 'Cold Stone'], [/baskin/, 'Baskin-Robbins'], [/ben.?s cookies/, "Ben's Cookies"], [/carls? jr/, "Carl's Jr."],
  [/peets/, "Peet's Coffee"], [/espressolab/, 'Espressolab'], [/dave.?s hot chicken/, "Dave's Hot Chicken"],
  // Groceries
  [/carrefour/, 'Carrefour'], [/spinneys/, 'Spinneys'], [/\blulu\b/, 'Lulu'], [/waitrose/, 'Waitrose'], [/choithrams/, 'Choithrams'], [/union coop/, 'Union Coop'],
  [/grandiose/, 'Grandiose'], [/viva supermarket|\bviva\b/, 'Viva'], [/kibsons/, 'Kibsons'], [/al maya/, 'Al Maya'], [/west zone/, 'West Zone'],
  [/supermarche mini/, 'Supermarché Mini Mart'],
  // Transport & fuel
  [/careem hala/, 'Careem Hala'], [/careem bike/, 'Careem Bike'], [/careem/, 'Careem'], [/\blime\b/, 'Lime'], [/\buber\b/, 'Uber'], [/\bbolt\b/, 'Bolt'], [/dubai taxi/, 'Dubai Taxi'], [/national taxi/, 'National Taxi'],
  [/cars taxi/, 'Cars Taxi'], [/\bsalik\b/, 'Salik'], [/\brta\b|nol card/, 'RTA'], [/u ?drive/, 'Udrive'], [/\bekar\b/, 'Ekar'], [/indigo rent/, 'Indigo Rent A Car'],
  [/\bdott\b/, 'Dott'], [/\btesla\b/, 'Tesla'], [/\benoc\b/, 'ENOC'], [/\badnoc\b/, 'ADNOC'], [/\bemarat\b/, 'Emarat'], [/\beppco\b/, 'EPPCO'],
  // Travel
  [/agoda/, 'Agoda'], [/booking\.com|booking com/, 'Booking.com'], [/airbnb/, 'Airbnb'], [/expedia/, 'Expedia'], [/trip\.? ?com|trip dot com/, 'Trip.com'],
  [/tiket\.? ?com|tiketcom/, 'Tiket.com'], [/emirates airline|emirates\.com|\bemirates\b(?! (?:post|nbd|id))/, 'Emirates'], [/flydubai/, 'flydubai'],
  [/etihad ?air|etihadair/, 'Etihad Airways'], [/air arabia/, 'Air Arabia'], [/pelita air/, 'Pelita Air'], [/atlys/, 'Atlys'], [/vfs global|vfs gcc/, 'VFS Global'],
  // Bills, government, BNPL
  [/\bdu\b.*apple pay|^du\b|\bdu telecom|emirates integrated/, 'du'], [/\be&|etisalat|eand\b/, 'e&'], [/virgin mobile/, 'Virgin Mobile'], [/\bdewa\b/, 'DEWA'],
  [/digital dubai|smart dubai/, 'Digital Dubai'], [/\bgdrfa\b/, 'GDRFA'], [/\bicp\b/, 'ICP'], [/dubai police/, 'Dubai Police'], [/emirates post/, 'Emirates Post'],
  [/tabby/, 'Tabby'], [/tamara/, 'Tamara'], [/postpay/, 'Postpay'],
  // Services
  [/urban ?company|urbanclap/, 'Urban Company'], [/justlife/, 'Justlife'], [/guinness world/, 'Guinness World Records'], [/aramex/, 'Aramex'],
  [/reel (?:cinemas|entertainment)/, 'Reel Cinemas'], [/\bvox\b/, 'VOX Cinemas'], [/novo cinemas/, 'Novo Cinemas'], [/district by zomato/, 'District'],
  [/\bemaar\b/, 'Emaar'], [/motiongate|mgate/, 'Motiongate'],
];

// Payment processors / gateways that prefix the real merchant ("SP *SHOP", "GEIDEA*TABBY").
const PREFIXES = /^(?:sp|sq|sqr|pp|paypal|pos|qlub|paymob|geidea|myf|tap|pmb|ccb|dlo|payu|stripe|checkout|2co|fs|zettle|sumup)\s*\*+\s*/i;
const CITIES = /\b(?:dubai|abu ?dhabi|sharjah|ajman|al ain|fujairah|ras ?al ?khaimah|rasalkhaimah|rak|umm al quwain|dxb|auh|shj|london|istanbul|mountain view|san francisco|san jose|cork|amsterdam|singapore|sydney|plano|phoenix|norwich|jakarta|internet)\b/gi;
const COUNTRIES = /(?:\s+\+?\s*(?:ae|are|uae|us|usa|gb|gbr|uk|ie|irl|sg|sgp|tr|tur|in|ind|au|aus|de|deu|nl|nld|fr|fra|es|esp|it|ita|hk|hkg|sa|sau|id|idn|ca|can|ch|che|lu|lux))+\s*$/i;
const COMPANY = /\b(?:l\.?l\.?c|fz-?llc|fz-?e|fzco|fz|dmcc|l\.?t\.?d|limited|inc|co|corp|trading|trad|general trading|br of|branch|est|establishment)\b\.?/gi;

const LOWER_WORDS = new Set(['al', 'el', 'bin', 'abu', 'of', 'the', 'and', 'de', 'la', 'le', 'st', 'my', 'by', 'at', 'in', 'on', 'to']);
const ACRONYMS = new Set(['rta', 'dewa', 'sewa', 'addc', 'fewa', 'enoc', 'adnoc', 'eppco', 'ikea', 'vox', 'img', 'bbq', 'tgi', 'dxb', 'auh', 'uae', 'usa', 'mcd', 'ace', 'dhl', 'ups', 'nyu', 'ksa']);

function titleCase(s) {
  return s
    .split(' ')
    .map((w) => {
      if (LOWER_WORDS.has(w.toLowerCase())) return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); // "AL" → "Al"
      if (/^[a-z]{1,2}$/i.test(w)) return w.toUpperCase(); // "du" → "DU"
      if (ACRONYMS.has(w.toLowerCase()) || /^[bcdfghjklmnpqrstvwxz]{3,4}$/i.test(w)) return w.toUpperCase(); // KFC, RTA
      if (/[0-9&.]/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

/** "AMZN MKTP US AMZN.COM/BILL US" → "Amazon", "SOME NEW SHOP LLC DUBAI AE" → "Some New Shop". */
export function cleanMerchant(raw) {
  const original = String(raw || '').replace(/\s+/g, ' ').trim();
  const lower = original.toLowerCase();
  for (const [re, name] of ALIASES) if (re.test(lower)) return name;
  let s = original
    .replace(PREFIXES, '')
    .replace(/\b(?:apple|google|samsung)\s*pay\b/gi, ' ')
    .replace(/\b[\w-]+\.(?:com|net|org|io|ae|co)(?:\/\S*)?/gi, ' ') // domains, "amzn.com/bill"
    .replace(/\*+/g, ' ')
    .replace(/[#+]?\b\d{3,}\b/g, ' ') // store / phone / terminal numbers
    .replace(/\s+-\s+|\s-$/g, ' ');
  s = s.replace(COMPANY, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) s = s.replace(COUNTRIES, '').replace(new RegExp(`\\s+${CITIES.source}\\s*$`, 'i'), '').trim();
  s = s.replace(/[\s,.-]+$/, '').trim();
  if (s.length < 2) s = original;
  return titleCase(s);
}
