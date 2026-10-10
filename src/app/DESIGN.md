# Matchday design rules

The football section at `/sport`. Its own system, like Mifolio's: nothing shared with the portfolio
or `/finance` styles. Every screen gets checked against this list before it ships.

## What it is for

Checking a score should take one look. Everything else (xG, lineups, fantasy) sits one tap
behind the score and never in front of it. The look comes from what's being shown:
results pages are tables, so the base is rows and numbers. It is not a magazine.

## Type

- **Archivo** (variable, width 62–125), one family for everything.
  - Team names and scores use the semi-condensed width (`wdth` 88), so long names fit on a phone.
  - Prose and controls use width 100.
- Numbers in columns use `tabular-nums` (scores, table columns, minutes, points), so a score
  changing from 1 to 10 never moves the row. The big score on the match page uses proportional
  figures.
- Headings are sentence case. No tracked all-caps eyebrows, no monospace labels.

## Colour

Neutral surfaces in both modes: a cool grey page and white or charcoal rows. No cream and no
near-black. Colour appears only where it means something:

| Token | Means | Never used for |
|---|---|---|
| `--sp-live` red | The match is being played right now (the minute, "HT") | decoration, buttons |
| `--sp-win` / `--sp-draw` / `--sp-loss` | Results in the form guide (always with the letter) | anything else |
| `--sp-yellow` / `--sp-red-card` | Card glyphs | text |
| Team colours | Identity of a team in a chart (shot map, xG line) | backgrounds, borders, text |

Team colours come from ESPN and are checked at runtime. If a team's colour is too faint against
the surface, or too close to the opponent's, the alternate colour is used, then a neutral pair.

## Shape and space

- Spacing: 4, 8, 12, 16, 24, 32, 48. Rows are 56 px on phones (tap target ≥ 44).
- Lists are rows separated by hairlines, grouped under sticky competition headers. No cards
  around rows, no nested cards, no coloured left borders, no shadows except on sheets and popovers.
- Corner radius: 6 px on controls, 12 px on sheets. Crests sit unframed.

## Motion

Only for a change of state:
- A score flashes once when it changes.
- A lineup row highlights once when it's confirmed.

Nothing fades in on scroll, nothing lifts on hover, nothing counts up. `prefers-reduced-motion`
turns the flash into a static marker.

## Words

- Say where data comes from and how old it is: "Updated 12 s ago", "ESPN", "Our xG estimate",
  "Bonus provisional".
- Times are shown in the viewer's own time zone, and the page names it once.
- No marketing adjectives, no exclamation marks, no emoji, no em dashes.
- Empty and error states say what happened and what happens next ("Couldn't reach ESPN for
  LaLiga. Trying again in 20 s.").

## Trust

- Never invent a number. A missing value shows a dash, and the reason is given where known.
- Spoiler mode hides scores, result colours and goal events until a deliberate tap. Page titles
  never contain scores.
- No ads, no tracking, no cookie banner (nothing is set but the viewer's own preferences, kept in
  their browser).
