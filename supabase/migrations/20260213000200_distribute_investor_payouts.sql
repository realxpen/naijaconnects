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
as $$
declare
  v_pool numeric;
  v_total_contrib numeric;
  v_percent numeric;
  v_net_profit numeric;
begin
  if p_month is null or p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Invalid month format (expected YYYY-MM): %', p_month;
  end if;

  -- One distribution per month at a time
  perform pg_advisory_xact_lock(hashtext('investor_payout_' || p_month));

  select
    net_profit,
    coalesce(investor_pool_percent, 0.20)
  into
    v_net_profit,
    v_percent
  from public.monthly_profit_tracker
  where month = p_month;

  if v_net_profit is null then
    raise exception 'No monthly_profit_tracker row for %', p_month;
  end if;

  v_pool := greatest(0, v_net_profit * v_percent);

  select coalesce(sum(contribution), 0)
  into v_total_contrib
  from public.investors
  where status = 'approved';

  if v_pool = 0 or v_total_contrib = 0 then
    return;
  end if;

  if p_apply then
    with eligible as (
      select
        i.id as investor_id,
        i.contribution,
        coalesce(i.max_return, i.contribution * 1.5) as max_return,
        coalesce(i.total_received, 0) as total_received
      from public.investors i
      where i.status = 'approved'
    ),
    calc as (
      select
        e.investor_id,
        least((e.contribution / v_total_contrib) * v_pool, greatest(0, e.max_return - e.total_received)) as payout,
        greatest(0, e.max_return - e.total_received) as remaining_cap
      from eligible e
    ),
    final as (
      select c.*
      from calc c
      left join public.investor_payouts p
        on p.investor_id = c.investor_id and p.month = p_month
      where c.payout > 0 and p.investor_id is null
    ),
    ins as (
      insert into public.investor_payouts (investor_id, month, amount)
      select investor_id, p_month, payout
      from final
      on conflict (investor_id, month) do nothing
      returning investor_id, amount
    )
    update public.investors i
      set total_received = coalesce(i.total_received, 0) + ins.amount
    from ins
    where i.id = ins.investor_id;
  end if;

  return query
  with eligible as (
    select
      i.id as investor_id,
      i.contribution,
      coalesce(i.max_return, i.contribution * 1.5) as max_return,
      coalesce(i.total_received, 0) as total_received
    from public.investors i
    where i.status = 'approved'
  ),
  calc as (
    select
      e.investor_id,
      least((e.contribution / v_total_contrib) * v_pool, greatest(0, e.max_return - e.total_received)) as payout,
      greatest(0, e.max_return - e.total_received) as remaining_cap
    from eligible e
  ),
  final as (
    select c.*
    from calc c
    left join public.investor_payouts p
      on p.investor_id = c.investor_id and p.month = p_month
    where c.payout > 0 and p.investor_id is null
  )
  select investor_id, payout, remaining_cap
  from final
  order by payout desc;
end;
$$;
