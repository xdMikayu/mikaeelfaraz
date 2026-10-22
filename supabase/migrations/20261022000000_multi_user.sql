-- Mifolio for more than one person: personal API keys for the iPhone Shortcuts and
-- the Gmail script, one set per user, replacing the single shared FINANCE_INGEST_TOKEN.
--
-- Only a SHA-256 hash of each key is stored, so the database never holds a key that
-- could be used if it leaked. Keys are created by /api/finance/keys (service role),
-- which shows the key to its owner once. Owners can list their keys and revoke them;
-- they can't create, re-point or un-revoke them from the browser.

create table if not exists public.fin_api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null default 'Shortcuts',
  prefix        text not null,              -- first characters, to tell keys apart in the list
  key_hash      text not null unique,       -- sha256 hex of the full key
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

create index if not exists fin_api_keys_user_idx on public.fin_api_keys (user_id);

alter table public.fin_api_keys enable row level security;

drop policy if exists "owner reads keys" on public.fin_api_keys;
create policy "owner reads keys" on public.fin_api_keys for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "owner revokes keys" on public.fin_api_keys;
create policy "owner revokes keys" on public.fin_api_keys for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Browsers may only rename or revoke; everything else is server-side.
revoke insert, update, delete on public.fin_api_keys from authenticated, anon;
grant select on public.fin_api_keys to authenticated;
grant update (name, revoked_at) on public.fin_api_keys to authenticated;

-- A revoked key stays revoked.
create or replace function public.fin_api_keys_guard() returns trigger
language plpgsql as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'A revoked key stays revoked';
  end if;
  return new;
end $$;

drop trigger if exists fin_api_keys_guard on public.fin_api_keys;
create trigger fin_api_keys_guard before update on public.fin_api_keys
  for each row execute function public.fin_api_keys_guard();
