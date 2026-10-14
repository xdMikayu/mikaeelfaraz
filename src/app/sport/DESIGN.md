# Matchday design rules: kit colours

The sports app at `/sport` (football, cricket, F1, and tennis and wrestling to come), a product with its own look. The
direction ("B: kit colours") was picked from three mockups. Check every screen against this file before it ships.

## The idea

A white page, black type, and the teams' own kit colours as the only colour fields. A live match is literally half
one kit and half the other. Everything else stays out of the way.

## Never

These are the patterns that make an interface read as AI-made. People list them on Reddit and Hacker News, and
two earlier versions of this app shipped them.

- Gradients of any kind, glows, radial "aurora" overlays, glassmorphism or backdrop blur.
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

- Every team colour goes through `src/lib/sport/kit-colors.mjs`, wherever it comes from:
  - ESPN's raw screen primaries become the colour of the real shirt: `#0000fa` a royal blue, `#ffff00` a kit yellow,
    neon greens a true green. Designed colours (Chelsea's blue, Villa's claret) pass unchanged.
  - One colour per team on a page: its block, its chart lines, its bars and its share of a forecast all match.
    `matchKits` decides it once per match.
  - In a block, a white kit takes the club's darker alternate when it has one; when it doesn't, or when the away
    side has to change into white, the block is a pale grey (`--sp-kit-white`) so it doesn't merge with the page.
  - When two kits clash the away side changes to its other kit, as on the pitch.
  - On the page, a colour that's too pale to read as a line (Man City's sky blue on white) gets a deeper shade of
    itself, never a different colour; a white kit is drawn in the page's ink.
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
- Phones: the sport's sections are tabs under the header (Scores · Fantasy · Tables · Following). The sports wait in
  a drawer behind the menu button, since switching sport is occasional. No bottom tab bar.
- Desktop: the same list is a 236 px sidebar, the current sport's sections nested under it.
- Settings is its own page: spoilers, appearance, the order of the sports and the one Matchday opens on.
- Every row in the drawer and sidebar is at least 44 px tall.

## Sport pictograms

Each sport is a pictogram drawn for the app (`SportGlyph` in `_components/glyphs.jsx`), not a logo:

- The navigation glyphs' grid and stroke: 22 units, 1.6 stroke, round caps and joins, outline first.
- Balanced to carry about the same ink: a ball, a bat and ball, a tennis ball's seams (diagonal, so it doesn't read
  as a baseball), a chequered flag, a championship belt.
- Words lead and the pictogram follows: the active sport gets weight and a 2 px ink rule, never a filled pill.
- A sport page's browser-tab icon is its pictogram (`public/sport/marks/`); saved to the home screen, it's still
  Matchday.

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
