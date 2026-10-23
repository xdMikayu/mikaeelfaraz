# Matchday

Live football, cricket and F1 with the sums done for you, and Fantasy Premier League points as they
happen. No ads, no accounts: what a viewer chooses stays in their browser.

[matchday.mikaeelfaraz.com](https://matchday.mikaeelfaraz.com) · Next.js 14 on Netlify

## Run it

```sh
npm install
npm run dev     # http://localhost:3000
npm test        # the models and the sums
npm run lint
```

Copy `.env.example` to `.env.local` to switch on Matchday AI (advice, the transfer chat, news
checks). Without a key everything else works.

## Where things are

- `src/app`: the pages (football at `/`, then `/fantasy`, `/cricket`, `/f1`, …), and in
  `src/app/api` the routes that fetch and cache ESPN, FPL, F1 and the bookmakers.
- `src/lib`: the models and the sums: xG, player ratings, FPL projections, the cricket chase model,
  F1 standings and race predictions. Tests sit next to them.
- `scripts`: the data builds. `data` keeps their caches and the saved projections, `public/data`
  what the pages read.
- `DESIGN.md`: the design rules. Check every screen against it.

## Data jobs

Two GitHub Actions workflows keep the data fresh, with nothing to set up beyond Actions being on:

- **Matchday data** (`matchday-data.yml`), Monday, Tuesday, Thursday and Friday mornings: adds
  finished Premier League matches, refits Net xG, saves and grades the weekly projections, and
  commits. The commit redeploys the site.
- **F1 data** (`f1-data.yml`), every two hours from Friday to Monday: FastF1's session files,
  pushed to the `f1-data` branch, which the site reads as it runs, so they need no redeploy. That
  branch is read through raw.githubusercontent.com, so this repository has to stay public (or set
  `F1_DATA_URL`).

## History

Matchday started at www.mikaeelfaraz.com/sport, in
[xdMikayu/mikaeelfaraz](https://github.com/xdMikayu/mikaeelfaraz), and moved here with its history
in October 2026. Pull request numbers in the older commits are that repository's.
