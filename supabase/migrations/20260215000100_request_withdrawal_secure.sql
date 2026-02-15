-- Secure investor/user withdrawal request:
-- atomically deduct wallet balance and create pending withdrawal transaction.
create or replace function public.request_withdrawal_secure(
  p_amount numeric,
  p_bank_code text,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_fee numeric default 0,
  p_reference text default null,
  p_category text default null
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

  update public.profiles
    set wallet_balance = v_wallet_balance - v_total_deducted
  where id = v_user_id;

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
      'category', p_category
    ),
    'Withdrawal request'
  )
  returning id into v_tx_id;

  return v_tx_id;
end;
$$;

grant execute on function public.request_withdrawal_secure(
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  text,
  text
) to authenticated;
