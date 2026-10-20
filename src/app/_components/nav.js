// Where everything is: each sport and its own sections ("soon": a page saying what's coming). On
// phones the sections are the tab bar at the bottom; the sidebar (desktop) and the drawer list the
// sports; the header names the sport you're in: "Matchday · F1". FEATURES is everything there is
// to find, for the search.

const under = (...roots) => (p) => roots.some((r) => p === r || p.startsWith(`${r}/`) || p.startsWith(`${r}?`));

// A section with a hash is part of its sport's first page; the tab bar marks it as you scroll to it.
export const SPORTS = [
  {
    key: 'football',
    label: 'Football',
    href: '/sport',
    match: (p) => p === '/sport' || under('/sport/match', '/sport/team', '/sport/fantasy', '/sport/table', '/sport/following')(p),
    sections: [
      { href: '/sport', label: 'Scores', icon: 'scores', match: (p) => p === '/sport' || under('/sport/match', '/sport/team')(p) },
      { href: '/sport/fantasy', label: 'Fantasy', icon: 'fantasy', match: under('/sport/fantasy') },
      { href: '/sport/table/eng.1', label: 'Tables', icon: 'tables', match: under('/sport/table') },
      { href: '/sport/following', label: 'Following', icon: 'follow', match: under('/sport/following') },
    ],
  },
  {
    key: 'cricket',
    label: 'Cricket',
    href: '/sport/cricket',
    match: under('/sport/cricket'),
    sections: [
      { href: '/sport/cricket', label: 'Scores', icon: 'scores', match: under('/sport/cricket') },
      { href: '/sport/cricket#coming-up', label: 'Coming up', icon: 'calendar', match: () => false },
      { href: '/sport/cricket#guide', label: 'Guide', icon: 'guide', match: () => false },
    ],
  },
  { key: 'tennis', label: 'Tennis', href: '/sport/tennis', match: under('/sport/tennis'), soon: true },
  {
    key: 'f1',
    label: 'F1',
    href: '/sport/f1',
    match: under('/sport/f1'),
    sections: [
      { href: '/sport/f1', label: 'Weekend', icon: 'flag', match: (p) => p === '/sport/f1' || under('/sport/f1/race')(p) },
      { href: '/sport/f1#championship', label: 'Championship', icon: 'trophy', match: () => false },
      { href: '/sport/f1#calendar', label: 'Calendar', icon: 'calendar', match: () => false },
    ],
  },
  { key: 'wrestling', label: 'Wrestling', href: '/sport/wrestling', match: under('/sport/wrestling'), soon: true },
];

/** The sport a page belongs to; null for the pages that belong to none (settings). */
export const sportOf = (p) => (under('/sport/settings')(p) ? null : (SPORTS.find((s) => s.match(p)) ?? SPORTS[0]));

/** A sport page's browser-tab icon is its own pictogram; saved to the home screen it's still Matchday. */
export const sportIcons = (key) => ({
  icon: [
    { url: `/sport/marks/${key}.svg`, type: 'image/svg+xml' },
    { url: `/sport/marks/${key}-32.png`, sizes: '32x32', type: 'image/png' },
  ],
  apple: [{ url: '/sport/apple-touch-icon.png', sizes: '180x180' }],
});

/**
 * Everything there is, for the search: where it lives (sport, then the section or tab it's under),
 * what it is in a line, and the words someone might look for it by. Fantasy's tabs and their own
 * tabs are in the address (?tab=, ?view=), so every one of them can be opened directly.
 */
