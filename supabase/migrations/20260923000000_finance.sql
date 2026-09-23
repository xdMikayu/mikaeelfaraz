-- Finance tracker schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Every row belongs to a Supabase Auth user and Row Level Security limits each
-- signed-in user to their own rows. The server-side ingest endpoint uses the
-- service-role key and writes rows for FINANCE_OWNER_USER_ID.

create extension if not exists pgcrypto;

create table if not exists public.fin_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug          text not null,                -- 'sib' | 'mashreq' | 'tabby' | anything you add
  name          text not null,
  last4         text,
  kind          text not null default 'credit' check (kind in ('credit', 'debit', 'bnpl')),
  credit_limit  numeric(12, 2),
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  unique (user_id, slug)
);

create table if not exists public.fin_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id         uuid not null references public.fin_accounts (id) on delete cascade,
  occurred_at        timestamptz not null,
  amount             numeric(12, 2) not null check (amount >= 0),
  currency           text not null default 'AED',
  amount_aed         numeric(12, 2) not null check (amount_aed >= 0),
  fx_estimated       boolean not null default false,
  direction          text not null default 'debit' check (direction in ('debit', 'credit')),
  merchant_raw       text,
  merchant           text,
  category           text,
  category_source    text check (category_source in ('keyword', 'rule', 'ai', 'user')),
  available_balance  numeric(12, 2),
  notes              text,
  excluded           boolean not null default false,  -- hide from spend totals (reimbursable, transfer, ...)
  source             text not null,                   -- 'sms' | 'email' | 'wallet' | 'manual' | 'import'
  sources            text[] not null default '{}',    -- every source that reported this purchase
  dedupe_key         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists fin_transactions_user_time on public.fin_transactions (user_id, occurred_at desc);
create index if not exists fin_transactions_uncategorized on public.fin_transactions (user_id) where category is null;

create table if not exists public.fin_raw_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  received_at     timestamptz not null default now(),
  source          text not null,
  external_id     text,                 -- e.g. Gmail message id, so re-sends are idempotent
  payload         jsonb not null,
  status          text not null default 'pending' check (status in ('pending', 'parsed', 'merged', 'duplicate', 'ignored', 'unparsed', 'dismissed')),
  reason          text,
  transaction_id  uuid references public.fin_transactions (id) on delete set null,
  unique (user_id, source, external_id)
);

create index if not exists fin_raw_events_user_status on public.fin_raw_events (user_id, status, received_at desc);

-- Merchant → category memory. Written when you recategorize a transaction
-- ('user') and when the AI job classifies a new merchant ('ai').
create table if not exists public.fin_merchant_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  match       text not null,      -- normalized merchant key (lowercase, alphanumerics)
  category    text not null,
  source      text not null default 'user' check (source in ('user', 'ai')),
  created_at  timestamptz not null default now(),
  unique (user_id, match)
);

create table if not exists public.fin_budgets (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category        text not null,
  monthly_amount  numeric(12, 2) not null check (monthly_amount > 0),
  primary key (user_id, category)
);

-- updated_at bookkeeping
create or replace function public.fin_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists fin_transactions_touch on public.fin_transactions;
create trigger fin_transactions_touch before update on public.fin_transactions
  for each row execute function public.fin_touch_updated_at();

-- Row Level Security: owner-only access for signed-in users; nothing for anon.
do $$
declare t text;
begin
  foreach t in array array['fin_accounts', 'fin_transactions', 'fin_raw_events', 'fin_merchant_rules', 'fin_budgets'] loop
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

-- Live updates on the dashboard when a new transaction lands.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'fin_transactions'
  ) then
    alter publication supabase_realtime add table public.fin_transactions;
  end if;
end $$;
