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
| Ink at varying strength | Heat maps (projected points, fixture tickers, finishing positions): more ink means more |

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
- Fantasy plates follow the same rule: black when the player's match is over, red while it's on, an outline with
  the kick-off time while it's still to come.
- Tabs and the day picker are words, underlined when active. The sports row at the top of Scores is the one
  exception: each sport's mark over its name, underlined when active.
- The tab bar is a plain bar with a hairline top edge.

## Sport marks

Every sport has a mark in `public/sport/marks/`, in the same family as the app icon:

- A rounded square of the sport's own surface: grass, the cricket pitch, a court, asphalt, the ring.
- One object on it, split down the middle: red on the left, white on the right. A shirt, a ball split along its
  seam, a car, a mask. Where a split object would read as something else (a red and white tennis ball looks like a
  baseball), the surface takes the split instead: hard court and clay either side of the net.
- Flat colours, no outlines, gradients or shadows; ink (`#111`) only for details like a collar or wheels.
- Checked at 180, 60, 32 and 16 px on light and dark before it ships.

The app icon stays the football mark. A sport page uses its own mark as the browser-tab icon; saved to the home
screen, it's still Matchday.

## Team markers

In lists, a small shirt in the kit colour (with the alternate colour at the collar) stands in for a crest. Crests
appear only on white discs inside kit-colour blocks.

## Motion

- A new goal flashes the score once.
- Nothing else moves except the page.

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
