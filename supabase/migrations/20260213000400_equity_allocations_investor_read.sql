-- Add recipient_user_id for targeted investor reads
alter table public.equity_allocations
  add column if not exists recipient_user_id uuid references auth.users(id) on delete set null;

-- Limited read policy for investors (self only)
create policy "equity_allocations_select_investor_self"
  on public.equity_allocations
  for select
  using (
    public.is_founder_admin()
    or (recipient_user_id = auth.uid())
  );
