-- Cards you no longer use keep their history but stop showing up as live cards.
-- Safe to run more than once.
alter table public.fin_accounts add column if not exists closed_at date;
