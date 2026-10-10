// Competitions ESPN's public site API serves (slug = its URL segment). `on` = shown by default.
// Order is the default order on the Today page; the viewer can reorder and hide any of them.
// Not available there: UAE Pro League (uae.1 returns nothing).
export const LEAGUES = [
  { slug: 'eng.1', name: 'Premier League', short: 'Premier League', country: 'England', on: true, table: true },
  { slug: 'uefa.champions', name: 'Champions League', short: 'Champions League', country: 'Europe', on: true, table: true },
  { slug: 'esp.1', name: 'LaLiga', short: 'LaLiga', country: 'Spain', on: true, table: true },
  { slug: 'ger.1', name: 'Bundesliga', short: 'Bundesliga', country: 'Germany', on: true, table: true },
  { slug: 'ita.1', name: 'Serie A', short: 'Serie A', country: 'Italy', on: true, table: true },
  { slug: 'fra.1', name: 'Ligue 1', short: 'Ligue 1', country: 'France', on: true, table: true },
  { slug: 'uefa.europa', name: 'Europa League', short: 'Europa League', country: 'Europe', on: true, table: true },
  { slug: 'uefa.europa.conf', name: 'Conference League', short: 'Conference League', country: 'Europe', on: true, table: true },
  { slug: 'eng.2', name: 'Championship', short: 'Championship', country: 'England', on: true, table: true },
  { slug: 'eng.fa', name: 'FA Cup', short: 'FA Cup', country: 'England', on: true, table: false },
  { slug: 'eng.league_cup', name: 'Carabao Cup', short: 'Carabao Cup', country: 'England', on: true, table: false },
  { slug: 'ksa.1', name: 'Saudi Pro League', short: 'Saudi Pro League', country: 'Saudi Arabia', on: true, table: true },
  { slug: 'ned.1', name: 'Eredivisie', short: 'Eredivisie', country: 'Netherlands', on: false, table: true },
  { slug: 'por.1', name: 'Primeira Liga', short: 'Primeira Liga', country: 'Portugal', on: false, table: true },
  { slug: 'sco.1', name: 'Scottish Premiership', short: 'Premiership', country: 'Scotland', on: false, table: true },
  { slug: 'usa.1', name: 'MLS', short: 'MLS', country: 'United States', on: false, table: true },
  { slug: 'eng.w.1', name: "Women's Super League", short: 'WSL', country: 'England', on: false, table: true },
  { slug: 'uefa.nations', name: 'Nations League', short: 'Nations League', country: 'International', on: true, table: false },
  { slug: 'fifa.worldq.uefa', name: 'World Cup qualifying, Europe', short: 'WCQ Europe', country: 'International', on: true, table: false },
  { slug: 'fifa.friendly', name: 'International friendlies', short: 'Friendlies', country: 'International', on: false, table: false },
];

export const LEAGUE_BY_SLUG = Object.fromEntries(LEAGUES.map((l) => [l.slug, l]));

export const leagueName = (slug) => LEAGUE_BY_SLUG[slug]?.name ?? slug;

