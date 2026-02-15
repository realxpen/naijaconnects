-- Enforce total equity cap and add transfer/forfeit flows.

create or replace function public._equity_vested_amount(
  p_total_equity numeric,
  p_start_date date,
  p_cliff_months int,
  p_vesting_months int,
  p_as_of date default current_date
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_months int;
  v_cliff int := greatest(0, coalesce(p_cliff_months, 0));
  v_vesting int := greatest(v_cliff, coalesce(p_vesting_months, 0));
  v_vested_months int;
begin
  if p_total_equity is null or p_total_equity <= 0 then
    return 0;
  end if;

  if p_as_of < p_start_date then
    return 0;
  end if;

  v_months :=
    (extract(year from age(p_as_of, p_start_date))::int * 12)
    + extract(month from age(p_as_of, p_start_date))::int;

  if v_months < v_cliff then
    return 0;
  end if;

  if v_vesting <= v_cliff then
    return p_total_equity;
  end if;

  v_vested_months := least(v_vesting - v_cliff, greatest(0, v_months - v_cliff));
  return (p_total_equity * v_vested_months::numeric) / (v_vesting - v_cliff);
end;
$$;

create or replace function public.validate_equity_total_cap()
returns trigger
language plpgsql
as $$
declare
  v_total numeric;
begin
  if coalesce(new.total_equity, 0) < 0 then
    raise exception 'Equity cannot be negative';
  end if;

  select coalesce(sum(e.total_equity), 0)
  into v_total
  from public.equity_allocations e
  where e.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if (v_total + coalesce(new.total_equity, 0)) > 100 then
    raise exception 'Total equity exceeds 100%% (current: %, attempted new total: %)', v_total, v_total + coalesce(new.total_equity, 0);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_equity_total_cap on public.equity_allocations;
create trigger trg_validate_equity_total_cap
before insert or update on public.equity_allocations
for each row
execute function public.validate_equity_total_cap();

create table if not exists public.equity_transfer_events (
  id uuid primary key default gen_random_uuid(),
  source_allocation_id uuid not null references public.equity_allocations(id) on delete cascade,
  target_allocation_id uuid references public.equity_allocations(id) on delete set null,
  transfer_type text not null,
  amount numeric(10,4) not null,
  consideration_amount numeric(14,2),
  agreement_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint equity_transfer_type_chk check (transfer_type in ('gift', 'sale', 'forfeit')),
  constraint equity_transfer_amount_positive check (amount > 0)
);

alter table public.equity_transfer_events enable row level security;

create policy "equity_transfer_events_select_founder_admin"
  on public.equity_transfer_events
  for select
  using (public.is_founder_admin());

create policy "equity_transfer_events_write_founder_admin"
  on public.equity_transfer_events
  for insert
  with check (public.is_founder_admin());

create index if not exists equity_transfer_events_source_created_idx
  on public.equity_transfer_events (source_allocation_id, created_at desc);

create table if not exists public.investor_position_transfers (
  id uuid primary key default gen_random_uuid(),
  from_investor_id uuid not null references public.investors(id) on delete restrict,
  to_investor_id uuid not null references public.investors(id) on delete restrict,
  amount numeric(14,2) not null,
  transferred_total_received numeric(14,2) not null default 0,
  agreement_reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint investor_position_transfer_amount_positive check (amount > 0)
);

alter table public.investor_position_transfers enable row level security;

create policy "investor_position_transfers_select_founder_admin"
  on public.investor_position_transfers
  for select
  using (public.is_founder_admin());

create policy "investor_position_transfers_write_founder_admin"
  on public.investor_position_transfers
  for insert
  with check (public.is_founder_admin());

create index if not exists investor_position_transfers_from_created_idx
  on public.investor_position_transfers (from_investor_id, created_at desc);

create or replace function public.process_equity_transfer(
  p_source_allocation_id uuid,
  p_transfer_type text,
  p_amount numeric,
  p_recipient_name text default null,
  p_recipient_role text default null,
  p_recipient_user_id uuid default null,
  p_recipient_email text default null,
  p_agreement_reference text default null,
  p_consideration_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_source public.equity_allocations%rowtype;
  v_vested numeric;
  v_target_id uuid;
  v_recipient_user_id uuid := p_recipient_user_id;
  v_effective_role text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_founder_admin() then
    raise exception 'Only founder/admin can process equity transfers';
  end if;
  if p_transfer_type not in ('gift', 'sale', 'forfeit') then
    raise exception 'Invalid transfer type';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  select *
  into v_source
  from public.equity_allocations
  where id = p_source_allocation_id
  for update;

  if v_source.id is null then
    raise exception 'Source allocation not found';
  end if;

  if p_amount > coalesce(v_source.total_equity, 0) then
    raise exception 'Amount exceeds allocation total';
  end if;

  if p_transfer_type in ('gift', 'sale') then
    v_vested := public._equity_vested_amount(
      v_source.total_equity,
      v_source.start_date,
      v_source.cliff_months,
      v_source.vesting_months,
      current_date
    );

    if p_amount > v_vested then
      raise exception 'Cannot transfer more than vested amount (vested now: %)', v_vested;
    end if;
  end if;

  update public.equity_allocations
  set total_equity = total_equity - p_amount
  where id = v_source.id;

  if p_transfer_type in ('gift', 'sale') then
    if v_recipient_user_id is null and p_recipient_email is not null and btrim(p_recipient_email) <> '' then
      select p.id
      into v_recipient_user_id
      from public.profiles p
      where lower(p.email) = lower(btrim(p_recipient_email))
      limit 1;
    end if;

    v_effective_role := coalesce(nullif(btrim(p_recipient_role), ''), v_source.recipient_role);
    if v_effective_role not in ('employee', 'advisor', 'investor', 'treasury', 'founder', 'ceo') then
      raise exception 'Invalid recipient role';
    end if;

    insert into public.equity_allocations (
      recipient_name,
      recipient_role,
      recipient_user_id,
      total_equity,
      start_date,
      cliff_months,
      vesting_months
    ) values (
      coalesce(nullif(btrim(p_recipient_name), ''), 'Transferred Equity Owner'),
      v_effective_role,
      v_recipient_user_id,
      p_amount,
      current_date,
      0,
      0
    )
    returning id into v_target_id;
  else
    insert into public.equity_allocations (
      recipient_name,
      recipient_role,
      recipient_user_id,
      total_equity,
      start_date,
      cliff_months,
      vesting_months
    ) values (
      'Treasury Reserve (Forfeited)',
      'treasury',
      null,
      p_amount,
      current_date,
      0,
      0
    )
    returning id into v_target_id;
  end if;

  insert into public.equity_transfer_events (
    source_allocation_id,
    target_allocation_id,
    transfer_type,
    amount,
    consideration_amount,
    agreement_reference,
    created_by
  ) values (
    v_source.id,
    v_target_id,
    p_transfer_type,
    p_amount,
    p_consideration_amount,
    nullif(btrim(p_agreement_reference), ''),
    v_uid
  );

  return jsonb_build_object(
    'status', 'ok',
    'source_allocation_id', v_source.id,
    'target_allocation_id', v_target_id,
    'transfer_type', p_transfer_type,
    'amount', p_amount
  );
end;
$$;

grant execute on function public.process_equity_transfer(
  uuid, text, numeric, text, text, uuid, text, text, numeric
) to authenticated;

create or replace function public.transfer_investor_position(
  p_from_investor_id uuid,
  p_amount numeric,
  p_to_email text,
  p_to_name text default null,
  p_agreement_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from public.investors%rowtype;
  v_to public.investors%rowtype;
  v_to_user_id uuid;
  v_ratio numeric;
  v_received_share numeric;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_founder_admin() then
    raise exception 'Only founder/admin can transfer investor positions';
  end if;
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;
  if coalesce(nullif(btrim(p_to_email), ''), '') = '' then
    raise exception 'Acquirer email is required';
  end if;

  select *
  into v_from
  from public.investors
  where id = p_from_investor_id
  for update;

  if v_from.id is null then
    raise exception 'Source investor not found';
  end if;
  if p_amount > coalesce(v_from.contribution, 0) then
    raise exception 'Transfer amount exceeds source investor contribution';
  end if;

  select p.id
  into v_to_user_id
  from public.profiles p
  where lower(p.email) = lower(btrim(p_to_email))
  limit 1;

  select *
  into v_to
  from public.investors i
  where
    (v_to_user_id is not null and i.user_id = v_to_user_id)
    or lower(coalesce(i.email, '')) = lower(btrim(p_to_email))
  order by i.created_at asc
  limit 1
  for update;

  if v_to.id is null then
    insert into public.investors (user_id, name, email, contribution, total_received, max_return, status)
    values (
      v_to_user_id,
      coalesce(nullif(btrim(p_to_name), ''), btrim(p_to_email)),
      btrim(p_to_email),
      0,
      0,
      0,
      'approved'
    )
    returning * into v_to;
  end if;

  v_ratio := p_amount / nullif(v_from.contribution, 0);
  v_received_share := round(coalesce(v_from.total_received, 0) * v_ratio, 2);

  update public.investors
  set contribution = contribution - p_amount,
      total_received = greatest(0, total_received - v_received_share),
      max_return = (contribution - p_amount) * 1.5
  where id = v_from.id;

  update public.investors
  set contribution = coalesce(contribution, 0) + p_amount,
      total_received = coalesce(total_received, 0) + v_received_share,
      max_return = (coalesce(contribution, 0) + p_amount) * 1.5,
      status = 'approved',
      name = coalesce(name, nullif(btrim(p_to_name), ''), btrim(p_to_email)),
      email = coalesce(email, btrim(p_to_email)),
      user_id = coalesce(user_id, v_to_user_id)
  where id = v_to.id;

  insert into public.investor_position_transfers (
    from_investor_id,
    to_investor_id,
    amount,
    transferred_total_received,
    agreement_reference,
    created_by
  ) values (
    v_from.id,
    v_to.id,
    p_amount,
    v_received_share,
    nullif(btrim(p_agreement_reference), ''),
    v_uid
  );

  return jsonb_build_object(
    'status', 'ok',
    'from_investor_id', v_from.id,
    'to_investor_id', v_to.id,
    'amount', p_amount,
    'transferred_total_received', v_received_share
  );
end;
$$;

grant execute on function public.transfer_investor_position(
  uuid, numeric, text, text, text
) to authenticated;
