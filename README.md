# mikaeelfaraz.com

Personal site (Next.js 14) plus **Matchday**, a football and fantasy tracker at `/sport`.

## Portfolio

Lives in the `src/app/(site)` route group so it never shares styles with Matchday.

| Path | What |
|---|---|
| `src/app/(site)/page.jsx` | Home: intro, selected work ledger, system map, also built, Mifolio, background |
| `src/app/(site)/work/[slug]/page.jsx` | Case studies, statically generated |
| `src/app/(site)/_data/work.js` | The work ledger, also-built list and earlier roles |
| `src/app/(site)/_data/cases.js` | Case-study copy |
| `src/app/(site)/_components/Work.jsx` | Ledger table plus the SVG system map (hover a row to light its path) |
| `src/app/(site)/site.css` | All portfolio styles, scoped to `.site`; light and dark tokens |
| `public/resume.pdf` | One-page CV |

Design rules: Familjen Grotesk and Martian Mono (self-hosted via Fontsource), ink on paper with a
single ledger-green accent, no gradients, no scroll animation, no stock icons. Copy has no em dashes,
and every figure is a scale or method fact; no company revenue or customer data is published.

## Mifolio

Mifolio, the card-spending tracker that used to live at `/finance`, is now its own app at
[mifolio.mikaeelfaraz.com](https://mifolio.mikaeelfaraz.com) with its own repo. What stays here:

- `next.config.mjs` redirects old `/finance/*` links to the new site.
- `src/app/api/finance/[...path]/route.js` forwards iPhone Shortcuts and the Gmail script that still post to
  `/api/finance/*`. Delete it once every device uses the new address.
- `src/app/(site)/_components/MifolioCharts.jsx` is a copy of the four charts the homepage demo draws.

## Matchday

Football scores, match detail and live Fantasy Premier League points at `/sport`, with its own design
system (rules in `src/app/sport/DESIGN.md`). Cricket, F1 and wrestling can reuse the shell, preferences and
polling; only the adapters in `src/lib/sport/` are football-specific.

```
Browser ─ ESPN public site API (CORS *) ─► scores, events, lineups, stats, commentary, shots
   │        └─ on failure ─► /api/sport/espn (allow-listed relay, CDN cached)
   └─────── /api/sport/fpl/{static,live,entry,league} ─► FPL API (no CORS), trimmed, CDN cached
```

Costs nothing to run: every page is static, nothing is stored server-side, and the two API routes
send CDN cache headers so all viewers share one upstream call per window (FPL live: 20 s).
Preferences (followed teams, competition order, spoilers, FPL team ID) live in the viewer's
`localStorage`. Polling runs only while a match is live and the tab is visible.

| Path | What |
|---|---|
| `src/lib/sport/espn.mjs` | ESPN adapter: day boundaries, matches, events, shots, lineups, standings, teams |
| `src/lib/sport/xg.mjs` | xG model (logistic, fitted on StatsBomb open data; metrics in the header) |
| `src/lib/sport/fpl.mjs` | FPL maths: bonus from BPS, autosubs, captaincy, live league, league EO |
| `src/lib/sport/fpl-server.mjs` | FPL fetching and trimming, used by the API route |
| `src/lib/sport/fplmap.mjs` | ESPN to FPL club mapping, Opta xG from FPL live data |
| `src/app/sport/*` | Scores, match, table, team, fantasy and following pages |

`npm test` covers bonus tie rules, autosubs, chips, the live league, the xG model, ESPN day
boundaries and formation layout.

## Development

```bash
npm install
npm run dev   # http://localhost:3000
```
