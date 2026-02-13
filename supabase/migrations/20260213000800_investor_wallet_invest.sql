-- Investor wallet investment RPC (safe update via security definer)
create or replace function public.invest_from_wallet(p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_balance numeric;
  v_contribution numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select wallet_balance into v_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_balance is null then
    raise exception 'Profile not found';
  end if;
  if v_balance < p_amount then
    raise exception 'Insufficient balance';
  end if;

  -- Ensure investor exists
  insert into public.investors (user_id, name, email, contribution, total_received, max_return, status)
  select id,
         trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')),
         email,
         0, 0, 0, 'approved'
  from public.profiles
  where id = v_user_id
  on conflict do nothing;

  select contribution into v_contribution
  from public.investors
  where user_id = v_user_id
  for update;

  update public.investors
    set contribution = coalesce(v_contribution, 0) + p_amount,
        max_return = (coalesce(v_contribution, 0) + p_amount) * 1.5
  where user_id = v_user_id;

  update public.profiles
    set wallet_balance = v_balance - p_amount
  where id = v_user_id;
end;
$$;

grant execute on function public.invest_from_wallet(numeric) to authenticated;
