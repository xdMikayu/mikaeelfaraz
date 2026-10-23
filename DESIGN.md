# Matchday design rules: kit colours

Matchday: football, cricket, F1, and tennis and wrestling to come, a product with its own look. The
direction ("B: kit colours") was picked from three mockups. Check every screen against this file before it ships.

## The idea

A white page, black type, and the teams' own kit colours as the only colour fields. A live match is literally half
one kit and half the other. Everything else stays out of the way.

## Never

These are the patterns that make an interface read as AI-made. People list them on Reddit and Hacker News, and
two earlier versions of this app shipped them.

- Gradients of any kind, glows, radial "aurora" overlays, glassmorphism or backdrop blur. The one exception is
  the phone tab bar's Liquid Glass (see Navigation): the platform's own material for controls floating over
  the content, never on the content itself.
- Purple, violet or indigo "brand" colours; neon accents on near-black or navy.
- Drop shadows on cards; cards wrapped around every section; rounded-2xl everything.
- Pills and badges on every status; pulsing dots.
- Rows of stat tiles ("1.51M Overall rank"); gradient logo marks; emoji.
- Cream-and-serif "tasteful" defaults: swapping one default for another doesn't fix it.

## Colour

| Colour | Means |
|---|---|
| Kit colours (from ESPN; FPL's own kit images on the fantasy pitch; F1's team colours from its timing data) | That team: split match cards, the match header, the team header, shirt markers, chart lines, possession; in F1 the thin bar beside each driver and his chart line (a team's second driver dashed) |
| Red | Live now (the minute), red cards, points lost |
| Green | Points gained; players who help you in your league |
| Grass green | Pitches |
| Black and white | Everything else |
| Ink at varying strength | Heat maps (projected points, fixture tickers, finishing positions, F1 sectors): more ink means more. F1 tyres too: more ink is a softer compound, wet tyres outlined |

- Every team colour goes through `src/lib/kit-colors.mjs`, wherever it comes from:
  - ESPN's raw screen primaries become the colour of the real shirt: `#0000fa` a royal blue, `#ffff00` a kit yellow,
    neon greens a true green. Designed colours (Chelsea's blue, Villa's claret) pass unchanged.
  - One colour per team on a page: its block, its chart lines, its bars and its share of a forecast all match.
    `matchKits` decides it once per match.
  - In a block, a white kit takes the club's darker alternate when it has one; when it doesn't, or when the away
    side has to change into white, the block is a pale grey (`--sp-kit-white`) so it doesn't merge with the page.
  - When two kits clash the away side changes to its other kit, as on the pitch.
  - On the page, a colour that's too pale to read as a line (Man City's sky blue on white) gets a deeper shade of
    itself, never a different colour; a white kit is drawn in the page's ink.
  - Two lines that someone red-green colour blind (about one man in twelve) would read as the same, such as
    Liverpool's red against Sporting's green, are checked by simulating how they see them; one line then moves a
    shade lighter or darker, the smallest step that tells them apart and no more than 0.2 in lightness, so each
    stays its own colour. Lightness is the one difference everyone sees.
- Nothing is told by colour alone: a six has a ring, a missed penalty a cross, a chart line its name at the end.
- Coloured blocks get a hairline edge so white halves don't merge with the page.
- Dark mode is neutral near-black (`#121212`), never navy. The kit colours are unchanged; only their lines lighten
  where they need to.

## Type

- **Archivo** throughout.
  - Numbers and headings are heavy and condensed (width 62–75, weight 900): scores, fantasy points, the wordmark.
  - Names are slightly condensed (width 85–90); prose is normal width.
- `tabular-nums` wherever numbers line up or change live.

## Shapes and layout

- Rows separated by hairlines, edge to edge on phones.
- Section headings are plain bold text with the competition's logo.
- Corners: 10 px on kit cards; 3–6 px on small things (form squares, buttons, name plates).
- Statuses are text: "FT" in grey, "38'" in red, "20:30" in ink.
- Fantasy plates follow the same rule: black when the player's match is over, red while it's on, an outline with
  the kick-off time while it's still to come.
- Tabs, the day picker and the league picker are words, underlined when active. Never boxed pills.
- One rule above each section. Two sections never stack two rules with a gap between them.
- Lists of shares are ranked bars, biggest first, every row named. Never a stacked bar with labels that don't fit.

## Navigation

- The header names the sport you're in: "Matchday · F1", the sport in heavy type. Pages don't repeat it in their
  own heading: a page's heading is its subject ("Wednesday 14 October", "United States Grand Prix").
