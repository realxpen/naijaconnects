-- Tables for profit tracking, investors, payouts, reinvestment, and equity allocations
create extension if not exists pgcrypto;

create table if not exists public.monthly_profit_tracker (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  total_revenue numeric(14,2) not null default 0,
  expenses numeric(14,2) not null default 0,
  net_profit numeric(14,2) not null default 0,
  investor_pool_percent numeric(5,4) not null default 0.20,
  created_at timestamptz not null default now(),
  constraint month_format check (month ~ '^\d{4}-\d{2}$'),
  constraint pool_percent_range check (investor_pool_percent >= 0 and investor_pool_percent <= 1)
);

create table if not exists public.investors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text,
  email text,
  contribution numeric(14,2) not null default 0,
  total_received numeric(14,2) not null default 0,
  max_return numeric(14,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint investor_status check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.investor_payouts (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  month text not null,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  constraint payout_month_format check (month ~ '^\d{4}-\d{2}$'),
  constraint payout_unique unique (investor_id, month)
);

create table if not exists public.investor_reinvest_requests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.investors(id) on delete cascade,
  amount numeric(14,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reinvest_status check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.equity_allocations (
  id uuid primary key default gen_random_uuid(),
  recipient_name text not null,
  recipient_role text not null,
  total_equity numeric(6,3) not null default 0,
  start_date date not null,
  cliff_months int not null default 12,
  vesting_months int not null default 48,
  created_at timestamptz not null default now(),
  constraint equity_role check (recipient_role in ('employee', 'advisor', 'investor', 'treasury')),
  constraint equity_nonnegative check (total_equity >= 0),
  constraint vesting_valid check (vesting_months >= cliff_months and cliff_months >= 0)
);
