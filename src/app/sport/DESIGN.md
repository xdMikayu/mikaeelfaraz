# Matchday design rules: kit colours

The football app at `/sport`, a product with its own look. The direction ("B: kit colours") was picked from three
mockups. Check every screen against this file before it ships.

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
| Kit colours (from ESPN; FPL's own kit images on the fantasy pitch) | That team: split match cards, the match header, the team header, shirt markers, chart lines, possession |
| Red | Live now (the minute), red cards, points lost |
| Green | Points gained; players who help you in your league |
| Grass green | Pitches |
| Black and white | Everything else |

- Near-white kits fall back to the club's alternate colour when it has a darker one.
- Coloured blocks get a hairline edge so white halves don't merge with the page.
- Dark mode is neutral near-black (`#121212`), never navy. The kit colours are unchanged.

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
- Tabs and the day picker are words, underlined when active.
- The tab bar is a plain bar with a hairline top edge.

## Team markers

In lists, a small shirt in the kit colour (with the alternate colour at the collar) stands in for a crest. Crests
appear only on white discs inside kit-colour blocks.

## Motion

- A new goal flashes the score once.
- Nothing else moves except the page.

## Words

- Say where data comes from and how old it is: "Updated 14 s ago", "Our estimate", "Bonus (provisional)".
- Times are in the viewer's own zone, named once on the page.
- No marketing words, no exclamation marks, no emoji.

## Trust

- Never invent a number. A missing value shows a dash.
- Spoiler mode hides scores, form, tables and fantasy points until a deliberate tap.
- No ads and no tracking. The only thing stored is the viewer's own preferences, kept in their browser.