- Phones: the sport's sections are a tab bar floating at the bottom, in reach of a thumb (Scores · Fantasy ·
  Tables · Following; Scores · Coming up · Guide; Weekend · Championship · Calendar), with search as a round
  button beside it. The sports wait in a drawer behind the menu button, since switching sport is occasional.
- The tab bar is iOS 26's Liquid Glass (`_components/TabBar.jsx`), sized as iOS sizes its own:
  - A capsule 62 px tall, 21 px above the home indicator once saved to the home screen, 10 px above Safari's own
    bar in a tab; search a 62 px circle 8 px to the side, alone at the trailing edge for a sport with no
    sections yet.
  - The glass: the page blurred (20 px) and a little more vivid behind white at 70% (near-black at 72% in dark
    mode), a bright rim top left, a hairline and a soft lift. Thick enough that its labels pass 4.5:1 over
    anything, since Safari has no "reduce transparency" setting. With "Increase contrast" it's solid with an
    outline; without blur, solid.
  - Icon over a word in every tab; the section you're in is in heavier type on a lens, a plain tint (never glass
    on glass). The lens moves the moment a finger lands on another tab and slides over with a little overshoot;
    held and dragged along the bar it swells into a clear bubble that follows the finger, and letting go opens
    the tab under it. No overshoot or swelling with "Reduce motion".
  - Tabs that are parts of one page (F1's championship, cricket's guide) mark the part you've scrolled to. The
    tab you're in takes you back to the top. The bar steps aside while the keyboard is up.
- Desktop: the same list is a 236 px sidebar, the current sport's sections nested under it, search at its top
  ("/" or Cmd-K opens it anywhere).
- Search finds everything: with nothing typed it lists every feature, sport by sport, in a line each, so nothing
  is only reachable by knowing where it is; typing narrows it to features, competitions, clubs and FPL players.
  Every tab, and every tab's own tabs, is in the address (`/fantasy?tab=players&view=sets`), so search,
  links and the back button can open any of them. A new feature gets a line in `FEATURES` in `_components/nav.js`.
- Nothing needs a team to be seen: without an FPL team ID, Fantasy's Gameweek, Players and Stats still work, and
  the team tab says what a team adds.
- Settings is its own page: spoilers, appearance, the order of the sports and the one Matchday opens on.
- Every row in the drawer, the sidebar and search is at least 44 px tall.

## The mark

"The fixture": two halves facing each other across a gap, home and away, or a ball about to be kicked off. A red
half and an ink half on a white tile (`public/icon.svg`), so it reads on any background, light or dark.

- It sits before the name everywhere the name appears: "◐ Matchday · Cricket" in the header, the menu and the
  sidebar.
- It's the app icon, the favicon and the home-screen icon (`favicon-32`, `icon-192`, `icon-512`, the maskable icon
  and the Apple touch icon, which are full squares since the phone rounds them itself).
- No letter, no gradient, no outline beyond the tile's hairline. Checked at 180, 64, 32 and 16 px on light and dark.

## Sport pictograms

Each sport is a pictogram drawn for the app (`SportGlyph` in `_components/glyphs.jsx`), not a logo:

- The navigation glyphs' grid and stroke: 22 units, 1.6 stroke, round caps and joins, outline first.
- Balanced to carry about the same ink: a ball, a bat and ball, a tennis ball's seams (diagonal, so it doesn't read
  as a baseball), a chequered flag, a championship belt.
- Words lead and the pictogram follows: the active sport gets weight and a 2 px ink rule, never a filled pill.
- A sport page's browser-tab icon is its pictogram (`public/marks/`); saved to the home screen, it's still
  Matchday's mark.

## Team markers

In lists, a small shirt in the kit colour (with the alternate colour at the collar) stands in for a crest. Crests
appear only on white discs inside kit-colour blocks, and in league tables.

## Tables

A bar beside each place says what it leads to, from ESPN's notes: ink for a reward (darker for a bigger one), an
outline for a play-off, red for the drop, and a line where one zone ends. No other colours.

## Match events

- Goals lead: the scorer heavier, and the score it made in the scoreboard's type on the outer side of the name.
  Substitutions recede.
- A red card in a kit-colour block sits on a small white chip, so it reads on a red kit too.
- The win-probability chart marks each goal with a ball above it and a faint rule in the scorers' colour.
- Every goal names who set it up, never behind a tap: under each scorer in the scoreboard a smaller line with a
  boot (`Boot` in `glyphs.jsx`) and the name, and in the key events "Assist **J. Doku**". In lineups a boot stands
  beside a player for each assist, as a ball does for each goal.

