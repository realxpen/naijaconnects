-- RLS policies and indexes

-- Helper: founder/admin check via profiles.role
create or replace function public.is_founder_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'founder', 'ceo')
  );
$$;

-- Enable RLS
alter table public.monthly_profit_tracker enable row level security;
alter table public.investors enable row level security;
alter table public.investor_payouts enable row level security;
alter table public.investor_reinvest_requests enable row level security;
alter table public.equity_allocations enable row level security;

-- Monthly Profit Tracker (founder/admin only)
create policy "monthly_profit_select_founder_admin"
  on public.monthly_profit_tracker
  for select
  using (public.is_founder_admin());

create policy "monthly_profit_write_founder_admin"
  on public.monthly_profit_tracker
  for insert
  with check (public.is_founder_admin());

create policy "monthly_profit_update_founder_admin"
  on public.monthly_profit_tracker
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Investors
create policy "investors_select_own_or_founder"
  on public.investors
  for select
  using (
    public.is_founder_admin()
    or user_id = auth.uid()
  );

create policy "investors_write_founder_admin"
  on public.investors
  for insert
  with check (public.is_founder_admin());

create policy "investors_update_founder_admin"
  on public.investors
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Investor Payouts
create policy "investor_payouts_select_own_or_founder"
  on public.investor_payouts
  for select
  using (
    public.is_founder_admin()
    or exists (
      select 1
      from public.investors i
      where i.id = investor_id
        and i.user_id = auth.uid()
    )
  );

create policy "investor_payouts_write_founder_admin"
  on public.investor_payouts
  for insert
  with check (public.is_founder_admin());

create policy "investor_payouts_update_founder_admin"
  on public.investor_payouts
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Investor Reinvest Requests
create policy "investor_reinvest_select_own_or_founder"
  on public.investor_reinvest_requests
  for select
  using (
    public.is_founder_admin()
    or exists (
      select 1
      from public.investors i
      where i.id = investor_id
        and i.user_id = auth.uid()
    )
  );

create policy "investor_reinvest_insert_own"
  on public.investor_reinvest_requests
  for insert
  with check (
    exists (
      select 1
      from public.investors i
      where i.id = investor_id
        and i.user_id = auth.uid()
    )
  );

create policy "investor_reinvest_update_founder_admin"
  on public.investor_reinvest_requests
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Equity Allocations (founder/admin only)
create policy "equity_allocations_select_founder_admin"
  on public.equity_allocations
  for select
  using (public.is_founder_admin());

create policy "equity_allocations_write_founder_admin"
  on public.equity_allocations
  for insert
  with check (public.is_founder_admin());

create policy "equity_allocations_update_founder_admin"
  on public.equity_allocations
  for update
  using (public.is_founder_admin())
  with check (public.is_founder_admin());

-- Indexes
create index if not exists investor_payouts_investor_id_idx
  on public.investor_payouts (investor_id);

create index if not exists investor_payouts_month_idx
  on public.investor_payouts (month);

create index if not exists investor_payouts_investor_month_idx
  on public.investor_payouts (investor_id, month);

create index if not exists investor_reinvest_requests_investor_id_idx
  on public.investor_reinvest_requests (investor_id);

create index if not exists investor_reinvest_requests_status_created_idx
  on public.investor_reinvest_requests (status, created_at desc);
