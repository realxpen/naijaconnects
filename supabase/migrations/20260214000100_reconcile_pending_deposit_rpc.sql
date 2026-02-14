-- Founder/Admin RPC: reconcile a pending/success deposit and credit wallet safely
create or replace function public.reconcile_deposit_reference(
  p_reference text,
  p_credit_if_success boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_tx record;
  v_meta jsonb;
  v_status text;
  v_profile_id uuid;
  v_balance numeric;
  v_new_balance numeric;
  v_credited boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_founder_admin() then
    raise exception 'Not authorized';
  end if;

  if coalesce(trim(p_reference), '') = '' then
    raise exception 'Reference is required';
  end if;

  select id, reference, user_id, user_email, amount, status, meta
  into v_tx
  from public.transactions
  where reference = p_reference
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;

  v_meta := coalesce(v_tx.meta::jsonb, '{}'::jsonb);
  v_status := lower(coalesce(v_tx.status, ''));
  v_credited := coalesce((v_meta->>'balance_credited')::boolean, false);

  if v_status = 'failed' then
    return jsonb_build_object(
      'reference', v_tx.reference,
      'status', 'failed',
      'credited', v_credited,
      'message', 'Cannot reconcile a failed transaction'
    );
  end if;

  if v_status <> 'success' then
    update public.transactions
      set status = 'success',
          updated_at = now(),
          meta = v_meta || jsonb_build_object('reconciled_status_at', now(), 'reconciled_by', v_uid)
    where id = v_tx.id;
    v_status := 'success';
    v_meta := v_meta || jsonb_build_object('reconciled_status_at', now(), 'reconciled_by', v_uid);
  end if;

  if not p_credit_if_success then
    return jsonb_build_object(
      'reference', v_tx.reference,
      'status', v_status,
      'credited', v_credited,
      'wallet_balance', null
    );
  end if;

  if v_credited then
    return jsonb_build_object(
      'reference', v_tx.reference,
      'status', v_status,
      'credited', true,
      'wallet_balance', null,
      'message', 'Already credited'
    );
  end if;

  select id, wallet_balance
  into v_profile_id, v_balance
  from public.profiles
  where id = v_tx.user_id
  for update;

  if v_profile_id is null and v_tx.user_email is not null then
    select id, wallet_balance
    into v_profile_id, v_balance
    from public.profiles
    where email = v_tx.user_email
    order by id
    limit 1
    for update;
  end if;

  if v_profile_id is null and v_tx.user_id is not null then
    insert into public.profiles (id, email, wallet_balance)
    values (v_tx.user_id, v_tx.user_email, 0)
    on conflict (id) do update
      set email = coalesce(public.profiles.email, excluded.email)
    returning id, wallet_balance into v_profile_id, v_balance;
  end if;

  if v_profile_id is null then
    raise exception 'Profile not found for this transaction';
  end if;

  v_new_balance := coalesce(v_balance, 0) + coalesce(v_tx.amount, 0);

  update public.profiles
    set wallet_balance = v_new_balance
  where id = v_profile_id;

  update public.transactions
    set meta = v_meta || jsonb_build_object(
      'balance_credited', true,
      'balance_credited_at', now(),
      'reconciled_credit_by', v_uid,
      'reconciled_credit_at', now()
    ),
    updated_at = now()
  where id = v_tx.id;

  return jsonb_build_object(
    'reference', v_tx.reference,
    'status', 'success',
    'credited', true,
    'wallet_balance', v_new_balance
  );
end;
$$;

grant execute on function public.reconcile_deposit_reference(text, boolean) to authenticated;
