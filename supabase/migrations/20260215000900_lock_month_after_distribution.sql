create or replace function public.distribute_investor_payouts(
  p_month text,
  p_apply boolean default true
)
returns table (
  investor_id uuid,
  payout numeric,
  remaining_cap numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool numeric;
  v_total_contrib numeric;
  v_percent numeric;
  v_net_profit numeric;
  v_is_distributed boolean;
  r record;
  v_calc_payout numeric;
  v_inserted_amount numeric;
  v_wallet numeric;
begin
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month format (expected YYYY-MM): %', p_month;
  end if;

  perform pg_advisory_xact_lock(hashtext('investor_payout_' || p_month));

  select
    m.net_profit,
    coalesce(m.investor_pool_percent, 0.20),
    coalesce(m.is_distributed, false)
  into v_net_profit, v_percent, v_is_distributed
  from public.monthly_profit_tracker m
  where m.month = p_month
  for update;

  if v_net_profit is null then
    raise exception 'No monthly_profit_tracker row for %', p_month;
  end if;

  if p_apply and v_is_distributed then
    raise exception 'Month % is already closed/distributed', p_month;
  end if;

  if p_apply then
    with to_apply as (
      select rr.id, rr.investor_id, rr.amount
      from public.investor_reinvest_requests rr
      where rr.status = 'approved'
        and coalesce(rr.applied, false) = false
        and rr.effective_month is not null
        and rr.effective_month <= p_month
      for update
    ),
    upd as (
      update public.investors i
      set contribution = coalesce(i.contribution, 0) + ta.amount,
          max_return = (coalesce(i.contribution, 0) + ta.amount) * 1.5
      from to_apply ta
      where i.id = ta.investor_id
      returning ta.id
    )
    update public.investor_reinvest_requests rr
    set applied = true,
        applied_at = now()
    where rr.id in (select id from upd);
  end if;

  v_pool := greatest(0, v_net_profit * v_percent);

  select coalesce(sum(i.contribution), 0)
  into v_total_contrib
  from public.investors i
  where i.status = 'approved';

  if v_pool = 0 or v_total_contrib = 0 then
    if p_apply then
      update public.monthly_profit_tracker
      set is_distributed = true,
          distributed_at = coalesce(distributed_at, now())
      where month = p_month;
    end if;
    return;
  end if;

  for r in
    select
      i.id as inv_id,
      i.user_id as inv_user_id,
      i.contribution as inv_contribution,
      coalesce(i.max_return, i.contribution * 1.5) as inv_max_return,
      coalesce(i.total_received, 0) as inv_total_received
    from public.investors i
    where i.status = 'approved'
  loop
    v_calc_payout := least(
      (r.inv_contribution / v_total_contrib) * v_pool,
      greatest(0, r.inv_max_return - r.inv_total_received)
    );

    if v_calc_payout <= 0 then
      continue;
    end if;

    if p_apply then
      v_inserted_amount := null;

      insert into public.investor_payouts (investor_id, month, amount)
      values (r.inv_id, p_month, v_calc_payout)
      on conflict (investor_id, month) do nothing
      returning amount into v_inserted_amount;

      if v_inserted_amount is null then
        continue;
      end if;

      update public.investors i
      set total_received = coalesce(i.total_received, 0) + v_inserted_amount
      where i.id = r.inv_id;

      if r.inv_user_id is not null then
        select wallet_balance into v_wallet
        from public.profiles
        where id = r.inv_user_id
        for update;

        if v_wallet is not null then
          update public.profiles
          set wallet_balance = v_wallet + v_inserted_amount
          where id = r.inv_user_id;
        end if;
      end if;

      investor_id := r.inv_id;
      payout := v_inserted_amount;
      remaining_cap := greatest(0, r.inv_max_return - (r.inv_total_received + v_inserted_amount));
      return next;
    else
      investor_id := r.inv_id;
      payout := v_calc_payout;
      remaining_cap := greatest(0, r.inv_max_return - r.inv_total_received);
      return next;
    end if;
  end loop;

  if p_apply then
    update public.monthly_profit_tracker
    set is_distributed = true,
        distributed_at = coalesce(distributed_at, now())
    where month = p_month;
  end if;

  return;
end;
$$;

grant execute on function public.distribute_investor_payouts(text, boolean) to authenticated;
