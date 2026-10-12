-- Bank balances that keep themselves up to date:
--   last4      the account number's last four digits, matched against Mashreq account emails
--              ("Your AC No: XXXXXXXX1234 is credited with AED …")
--   card_slug  the debit card that spends from this account (e.g. 'mashreq_debit'); its alerts
--              state the balance outright
--   balance_at when the balance was last set outright (by you or a card alert); emails from
--              before then are already included and are skipped
alter table public.fin_holdings add column if not exists last4 text;
alter table public.fin_holdings add column if not exists card_slug text;
alter table public.fin_holdings add column if not exists balance_at timestamptz;
create index if not exists fin_holdings_last4 on public.fin_holdings (user_id, last4) where last4 is not null;
