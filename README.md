# mikaeelfaraz.com

Personal site (Next.js 14). Two apps that started here have their own sites and repositories now:
**Mifolio**, the card-spending tracker that was at `/finance`, and **Matchday**, live sport and fantasy
football, that was at `/sport`.

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

Live football, cricket and F1, and Fantasy Premier League, at
[matchday.mikaeelfaraz.com](https://matchday.mikaeelfaraz.com), from its own repository,
[xdMikayu/matchday](https://github.com/xdMikayu/matchday), which took its history along. What's left here:

| Path | What |
|---|---|
| `src/app/sport/[[...path]]` | Old `/sport` links: on to the same page at the new address |
| `src/lib/matchday/link.mjs` | Links to Matchday that carry the viewer's saved settings (a browser keeps them per address) |
| `src/app/(site)/_components/MatchdayMini.jsx` | The home page's showcase: three of its screens on made-up numbers |
| `src/lib/matchday/*` | Copies of the sums and circuit maps those screens use, with their tests |

## Development

```bash
npm install
npm run dev   # http://localhost:3000
npm test      # the showcase's copies of Matchday's sums
```
