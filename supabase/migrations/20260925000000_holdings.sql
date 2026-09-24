-- Portfolio holdings (gold for now). Same owner-only access as the other finance tables.
create table if not exists public.fin_holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset       text not null default 'gold' check (asset in ('gold')),
  karat       smallint not null default 24 check (karat in (24, 22, 21, 18)),
  grams       numeric(12, 3) not null check (grams > 0),
  cost_aed    numeric(14, 2) check (cost_aed is null or cost_aed >= 0), -- what you paid in total
  bought_on   date,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists fin_holdings_user on public.fin_holdings (user_id, created_at);

alter table public.fin_holdings enable row level security;
drop policy if exists "owner access" on public.fin_holdings;
create policy "owner access" on public.fin_holdings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.fin_holdings from anon;
grant select, insert, update, delete on public.fin_holdings to authenticated;
grant all on public.fin_holdings to service_role;

-- Latest prices sent in from elsewhere (Malabar's UAE gold rate, which Malabar only serves
-- to visitors in the UAE, so your iPhone fetches it and posts it here).
create table if not exists public.fin_prices (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset       text not null,
  source      text not null,
  per_gram    jsonb not null,  -- { "24": 530.25, "22": 491, ... } in AED
  quoted_at   timestamptz,     -- the time the source says the rate is from
  fetched_at  timestamptz not null default now(),
  primary key (user_id, asset, source)
);

alter table public.fin_prices enable row level security;
drop policy if exists "owner access" on public.fin_prices;
create policy "owner access" on public.fin_prices for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.fin_prices from anon;
grant select, insert, update, delete on public.fin_prices to authenticated;
grant all on public.fin_prices to service_role;