## Player ratings

Our own, worked out in `src/lib/ratings.mjs` from the free data (ESPN's lineups and numbers, Opta's commentary
with our xG, and FPL's Opta numbers in the Premier League) and checked against FPL's bonus points by
`scripts/check-ratings.mjs`. Settings › About the data explains them in plain words; keep that page true when
the weights or the scale change.

- A pill, one decimal, black figures on every band (`--sp-rt-*`), FotMob's scale: green (#33c771) from 7, orange from 6,
  red under 6, blue (#14a0ff) from 9, and the best on the pitch blue with a star. Black figures read at 5–10:1 where
  the apps' white ones manage 2–3:1. Pills are the convention every rating app uses, so they are the exception to
  "no pills".
- On the pitch the pill sits on the disc's top-right corner (see Lineups).
- The overview has the best on the pitch, with a big face, and each side's top five, faces first and plates lined up
  on the right; then the way to everyone's (Lineups). Substitutes' lists carry the plate beside their minutes.
- Nobody is rated before 10 minutes unless they scored, set one up or were sent off; while the match is on the
  ratings say "so far".

## Cricket, live

Built to be followed at a glance (`_components/CricketLive.jsx`):

- **The scoreboard:** each side's half in its colours, in the order they batted, the score in the scoreboard's type
  and "20 of 20 overs" in words. Under it an ink band (it inverts in dark mode) with the one sentence that matters,
  its numbers big: "India need **162** off **62** balls", "Heading for **243**", "India need **248** to win",
  or the result.
- **This over, ball by ball:** a wicket is red with a white W; a four or a six takes the batting side's colour (a six
  heavier); a dot ball is grey; runs are outlined in ink; wides and no-balls are outlined in grey with their mark.
  Slots for the balls still to come show only while that over is being bowled, and no total is given while ESPN's
  ball-by-ball lags the score.
- **The batters and the bowler** are cards topped with their side's colour: runs off balls big, then fours, sixes
  and strike rate in words. Form, records and match-ups wait behind a tap on each card. A fifty or a hundred is
  named in the side's colour.
- **The partnership** is one bar split between the two batters, in the same order as their cards.
- **Wickets** are a timeline, latest first: the red W, who and how, and the score it fell at.
- **At the innings break** the band gives the target, the cards become "Not out" and "Best bowling", and nothing
  says anyone is batting.
- Lists use the same scoreboard as a card that opens the match, with each side's chance under it.

## Set pieces

Who each Premier League club aims for at corners and free kicks into the box (`_components/SetPieces.jsx`,
built into `public/data/pl/setpieces.json` by `scripts/build-matchups.mjs`):

- Counted from Opta's commentary on ESPN: every shot or header that "followed a corner" or "a set piece
  situation". A player's share is of his club's attempts while he was on the pitch. A flick-on, or a header
  cleared before anyone shoots, isn't recorded, so they're attempts, never called first contacts.
- A grid of every club, its crest and name, its attempts and goals, then the three players with the most
  attempts, each a bar in the club's colour as long as his share. This season by default, last season a tap away.
- On the Premier League's table page and in Fantasy (Players › Set pieces), where FPL's takers sit under each
  club and the league's biggest threats are ranked above the grid, your own players ringed. A club's page has its
  own: who it aims for, who delivers, and how it does at both ends.

## Lineups

Both XIs on one flat pitch card (`_components/Lineups.jsx`), drawn as FotMob draws them: the app people hold up as
the standard, and the reference the owner of this site gave. The version before, with striped grass, kit-colour bars,
white-ringed discs and boxed labels, read as a 2005 management game. Research behind it (FotMob, SofaScore, Forza,
Flashscore, LiveScore, 365Scores, the Premier League's site, user reviews and forum threads) found these rules:

- One flat surface, no stripes, texture or gradient: FotMob green (`--sp-lu-bg`, #0a8452, a shade deeper than
  FotMob's #00985f so white names pass 4.5:1) in light mode, charcoal (#1c1c1e) in dark. Edge to edge on a phone.
- The markings are the faintest thing on it: 1px lines at 7–13% white, true to a 68m pitch at any height.
- The home side is at the top. Each team has a band one step lighter at its end, holding the team's average rating
  pill, the crest, the name in regular weight and the formation in semibold. No kit-colour fields: reviewers called
  team-coloured backgrounds "terrible".
- A player is a face cut out on a plain disc, near-white on the green and dark grey on the charcoal, with no ring
  (`PlayerDisc.jsx`). Photos are the Premier League's own, this season's or last season's. Without one, the disc
  holds a shirt in the kit colour with the number on it, so leagues without photos still show the teams.
- Around the disc, each piece ringed in the pitch colour so it stands clear of the photo:
  - the rating pill centred on the disc's top edge, to the right;
  - the minute a player went off over a coral (#e55e5b) arrow chip, top left;
  - a card on the left, halfway down;
  - assists bottom left and goals bottom right as white chips with dark glyphs, overlapping when there are several.
- Under the disc, "47 Foden": the number regular in a softer white or grey, the name medium white, 12.5px. No
  capitals, outlines or label plates.
- Discs are 46px, 44px four across and 40px five across, where names condense slightly. Lines are 96px apart, so the
  pitch grows with the lines a side plays and nothing collides.
- The benches below are one line each: the face, "28 Gerónimo Rulli", then the minute on, events and the rating
  pill. Unused substitutes are dimmed.

## DEFCON, live

In Fantasy › Team (`_components/FantasyDefcon.jsx`, `src/lib/fpl.mjs` `defconFixture`): every outfield
player who counts this gameweek against FPL's defensive-contribution line, 10 for a defender and 12 for a
midfielder or forward.

- A small box per contribution the line takes, filled in ink as they come and green once it's reached; the
  count (or, before kick-off, the chance) on the right.
- Under each, in words: what's still needed and the chance in the minutes left, or how it ended; the fixture;
  tackles, CBI and recoveries. A live row has the red edge every live row has.
- The one being chased hardest leads; then those reached, those still to play, near misses. Anyone with no
  real chance shares a single "Not close" line, so the list stays about the players who might get there.
- One sentence over it: the points banked and the closest chase, or before kick-off what's expected.
- Counts are FPL's live numbers. FPL's explain only lists them once they pay, so below the line the count
  comes from its live stats; the projections use the same count and the same chance.

## Effective ownership

In Fantasy › Team (`_components/FantasyEo.jsx`): every manager's multiplier on a player added up, as a share of the
managers, against your mini-league or the world's top 50 (the first page of FPL's overall league).

- What matters is the stake, your multiplier minus the EO: it leads each row, green when the player's points lift
  you against them and red when they drop you, on a bar that grows out from the middle.
- One sentence over the list says where your gameweek stands against their average, before hits.
- Each player card says it in words: "each point Haaland scores drops you 0.50 against them".

## Ask Matchday AI

A chat under Planner › Transfers (`_components/FantasyChat.jsx`, `src/lib/chat.mjs`) for the question the
planner can't answer on its own: why this player and not the one I want?

- The server does the arithmetic, the model the explaining. Its tools give a player's full report (minutes, threat,
  set pieces, defensive contributions, bonus, fixtures and role matchups, price, ownership in the manager's league,
  recent matches) and what a move does to the manager's own team over the planner's weeks, by the planner's own
  measure, with the budget and club rules checked.
- Players named in a question are looked up before the model starts, which saves it a round trip.
- The manager's questions sit in a quiet bubble on the right; the answers are plain text, verdict first, bold for
  the key numbers, bullets for the reasons. While it looks things up the page says what it's checking, in plain
  text with no spinner or dots.
- Three suggested questions start an empty chat, built from the planner's best swap. The conversation lasts for the
  browser tab, per team.

## Fantasy stats

Player stats lead with points, goals, assists, xG, xA, xGI, ± (goals and assists against their expected),
defensive contributions and ownership. Under them, each with its own anchor: who's above and below their xGI, where
the points come from (minutes, goals and assists, clean sheets, defensive contributions, bonus, saves and what was
lost) and every club against its xG at both ends. Season numbers add up FPL's live data, gameweek by gameweek.

Two charts sit among them, scatters drawn at their real width (`_components/Scatter.jsx`): labels go where they
fit, never over a shirt, a point that matters or another label; every point has a hover or tap card; a table
stands behind each; one sentence under each says what it shows.

- **DEFCON and goal threat** (`_components/FantasyCharts.jsx`, `src/lib/defcon.mjs`): defensive
  contributions per 90 against xGI per 90, for defenders or midfielders. FPL's line for 2 points is drawn, and
  curves join the players worth the same per 90 from the two together, by FPL's scoring and the projections'
  own model for reaching the line. The manager's players are in ink and named; everyone else is grey, the best
  six named.
- **Club chances**: every club's non-penalty xG and big chances a match, conceded or created, in Opta's numbers
  (`public/data/pl/chances.json`, built twice a week by `scripts/build-chances.mjs`). Shirts are
  the markers and the league's averages the lines; "Better" and "Worse" name the corners in words, never a
  red-to-green wash behind them.

## Live, every sport

What following cricket live taught, applied to football and F1 too:

- **The score stays in sight.** Once the scoreboard scrolls away, a compact bar sticks under the header: each
  side's score in its colours and the minute (football), the score and what's needed (cricket), the lap or the
  clock, the flag and the one sentence (F1). It takes no room until it's needed (`_components/Sticky.jsx`).
- **One sentence says what it means**, in an ink band under the scoreboard, its numbers big:
  - Football, in a league: "As it stands: **Liverpool** go up to **6th** · **LASK** stay **27th**", with every match
    in the league being played counted as if it ended now, and finished ones until ESPN's table has them
    (`src/lib/as-it-stands.mjs`); before kick-off, where a win would take each side; after the whistle,
    "In the table", for the rest of the day. In the second leg of a tie, the aggregate.
  - F1: "**Verstappen** leads by **4.2 s**, 12 laps to go"; in qualifying, who's out as it stands; "provisional
    pole"; in practice, the fastest.
- **Trust the score over the details.** ESPN's score moves before its events and its ball-by-ball. A goal the score
  has and the events don't yet shows as a goal with the scorer to follow; an over's total comes from the score.
- **Hold early numbers.** Nothing is shown that one moment can swing: possession waits until 5 minutes, a run rate
  until an over is done, F1 gaps until lap 2, and a trend until it has three clean laps (the same car ahead, no
  stop by either, no safety car). A drop zone is named once enough drivers have set a time to fill the places
  through.
- **Say what's moving.** Football: the last ten minutes in words ("City 4 shots (0.9 xG), Liverpool none"). F1:
  gaps that moved a second and a half or more over five clean laps ("Norris is catching Verstappen for the lead:
  3.4 s behind, 2.1 s closer than five laps ago").
- **A penalty shoot-out** is shown kick by kick: scored in the side's colour, missed or saved in red with a cross,
  and while it's on, the kicks still to come as empty rings. Its kicks aren't shots: they stay out of the xG.

## F1, the race weekend

The F1 pages open on the race weekend as a title card (`_components/F1Hero.jsx`), in ink:

- **The circuit, drawn large**, in white. Outlines from Tomislav Bacinger's f1-circuits (MIT licence; notice in
  `src/lib/f1-circuits.LICENSE.md`), built into `src/lib/f1-circuits.json` by
  `scripts/f1-circuits.mjs`.
- **The race in the scoreboard's type**, and under it the one thing that matters now, in big numerals: "Lights out
  in **11** days" before the weekend, "Qualifying in **3** h **12** min" during it, "On now: **Qualifying**" with a
  link to the timing, or the winner once it's over (not while spoilers are hidden).
- **The track's facts** in a line: its length and its first Grand Prix.
- **The title fight**: the leaders as bars in their team colours, as long as their points, and in ink what's at
  stake: "**Antonelli** leads Russell by **102** points, with up to **150** still to win. 6 drivers can still take
  it."

## Motion

- A new goal flashes the score once.
- Live timing is calm: no flashing rows, no pulsing dots.
- Nothing else moves except the page and the drawer.

## Words

- Say where data comes from and how old it is: "Updated 14 s ago", "Our estimate", "Bonus (provisional)".
- Times are in the viewer's own zone, named once on the page.
- Projections always say so ("projected", "expected") and the page explains how they're made. Chances never read
  0% or 100% while anything is left to play.
- No marketing words, no exclamation marks, no emoji.
- Never make the viewer do the maths. Say what a score means in words under it: in cricket, who leads or trails
  and by how much (adding up every innings), what a chasing side needs from how many balls, the target once it's
  set. Bold the answer; the rest of the sentence gives the context.
- Explain shorthand where it appears, plainly and once ("How to read cricket scores"), rather than assuming everyone
  reads it.

## Trust

- Never invent a number. A missing value shows a dash.
- Spoiler mode hides scores, form, tables and fantasy points until a deliberate tap.
- No ads and no tracking. The only thing stored is the viewer's own preferences, kept in their browser.
