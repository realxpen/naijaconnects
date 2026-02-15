-- Reinvestment approvals should take effect from the next cycle, not immediately.

alter table public.investor_reinvest_requests
  add column if not exists effective_month text,
  add column if not exists applied boolean not null default false,
  add column if not exists applied_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'investor_reinvest_requests'
      and constraint_name = 'investor_reinvest_effective_month_format'
  ) then
    alter table public.investor_reinvest_requests
      add constraint investor_reinvest_effective_month_format
      check (effective_month is null or effective_month ~ '^\d{4}-\d{2}$');
  end if;
end $$;

create or replace function public.process_investor_reinvest_request(
  p_request_id uuid,
  p_action text default 'approve'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_req record;
  v_investor record;
  v_wallet numeric;
  v_base_month text;
  v_effective_month text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_founder_admin() then
    raise exception 'Not authorized';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'Invalid action';
  end if;

  select id, investor_id, amount, status, deducted_from_wallet, refunded
  into v_req
  from public.investor_reinvest_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found';
  end if;

  if v_req.status <> 'pending' then
    return jsonb_build_object(
      'request_id', v_req.id,
      'status', v_req.status,
      'message', 'Request already processed'
    );
  end if;

  select id, user_id
  into v_investor
  from public.investors
  where id = v_req.investor_id
  for update;

  if v_investor.id is null then
    raise exception 'Investor record not found';
  end if;

  if p_action = 'reject' then
    if v_req.deducted_from_wallet and not v_req.refunded and v_investor.user_id is not null then
      select wallet_balance
      into v_wallet
      from public.profiles
      where id = v_investor.user_id
      for update;

      if v_wallet is null then
        raise exception 'Investor profile not found for refund';
      end if;

      update public.profiles
      set wallet_balance = v_wallet + coalesce(v_req.amount, 0)
      where id = v_investor.user_id;
    end if;

    update public.investor_reinvest_requests
    set status = 'rejected',
        refunded = case when deducted_from_wallet then true else refunded end,
        processed_at = now(),
        processed_by = v_uid
    where id = v_req.id;

    return jsonb_build_object(
      'request_id', v_req.id,
      'status', 'rejected',
      'refunded', (v_req.deducted_from_wallet is true)
    );
  end if;

  select month
  into v_base_month
  from public.monthly_profit_tracker
  order by month desc
  limit 1;

  if v_base_month is null then
    v_base_month := to_char(now(), 'YYYY-MM');
  end if;

  v_effective_month := to_char((to_date(v_base_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date, 'YYYY-MM');

  update public.investor_reinvest_requests
  set status = 'approved',
      processed_at = now(),
      processed_by = v_uid,
      effective_month = v_effective_month,
      applied = false,
      applied_at = null
  where id = v_req.id;

  return jsonb_build_object(
    'request_id', v_req.id,
    'status', 'approved',
    'effective_month', v_effective_month,
    'amount', coalesce(v_req.amount, 0)
  );
end;
$$;

grant execute on function public.process_investor_reinvest_request(uuid, text) to authenticated;

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
  r record;
  v_calc_payout numeric;
  v_inserted_amount numeric;
  v_wallet numeric;
begin
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month format (expected YYYY-MM): %', p_month;
  end if;

  perform pg_advisory_xact_lock(hashtext('investor_payout_' || p_month));

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

  select m.net_profit, coalesce(m.investor_pool_percent, 0.20)
  into v_net_profit, v_percent
  from public.monthly_profit_tracker m
  where m.month = p_month;

  if v_net_profit is null then
    raise exception 'No monthly_profit_tracker row for %', p_month;
  end if;

  v_pool := greatest(0, v_net_profit * v_percent);

  select coalesce(sum(i.contribution), 0)
  into v_total_contrib
  from public.investors i
  where i.status = 'approved';

  if v_pool = 0 or v_total_contrib = 0 then
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

  return;
end;
$$;

grant execute on function public.distribute_investor_payouts(text, boolean) to authenticated;
