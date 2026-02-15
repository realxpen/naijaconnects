-- Allow founder/ceo allocations in equity_allocations recipient_role.
alter table public.equity_allocations
  drop constraint if exists equity_role;

alter table public.equity_allocations
  add constraint equity_role
  check (recipient_role in ('founder', 'ceo', 'employee', 'advisor', 'investor', 'treasury'));
