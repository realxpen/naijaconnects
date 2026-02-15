-- Founder/Admin workflow for reinvestment requests:
-- approve/reject in one transaction-safe RPC.

alter table public.investor_reinvest_requests
  add column if not exists processed_at timestamptz,
  add column if not exists processed_by uuid references auth.users(id) on delete set null;

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
  v_current_contribution numeric;
  v_new_contribution numeric;
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

  select id, investor_id, amount, status
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

  if p_action = 'reject' then
    update public.investor_reinvest_requests
    set status = 'rejected',
        processed_at = now(),
        processed_by = v_uid
    where id = v_req.id;

    return jsonb_build_object(
      'request_id', v_req.id,
      'status', 'rejected'
    );
  end if;

  select contribution
  into v_current_contribution
  from public.investors
  where id = v_req.investor_id
  for update;

  if v_current_contribution is null then
    raise exception 'Investor record not found';
  end if;

  v_new_contribution := coalesce(v_current_contribution, 0) + coalesce(v_req.amount, 0);

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
