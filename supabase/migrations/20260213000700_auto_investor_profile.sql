-- Auto-create investor profile when role assigned
create or replace function public.ensure_investor_profile()
returns trigger
language plpgsql
as $$
declare
  v_profile record;
begin
  if (new.role <> 'investor') then
    return new;
  end if;

  select id, email, first_name, last_name
    into v_profile
  from public.profiles
  where id = new.user_id;

  if v_profile.id is null then
    return new;
  end if;

  insert into public.investors (user_id, name, email, contribution, total_received, max_return, status)
  values (
    v_profile.id,
    trim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')),
    v_profile.email,
    50000,
    0,
    50000 * 1.5,
    'approved'
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_ensure_investor_profile on public.user_roles;
create trigger trg_ensure_investor_profile
after insert on public.user_roles
for each row
execute function public.ensure_investor_profile();
