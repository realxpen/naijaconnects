-- Reinvest should come from wallet balance (locked immediately), and
-- withdrawal/reinvest requests should not be blocked by month-open lock.

alter table public.investor_reinvest_requests
  add column if not exists deducted_from_wallet boolean not null default false,
  add column if not exists refunded boolean not null default false;

-- Remove month-open lock trigger for reinvest requests.
drop trigger if exists trg_block_reinvest_when_month_open on public.investor_reinvest_requests;
drop function if exists public.block_reinvest_when_month_open();

-- Investor-side RPC: deduct wallet immediately and create pending reinvest request.
create or replace function public.request_reinvest_from_wallet(
  p_amount numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_wallet numeric;
  v_investor_id uuid;
  v_request_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  select id
  into v_investor_id
  from public.investors
  where user_id = v_uid
    and status = 'approved'
  order by created_at desc
  limit 1
  for update;

  if v_investor_id is null then
    raise exception 'No approved investor profile for this account';
  end if;

  select wallet_balance
  into v_wallet
  from public.profiles
  where id = v_uid
  for update;

  if v_wallet is null then
    raise exception 'Profile not found';
  end if;
  if v_wallet < p_amount then
    raise exception 'Insufficient wallet balance';
  end if;

  update public.profiles
  set wallet_balance = v_wallet - p_amount
  where id = v_uid;

  insert into public.investor_reinvest_requests (
    investor_id,
    amount,
    status,
    deducted_from_wallet,
    refunded
  ) values (
    v_investor_id,
    p_amount,
    'pending',
    true,
    false
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.request_reinvest_from_wallet(numeric) to authenticated;

-- Founder/Admin processing: approve applies contribution; reject refunds wallet if deducted.
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
  v_current_contribution numeric;
  v_new_contribution numeric;
  v_wallet numeric;
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

  select id, user_id, contribution
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

  v_current_contribution := coalesce(v_investor.contribution, 0);
  v_new_contribution := v_current_contribution + coalesce(v_req.amount, 0);

  update public.investors
  set contribution = v_new_contribution,
      max_return = v_new_contribution * 1.5
  where id = v_req.investor_id;

  update public.investor_reinvest_requests
  set status = 'approved',
      processed_at = now(),
      processed_by = v_uid
  where id = v_req.id;

  return jsonb_build_object(
    'request_id', v_req.id,
    'status', 'approved',
    'new_contribution', v_new_contribution,
    'new_max_return', v_new_contribution * 1.5
  );
end;
$$;

grant execute on function public.process_investor_reinvest_request(uuid, text) to authenticated;

-- Remove month-open lock from secure withdrawal request RPC.
create or replace function public.request_withdrawal_secure(
  p_amount numeric,
  p_bank_code text,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_fee numeric default 0,
  p_reference text default null,
  p_category text default null,
  p_deduct_immediately boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_wallet_balance numeric;
  v_total_deducted numeric;
  v_reference text;
  v_email text;
  v_tx_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid amount';
  end if;
  if coalesce(trim(p_account_number), '') = '' or coalesce(trim(p_account_name), '') = '' then
    raise exception 'Missing account details';
  end if;
  if p_fee is null or p_fee < 0 then
    raise exception 'Invalid fee';
  end if;

  v_total_deducted := p_amount + p_fee;

  select wallet_balance, email
  into v_wallet_balance, v_email
  from public.profiles
  where id = v_user_id
  for update;

  if v_wallet_balance is null then
    raise exception 'Profile not found';
  end if;
  if v_wallet_balance < v_total_deducted then
    raise exception 'Insufficient balance';
  end if;

  if p_deduct_immediately then
    update public.profiles
    set wallet_balance = v_wallet_balance - v_total_deducted
    where id = v_user_id;
  end if;

  v_reference := coalesce(nullif(trim(p_reference), ''), 'WD-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::int);

  insert into public.transactions (
    user_id,
    user_email,
    type,
    amount,
    status,
    reference,
    meta,
    description
  ) values (
    v_user_id,
    v_email,
    'withdrawal',
    p_amount,
    'pending',
    v_reference,
    jsonb_build_object(
      'bank_code', p_bank_code,
      'bank_name', p_bank_name,
      'account_number', p_account_number,
      'account_name', p_account_name,
      'fee', p_fee,
      'total_deducted', v_total_deducted,
      'category', p_category,
      'wallet_deducted', p_deduct_immediately
    ),
    'Withdrawal request'
  )
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

-- Distribute payouts and also credit investor wallet balance.
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
