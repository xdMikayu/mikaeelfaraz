# mikaeelfaraz.com

Personal site (Next.js 14) plus **Mifolio**, a private card-spending tracker at `/finance`.

## Portfolio

Lives in the `src/app/(site)` route group so it never shares styles with Mifolio.

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

## Finance tracker

Tracks SIB, Mashreq Cashback and Tabby card spending in near real time, categorizes it
(built-in UAE merchant rules, then Claude for anything unknown), and shows this month vs
last month, 3/6/12-month and year-to-date views, per-card balances, budgets and top merchants.
Portfolio tracking (gold in AED, DFM stocks, Solana) is stubbed as “coming soon”.

```
iPhone Shortcuts ─ SIB SMS ─────────┐
iPhone Shortcuts ─ Wallet (Tabby) ──┼─► POST /api/finance/ingest ─► parse ─► dedupe/merge ─► Supabase
Gmail Apps Script ─ Mashreq email ──┘        (bearer token)                                   │
Netlify scheduled fn (15 min) ─► rules + Claude categorization ◄──────────────────────────────┤
/finance dashboard (Supabase Auth + RLS, realtime) ◄───────────────────────────────────────────┘
```

**Nothing private lives in this repo.** Data sits in Supabase behind Row Level Security;
keys and tokens are Netlify environment variables. Tests use made-up card numbers.

### One-time setup

1. **Database** — Supabase → SQL Editor → paste and run
   `supabase/migrations/20260923000000_finance.sql`.
2. **Your login** — Supabase → Authentication → Users → *Add user* (email + password,
   auto-confirm). Then Authentication → Providers/Settings → turn **off** “Allow new users to sign up”.
3. **Netlify env vars** (Site configuration → Environment variables), see `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `FINANCE_INGEST_TOKEN` — generate with `openssl rand -hex 32`
   - `FINANCE_OWNER_USER_ID` — your user id (shown on `/finance/setup` after signing in)
   - `ANTHROPIC_API_KEY` (optional, for AI categorization + “AI summary”)

   Redeploy after setting them (the public Supabase values are baked in at build time).
4. **Connect the cards** — follow `/finance/setup` on the live site: two iPhone Shortcuts
   automations (SIB SMS, Tabby Wallet taps) and the Gmail script in
   `integrations/mashreq-gmail.gs` (run `setup()` then `backfill()`).
5. **History** — Transactions → *Import* accepts pasted SIB SMS / Mashreq emails in bulk.

Preview without Supabase: `npm run dev` and open `/finance` (demo data).

### Code map

| Path | What |
|---|---|
| `src/lib/finance/parse.mjs` | SIB SMS / Mashreq email / Wallet parsers, merchant clean-up, Dubai time |
| `src/lib/finance/categories.mjs` | Categories + UAE keyword rules |
| `src/lib/finance/server.mjs` | Auth, ingest + cross-channel merge, categorization job |
| `src/lib/finance/ai.mjs` | Claude calls (categorize merchants, spending summary) |
| `src/app/api/finance/*` | `ingest`, `categorize`, `insights` routes |
| `netlify/functions/finance-categorize.mjs` | Scheduled categorization (every 15 min) |
| `src/app/finance/*` | Dashboard, transactions, setup, portfolio pages |

`npm test` runs the parser tests.

## Development

```bash
npm install
npm run dev   # http://localhost:3000
```
