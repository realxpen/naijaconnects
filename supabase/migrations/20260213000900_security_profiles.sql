-- Security hardening: profiles RLS, policies, and function search_path fixes

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Drop old policies if they exist
drop policy if exists "Read own profile" on public.profiles;
drop policy if exists "Update own profile" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;

-- Users can read/insert/update only their own row
create policy "profiles_select_own"
  on public.profiles
  for select
  using (id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admin/Founder/CEO can read/update any row
create policy "profiles_select_admin"
  on public.profiles
  for select
  using (public.is_founder_admin());

create policy "profiles_update_admin"
  on public.profiles
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Prevent direct wallet_balance updates from client roles
revoke update on public.profiles from authenticated, anon;

do $$
declare
  cols text := '';
  col text;
begin
  foreach col in array array[
    'first_name',
    'last_name',
    'phone',
    'avatar_url',
    'preferred_language',
    'pin_hash',
    'pin_length'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = col
    ) then
      if cols <> '' then
        cols := cols || ', ';
      end if;
      cols := cols || col;
    end if;
  end loop;

  if cols <> '' then
    execute format('grant update (%s) on public.profiles to authenticated', cols);
  end if;
end $$;

grant select on public.profiles to authenticated;

-- Fix search_path + security definer for listed functions (preserve signatures)
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'increment_balance',
        'credit_wallet',
        'fund_wallet',
        'fund_wallet_secure',
        'distribute_investor_payouts',
        'ensure_investor_profile'
      )
  loop
    execute format(
      'alter function %I.%I(%s) security definer set search_path = public',
      r.schema_name, r.func_name, r.args
    );
  end loop;
end $$;