export const FEATURES = [
  { sport: 'football', where: 'Scores', title: 'Today’s scores', href: '/sport', blurb: 'Every match today, your teams first, live as it happens.', words: 'live results fixtures matches today yesterday tomorrow' },
  { sport: 'football', where: 'Scores', title: 'Match pages', href: '/sport', blurb: 'Shot map, expected goals, win chances, lineups, stats and commentary. Open any match.', words: 'xg shot map lineups commentary stats win probability momentum preview odds' },
  { sport: 'football', where: 'Scores', title: 'Player ratings', href: '/sport', blurb: 'Every player rated out of 10 on each match page, live, with the best on the pitch starred. Open any match.', words: 'ratings player rating fotmob sofascore whoscored man of the match motm best player out of 10 lineups' },
  { sport: 'football', where: 'Scores', title: 'Who set up each goal', href: '/sport', blurb: 'Every goal on a match page names the player who made it, under the score and in the key events.', words: 'assist assists assisted assister scorers goalscorers set up created' },
  { sport: 'football', where: 'Tables', title: 'League tables', href: '/sport/table/eng.1', blurb: 'Every competition’s table and what each place leads to.', words: 'standings positions premier league laliga bundesliga serie a ligue 1 champions league' },
  { sport: 'football', where: 'Tables', title: 'How the season could end', href: '/sport/table/eng.1#forecast', blurb: 'The Premier League’s matches left, played 4,000 times: title, top four and the drop.', words: 'forecast prediction simulation title relegation top four chances' },
  { sport: 'football', where: 'Tables', title: 'Set pieces: who each club aims for', href: '/sport/table/eng.1#set-pieces', blurb: 'Every Premier League club’s set-piece targets, attempts and goals.', words: 'set piece corners free kicks headers targets magnets delivery' },
  { sport: 'football', where: 'Tables', title: 'Club pages', href: '/sport/table/eng.1', blurb: 'Ratings, xG trend, where they leave chances, set pieces and the next five. Open a club from a table, or search for it here.', words: 'team club analysis ratings xg trend fixtures results form' },
  { sport: 'football', where: 'Following', title: 'Follow teams', href: '/sport/following', blurb: 'Their matches go to the top of the scores page.', words: 'favourite favorite my teams follow star' },
  { sport: 'football', where: 'Following', title: 'Choose your competitions', href: '/sport/following#competitions', blurb: 'Which ones the scores page shows, and in what order.', words: 'leagues order hide show competitions' },
  { sport: 'football', where: 'Following', title: 'Goal alerts', href: '/sport/following#alerts', blurb: 'Kick-off, goals, red cards and full time for the teams you follow.', words: 'notifications alerts push goal' },

  { sport: 'fantasy', where: 'Team', title: 'Your FPL team, live', href: '/sport/fantasy?tab=team', blurb: 'Points as they happen, bonus as it stands, projected autosubs.', words: 'fpl fantasy premier league points live bonus autosubs pitch' },
  { sport: 'fantasy', where: 'Team', title: 'DEFCON tracker', href: '/sport/fantasy?tab=team#defcon', blurb: 'How close each of your players is to FPL’s defensive-contribution line, live, and the chance they get there.', words: 'defcon defensive contributions live tracker cbit cbirt cbi tackles recoveries close line 2 points' },
  { sport: 'fantasy', where: 'Team', title: 'Effective ownership', href: '/sport/fantasy?tab=team#eo', blurb: 'Who moves your rank: each player’s EO in your league and among the top 50, against your multiplier.', words: 'eo effective ownership captain triple captain rank rivals threats' },
  { sport: 'fantasy', where: 'Planner', title: 'Captain and projections', href: '/sport/fantasy?tab=plan', blurb: 'Your players projected for the weeks ahead, and who to captain.', words: 'captain projections expected points xp planner' },
  { sport: 'fantasy', where: 'Planner', title: 'Matchday AI', href: '/sport/fantasy?tab=plan', blurb: 'Advice for the gameweek from the latest team news and press conferences.', words: 'ai advice assistant news press conference recommendation' },
  { sport: 'fantasy', where: 'Planner', title: 'Ask Matchday AI about a transfer', href: '/sport/fantasy?tab=plan&view=transfers#ask', blurb: 'Why we suggest one player and not the one you want, and who else fits your budget.', words: 'chat ask ai why question transfer compare alternative instead player' },
  { sport: 'fantasy', where: 'Planner', title: 'Our track record', href: '/sport/fantasy?tab=plan', blurb: 'Projections saved before each deadline, graded against what happened.', words: 'accuracy record grade history' },
  { sport: 'fantasy', where: 'Planner', title: 'Transfers', href: '/sport/fantasy?tab=plan&view=transfers', blurb: 'The best moves for your squad and budget over the weeks ahead.', words: 'transfer optimiser optimizer suggestions hits rate my team' },
  { sport: 'fantasy', where: 'Planner', title: 'Chips', href: '/sport/fantasy?tab=plan&view=chips', blurb: 'When your Wildcard, Free Hit, Bench Boost and Triple Captain are worth most.', words: 'wildcard free hit bench boost triple captain chip strategy' },
  { sport: 'fantasy', where: 'Planner', title: 'Fixture rotation', href: '/sport/fantasy?tab=plan&view=rotation', blurb: 'Two cheap starters whose fixtures alternate.', words: 'rotation rotate pair goalkeepers defenders cheap' },
  { sport: 'fantasy', where: 'Planner', title: 'Fixture ticker', href: '/sport/fantasy?tab=plan&view=fixtures', blurb: 'Every club’s fixtures ahead, easiest first, for attack or defence.', words: 'fixtures difficulty fdr ticker schedule' },
  { sport: 'fantasy', where: 'League', title: 'Your mini-league, live', href: '/sport/fantasy?tab=league', blurb: 'Re-ranked on live points, head to head with a rival, and who moves you.', words: 'mini league rival head to head effective ownership eo' },
  { sport: 'fantasy', where: 'Gameweek', title: 'Every match this gameweek', href: '/sport/fantasy?tab=gameweek', blurb: 'Expected goals and clean-sheet chances, from the bookmakers and our model, and Net xG.', words: 'gameweek odds bookmakers clean sheets net xg fixtures' },
  { sport: 'fantasy', where: 'Players', title: 'Price changes', href: '/sport/fantasy?tab=players&view=prices', blurb: 'Who’s likely to rise or fall tonight.', words: 'price rise fall change value' },
  { sport: 'fantasy', where: 'Players', title: 'Compare players', href: '/sport/fantasy?tab=players&view=compare', blurb: 'Up to three side by side.', words: 'compare versus vs head to head' },
  { sport: 'fantasy', where: 'Players', title: 'Watchlist', href: '/sport/fantasy?tab=players&view=watch', blurb: 'The players you’ve starred.', words: 'watchlist star saved shortlist' },
  { sport: 'fantasy', where: 'Players', title: 'Set-piece threats and takers', href: '/sport/fantasy?tab=players&view=sets', blurb: 'Who gets on the end of corners and free kicks, and who takes them.', words: 'set pieces corners free kicks penalties takers targets headers magnets' },
  { sport: 'fantasy', where: 'Players', title: 'Team news', href: '/sport/fantasy?tab=players&view=news', blurb: 'Injuries and the last or confirmed eleven for every club.', words: 'injuries injured doubtful lineups predicted team news suspended' },
  { sport: 'fantasy', where: 'Stats', title: 'Player stats', href: '/sport/fantasy?tab=stats', blurb: 'Points, goals, assists, xG, xA, defensive contributions and ownership, by period and position.', words: 'stats statistics xg xa xgi points form ownership gameweek stars' },
  { sport: 'fantasy', where: 'Stats', title: 'DEFCON and goal threat', href: '/sport/fantasy?tab=stats#stats-defcon', blurb: 'Defenders and midfielders by defensive contributions and xGI per 90, with curves for what the two are worth together.', words: 'defcon defensive contributions cbit cbirt xgi chart scatter graph defenders midfielders both points per 90' },
  { sport: 'fantasy', where: 'Stats', title: 'Above and below their xGI', href: '/sport/fantasy?tab=stats#stats-luck', blurb: 'Who’s running hot and who’s due: goals and assists against expected.', words: 'overperformers underperformers due luck xgi expected regression' },
  { sport: 'fantasy', where: 'Stats', title: 'Where the points come from', href: '/sport/fantasy?tab=stats#stats-points', blurb: 'Playing time, goals, clean sheets, defensive contributions and bonus, and how often DEFCON pays.', words: 'point sources defcon defensive contributions hit rate bonus clean sheets ppg points per game' },
  { sport: 'fantasy', where: 'Stats', title: 'Club chances: xG and big chances', href: '/sport/fantasy?tab=stats#stats-chances', blurb: 'Every club’s non-penalty xG and big chances a match, conceded or created, in Opta’s numbers.', words: 'npxg npxga xga big chances bca conceded created defence attack clean sheets chart scatter graph opta' },
  { sport: 'fantasy', where: 'Stats', title: 'Clubs against their xG', href: '/sport/fantasy?tab=stats#stats-clubs', blurb: 'Every club’s goals for and against, next to the expected numbers.', words: 'team attack defence xg xga finishing luck' },

  { sport: 'cricket', where: 'Scores', title: 'Cricket on now', href: '/sport/cricket', blurb: 'International and league matches live, with each side’s chance.', words: 'live scores cricket test odi t20 ipl' },
  { sport: 'cricket', where: 'Scores', title: 'Cricket match pages', href: '/sport/cricket', blurb: 'The scorecard, this over ball by ball, partnerships and win chances. Open any match.', words: 'scorecard batting bowling partnership wickets over' },
  { sport: 'cricket', where: 'Coming up', title: 'Cricket fixtures', href: '/sport/cricket#coming-up', blurb: 'The next matches, in your time.', words: 'fixtures schedule upcoming' },
  { sport: 'cricket', where: 'Guide', title: 'How to read cricket scores', href: '/sport/cricket#guide', blurb: 'The shorthand, explained once.', words: 'help explain guide overs wickets runs' },
  { sport: 'cricket', where: 'Guide', title: 'How the cricket numbers work', href: '/sport/cricket#guide', blurb: 'Par scores, projected totals and win chances, and how well they’ve done.', words: 'par projection win chance model' },

  { sport: 'f1', where: 'Weekend', title: 'Race weekend', href: '/sport/f1', blurb: 'The sessions in your time, the countdown and the results.', words: 'grand prix race qualifying practice sprint schedule' },
  { sport: 'f1', where: 'Weekend', title: 'Live timing', href: '/sport/f1', blurb: 'Gaps, tyres and pit stops during every session.', words: 'live timing gaps tyres pit stops lap' },
  { sport: 'f1', where: 'Weekend', title: 'Session analysis', href: '/sport/f1', blurb: 'Lap charts, tyre strategies and race pace for every session.', words: 'lap chart tyre strategy pace analysis' },
  { sport: 'f1', where: 'Championship', title: 'F1 championship', href: '/sport/f1#championship', blurb: 'Drivers and constructors, and who can still win it.', words: 'standings drivers constructors title points' },
  { sport: 'f1', where: 'Calendar', title: 'F1 calendar', href: '/sport/f1#calendar', blurb: 'Every race this season.', words: 'calendar schedule season races' },

  { sport: 'tennis', where: 'Tennis', title: 'Tennis', href: '/sport/tennis', blurb: 'What’s on now, while the full section is built.', words: 'atp wta grand slam' },
  { sport: 'wrestling', where: 'Wrestling', title: 'Wrestling', href: '/sport/wrestling', blurb: 'What’s coming.', words: 'wwe aew' },

  { sport: 'settings', where: 'Settings', title: 'Spoiler mode', href: '/sport/settings#spoilers', blurb: 'Hide scores until you tap, for every team or just yours.', words: 'spoilers hide scores' },
  { sport: 'settings', where: 'Settings', title: 'Dark mode', href: '/sport/settings#appearance', blurb: 'Light, dark or the same as your phone.', words: 'appearance theme dark light' },
  { sport: 'settings', where: 'Settings', title: 'Your sports', href: '/sport/settings#sports', blurb: 'Their order in the menu, and the one Matchday opens on.', words: 'order sports start open' },
  { sport: 'settings', where: 'Settings', title: 'About the data', href: '/sport/settings#about', blurb: 'Where every number comes from and how old it is.', words: 'data sources espn fpl opta about' },
  { sport: 'settings', where: 'Settings', title: 'How the xG model works', href: '/sport/settings#xg', blurb: 'Fitted on 25,513 shots from StatsBomb’s open data.', words: 'xg expected goals model statsbomb' },
  { sport: 'settings', where: 'Settings', title: 'How the player ratings work', href: '/sport/settings#ratings', blurb: 'What moves a rating, and how they compare with FPL’s bonus points.', words: 'ratings player rating model bps bonus points how worked out' },
];

export const FEATURE_GROUPS = [
  ['football', 'Football'],
  ['fantasy', 'Fantasy'],
  ['cricket', 'Cricket'],
  ['f1', 'F1'],
  ['tennis', 'Tennis'],
  ['wrestling', 'Wrestling'],
  ['settings', 'Settings'],
];

/** Folds accents and case, so "Odegaard" finds "Ødegaard" and "set piece" finds "Set-piece". */
export const fold = (s) =>
  (s ?? '')
    .replace(/[øØ]/g, 'o')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Features matching every word of the query, best first: in the title, then the line, then the extra words. */
export function findFeatures(query) {
  const words = fold(query).split(' ').filter(Boolean);
  if (!words.length) return [];
  const scored = [];
  for (const f of FEATURES) {
    const title = fold(f.title);
    const rest = fold(`${f.where} ${f.blurb} ${f.words}`);
    let score = 0;
    for (const w of words) {
      const t = title.split(' ').some((x) => x.startsWith(w)) ? 3 : title.includes(w) ? 2 : rest.includes(w) ? 1 : 0;
      if (!t) {
        score = 0;
        break;
      }
      score += t;
    }
    if (score) scored.push([score, f]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, f]) => f);
}
