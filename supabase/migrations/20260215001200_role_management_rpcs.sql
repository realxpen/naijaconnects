create or replace function public.assign_user_role_by_email(
  p_email text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_founder_admin() then
    raise exception 'Only founder/admin can assign roles';
  end if;

  if coalesce(nullif(btrim(p_email), ''), '') = '' then
    raise exception 'Email is required';
  end if;
  if p_role not in ('user', 'admin', 'founder', 'ceo', 'investor', 'employee', 'advisor') then
    raise exception 'Invalid role: %', p_role;
  end if;

  select p.id
  into v_user_id
  from public.profiles p
  where lower(p.email) = lower(btrim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for email %', p_email;
  end if;

  insert into public.user_roles (user_id, role)
  values (v_user_id, p_role)
  on conflict (user_id, role) do nothing;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', v_user_id,
    'role', p_role
  );
end;
$$;

grant execute on function public.assign_user_role_by_email(text, text) to authenticated;

create or replace function public.list_user_roles_by_email(
  p_email text
)
returns table (
  user_id uuid,
  email text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_founder_admin() then
    raise exception 'Only founder/admin can load roles';
  end if;

  return query
  select p.id as user_id, p.email, ur.role
  from public.profiles p
  left join public.user_roles ur on ur.user_id = p.id
  where lower(p.email) = lower(btrim(p_email))
  order by ur.role asc nulls last;
end;
$$;

grant execute on function public.list_user_roles_by_email(text) to authenticated;

create or replace function public.remove_user_role_by_email(
  p_email text,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_deleted int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_founder_admin() then
    raise exception 'Only founder/admin can remove roles';
  end if;

  select p.id
  into v_user_id
  from public.profiles p
  where lower(p.email) = lower(btrim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found for email %', p_email;
  end if;

  delete from public.user_roles ur
  where ur.user_id = v_user_id
    and ur.role = p_role;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'status', 'ok',
    'user_id', v_user_id,
    'role', p_role,
    'deleted', v_deleted
  );
end;
$$;

grant execute on function public.remove_user_role_by_email(text, text) to authenticated;
