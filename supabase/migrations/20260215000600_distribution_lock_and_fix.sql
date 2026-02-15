-- Track whether a month has been distributed and enforce request lock until distribution.

alter table public.monthly_profit_tracker
  add column if not exists is_distributed boolean not null default false,
  add column if not exists distributed_at timestamptz;

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_founder_admin() then
    raise exception 'Not authorized';
  end if;

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
    if p_apply then
      update public.monthly_profit_tracker
      set is_distributed = true,
          distributed_at = now()
      where month = p_month;
    end if;
    return;
  end if;

  if p_apply then
    return query
    with eligible as (
      select
        i.id as inv_id,
        i.contribution,
        coalesce(i.max_return, i.contribution * 1.5) as max_return,
        coalesce(i.total_received, 0) as total_received
      from public.investors i
      where i.status = 'approved'
    ),
    calc as (
      select
        e.inv_id,
        least((e.contribution / v_total_contrib) * v_pool, greatest(0, e.max_return - e.total_received)) as calc_payout
      from eligible e
    ),
    final as (
      select c.inv_id, c.calc_payout
      from calc c
      left join public.investor_payouts ip
        on ip.investor_id = c.inv_id and ip.month = p_month
      where c.calc_payout > 0 and ip.investor_id is null
    ),
    ins as (
      insert into public.investor_payouts (investor_id, month, amount)
      select f.inv_id, p_month, f.calc_payout
      from final f
      on conflict (investor_id, month) do nothing
      returning investor_id, amount
    ),
    upd as (
      update public.investors i
      set total_received = coalesce(i.total_received, 0) + ins.amount
      from ins
      where i.id = ins.investor_id
      returning i.id, i.max_return, i.total_received
    )
    select
      ins.investor_id as investor_id,
      ins.amount as payout,
      greatest(0, coalesce(upd.max_return, 0) - coalesce(upd.total_received, 0)) as remaining_cap
    from ins
    left join upd on upd.id = ins.investor_id
    order by ins.amount desc;

    update public.monthly_profit_tracker
    set is_distributed = true,
        distributed_at = now()
    where month = p_month;

    return;
  end if;

  return query
  with eligible as (
    select
      i.id as inv_id,
      i.contribution,
      coalesce(i.max_return, i.contribution * 1.5) as max_return,
      coalesce(i.total_received, 0) as total_received
    from public.investors i
    where i.status = 'approved'
  ),
  calc as (
    select
      e.inv_id,
      least((e.contribution / v_total_contrib) * v_pool, greatest(0, e.max_return - e.total_received)) as calc_payout,
      greatest(0, e.max_return - e.total_received) as calc_remaining_cap
    from eligible e
  )
  select
    c.inv_id as investor_id,
    c.calc_payout as payout,
    c.calc_remaining_cap as remaining_cap
  from calc c
  where c.calc_payout > 0
  order by c.calc_payout desc;
end;
$$;

-- Guard: no new reinvest request while latest month is not distributed.
create or replace function public.block_reinvest_when_month_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest record;
begin
  select month, is_distributed
  into v_latest
  from public.monthly_profit_tracker
  order by month desc
  limit 1;

  if v_latest.month is not null and coalesce(v_latest.is_distributed, false) = false then
    raise exception 'Reinvestment requests are locked until month % is closed and distributed', v_latest.month;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_reinvest_when_month_open on public.investor_reinvest_requests;
create trigger trg_block_reinvest_when_month_open
before insert on public.investor_reinvest_requests
for each row
execute function public.block_reinvest_when_month_open();

-- Keep secure withdrawal aligned with same lock.
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
  v_latest_month text;
  v_latest_distributed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select month, is_distributed
  into v_latest_month, v_latest_distributed
  from public.monthly_profit_tracker
  order by month desc
  limit 1;

  if v_latest_month is not null and coalesce(v_latest_distributed, false) = false then
    raise exception 'Withdrawal requests are locked until month % is closed and distributed', v_latest_month;
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
