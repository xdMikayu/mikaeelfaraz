-- Portfolio: bank cash, DFM stocks and crypto alongside gold, plus a daily net worth history.
-- Safe to run whether or not 20260925000000_holdings.sql was run first.

create table if not exists public.fin_holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset       text not null default 'gold',
  karat       smallint,
  grams       numeric(12, 3),
  cost_aed    numeric(14, 2),
  bought_on   date,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.fin_holdings add column if not exists name text;          -- "Mashreq", "Emaar"
alter table public.fin_holdings add column if not exists symbol text;        -- EMAAR, SOL
alter table public.fin_holdings add column if not exists quantity numeric(20, 8); -- shares, coins, or cash balance
alter table public.fin_holdings add column if not exists currency text;      -- cash: AED, PKR, USD…
alter table public.fin_holdings add column if not exists updated_at timestamptz not null default now();
alter table public.fin_holdings alter column karat drop not null;
alter table public.fin_holdings alter column karat drop default;
alter table public.fin_holdings alter column grams drop not null;

alter table public.fin_holdings drop constraint if exists fin_holdings_asset_check;
alter table public.fin_holdings drop constraint if exists fin_holdings_karat_check;
alter table public.fin_holdings drop constraint if exists fin_holdings_grams_check;
alter table public.fin_holdings drop constraint if exists fin_holdings_cost_aed_check;
alter table public.fin_holdings drop constraint if exists fin_holdings_shape;
alter table public.fin_holdings add constraint fin_holdings_asset_check check (asset in ('gold', 'stock', 'crypto', 'cash'));
alter table public.fin_holdings add constraint fin_holdings_shape check (
  case asset
    when 'gold' then karat in (24, 22, 21, 18) and grams > 0
    when 'stock' then symbol is not null and quantity > 0
    when 'crypto' then symbol is not null and quantity > 0
    when 'cash' then currency is not null and quantity is not null
  end
);
alter table public.fin_holdings add constraint fin_holdings_cost_aed_check check (cost_aed is null or cost_aed >= 0);

create index if not exists fin_holdings_user on public.fin_holdings (user_id, created_at);

-- One row per day: what everything was worth. The scheduled job keeps today's row current.
create table if not exists public.fin_networth (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day          date not null,
  total_aed    numeric(16, 2) not null,
  assets_aed   numeric(16, 2) not null,
  owed_aed     numeric(16, 2) not null default 0,
  breakdown    jsonb not null default '{}',   -- { cash: …, stock: …, crypto: …, gold: … } in AED
  updated_at   timestamptz not null default now(),
  primary key (user_id, day)
);

-- Prices sent in from elsewhere (Malabar's UAE gold rate via the iPhone Shortcut).
create table if not exists public.fin_prices (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  asset       text not null,
  source      text not null,
  per_gram    jsonb not null,
  quoted_at   timestamptz,
  fetched_at  timestamptz not null default now(),
  primary key (user_id, asset, source)
);

do $$
declare t text;
begin
  foreach t in array array['fin_holdings', 'fin_networth', 'fin_prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner access" on public.%I', t);
    execute format(
      'create policy "owner access" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
