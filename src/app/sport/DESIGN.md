# Matchday design rules

The football app at `/sport`. It is its own product with its own look, and shares nothing with the portfolio
or `/finance` styles. Check every screen against this list before it ships.

## What it is for

Checking a score should take one look; everything else is one tap behind it. The app should feel like a match
night: dark stands, bright pitch, the teams' own colours. It should not feel like a spreadsheet.

## Colour

Colour is everywhere, and every colour means something:

| Colour | Means |
|---|---|
| Team kit colours (from ESPN) | That team: match cards and heroes are tinted home kit to away kit; charts, shirts, lineups, possession |
| Red `--sp-live` | Being played right now: live pills, the pulsing dot, the minute |
| Green / red `--sp-win` / `--sp-loss` | Good or bad for you: wins, points gained, players who help you in your league |
| Gold `--sp-gold` | Captaincy and big scores (10+ FPL points), deadlines |
| Violet `--sp-fpl` | Fantasy: its hero card, tabs and league bars |
| Blue `--sp-brand` | What you can press or what's selected |
| Zone colours | League table places: Champions League blue, Europa orange, Conference green, relegation red |

The base is a deep navy at night (`#070b16`) and a cool grey by day. Pitches are always striped grass.
Tinted backgrounds cap the kit colour at 64%, so white text stays readable even for white kits.

## Type

- **Archivo** (variable, width 62–125) throughout.
  - Condensed and heavy (width 74–82, weight 800) for scores, big numbers and headings, like broadcast graphics.
  - Normal width for prose and controls.
- `tabular-nums` wherever numbers line up or change live, so rows never shift.

## Shapes

- Cards with 20 px corners.
- Pills for every status: live, FT, kick-off time, zone, chip.
- A floating tab bar.
- Circles for crests on tinted backgrounds, form results and timeline minutes.

## Pictures over tables

Prefer something you can see:
- a pitch with kits for a fantasy team;
- a minute-progress bar on live cards;
- a split bar for possession;
- a diverging bar for league ownership;
- coloured points chips by band;
- crests, kits and player photos from ESPN and the FPL CDN.

A plain list stays available where scanning matters (the List tab).

## Motion

Only for state:
- the live dot pulses;
- a new goal flashes the score once;
- tabs and toggles ease.

`prefers-reduced-motion` turns all of it off.

## Words

- Say where data comes from and how old it is: "Updated 14 s ago", "Our estimate", "Bonus (provisional)".
- Times are in the viewer's own zone, named once on the page.
- No marketing words, no exclamation marks, no emoji.

## Trust

- Never invent a number. A missing value shows a dash.
- Spoiler mode hides scores, form, tables and fantasy points until a deliberate tap. Page titles never contain
  scores.
- No ads and no tracking. The only thing stored is the viewer's own preferences, kept in their browser.
