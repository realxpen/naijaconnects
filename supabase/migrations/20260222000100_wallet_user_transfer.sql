-- User-to-user wallet transfer (Swifna -> Swifna), atomic and safe.

create or replace function public.transfer_wallet_to_user(
  p_recipient_email text,
  p_amount numeric,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_sender_email text;
  v_sender_balance numeric;
  v_recipient_id uuid;
  v_recipient_email text;
  v_recipient_balance numeric;
  v_amount numeric := round(coalesce(p_amount, 0)::numeric, 2);
  v_ref text := 'SWT-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || substr(md5(random()::text), 1, 6);
begin
  if v_sender_id is null then
    raise exception 'Unauthorized';
  end if;

  if v_amount <= 0 then
    raise exception 'Amount must be greater than zero';
  end if;

  if p_recipient_email is null or btrim(p_recipient_email) = '' then
    raise exception 'Recipient email is required';
  end if;

  -- Lock sender profile row.
  select email, wallet_balance
  into v_sender_email, v_sender_balance
  from public.profiles
  where id = v_sender_id
  for update;

  if v_sender_email is null then
    raise exception 'Sender profile not found';
  end if;

  -- Lock recipient profile row by email.
  select id, email, wallet_balance
  into v_recipient_id, v_recipient_email, v_recipient_balance
  from public.profiles
  where lower(email) = lower(btrim(p_recipient_email))
  for update;

  if v_recipient_id is null then
    raise exception 'Recipient is not a Swifna user';
  end if;

  if v_recipient_id = v_sender_id then
    raise exception 'Cannot transfer to your own account';
  end if;

  if coalesce(v_sender_balance, 0) < v_amount then
    raise exception 'Insufficient wallet balance';
  end if;

  -- Apply ledger updates.
  update public.profiles
  set wallet_balance = coalesce(v_sender_balance, 0) - v_amount
  where id = v_sender_id;

  update public.profiles
  set wallet_balance = coalesce(v_recipient_balance, 0) + v_amount
  where id = v_recipient_id;

  -- Sender transaction (debit).
  insert into public.transactions (
    user_id,
    user_email,
    type,
    amount,
    status,
    reference,
    metadata
  ) values (
    v_sender_id,
    v_sender_email,
    'service',
    v_amount,
    'success',
    v_ref,
    jsonb_build_object(
      'category', 'wallet_transfer_sent',
      'recipient_id', v_recipient_id,
      'recipient_email', v_recipient_email,
      'note', nullif(btrim(coalesce(p_note, '')), ''),
      'direction', 'out'
    )
  );

  -- Recipient transaction (credit).
  insert into public.transactions (
    user_id,
    user_email,
    type,
    amount,
    status,
    reference,
    metadata
  ) values (
    v_recipient_id,
    v_recipient_email,
    'deposit',
    v_amount,
    'success',
    v_ref,
    jsonb_build_object(
      'category', 'wallet_transfer_received',
      'sender_id', v_sender_id,
      'sender_email', v_sender_email,
      'note', nullif(btrim(coalesce(p_note, '')), ''),
      'direction', 'in'
    )
  );

  return jsonb_build_object(
    'reference', v_ref,
    'sender_balance_after', coalesce(v_sender_balance, 0) - v_amount,
    'recipient_email', v_recipient_email,
    'amount', v_amount
  );
end;
$$;

grant execute on function public.transfer_wallet_to_user(text, numeric, text) to authenticated;

