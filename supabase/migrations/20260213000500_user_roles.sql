-- User roles for multi-role access
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint user_roles_unique unique (user_id, role),
  constraint user_roles_allowed check (role in ('user', 'admin', 'founder', 'ceo', 'investor', 'employee', 'advisor'))
);

-- Backfill from profiles.role if present
insert into public.user_roles (user_id, role)
select id, role
from public.profiles
where role is not null
on conflict do nothing;

alter table public.user_roles enable row level security;

create policy "user_roles_select_self_or_founder"
  on public.user_roles
  for select
  using (user_id = auth.uid() or public.is_founder_admin());

create policy "user_roles_write_founder_admin"
  on public.user_roles
  for insert
  with check (public.is_founder_admin());

create policy "user_roles_update_founder_admin"
  on public.user_roles
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

create policy "user_roles_delete_founder_admin"
  on public.user_roles
  for delete
  using (public.is_founder_admin());

-- Update helper to use user_roles (with fallback to profiles.role)
create or replace function public.is_founder_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'founder', 'ceo')
  )
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'founder', 'ceo')
  );
$$;
