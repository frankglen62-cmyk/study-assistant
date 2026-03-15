set search_path = public, extensions;

create or replace function public.apply_wallet_seconds(
  p_user_id uuid,
  p_delta_seconds integer,
  p_transaction_type public.credit_transaction_type,
  p_description text default '',
  p_related_payment_id uuid default null,
  p_related_session_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns table(
  wallet_id uuid,
  remaining_seconds integer,
  lifetime_seconds_purchased integer,
  lifetime_seconds_used integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_wallet public.wallets%rowtype;
  next_remaining integer;
  purchased_increment integer := 0;
  used_increment integer := 0;
begin
  select *
    into current_wallet
    from public.wallets
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  next_remaining := current_wallet.remaining_seconds + p_delta_seconds;
  if next_remaining < 0 then
    raise exception 'insufficient credits for user %', p_user_id;
  end if;

  if p_transaction_type in ('purchase', 'admin_adjustment_add', 'promo', 'restoration') and p_delta_seconds > 0 then
    purchased_increment := p_delta_seconds;
  end if;

  if p_transaction_type = 'usage_debit' and p_delta_seconds < 0 then
    used_increment := abs(p_delta_seconds);
  end if;

  update public.wallets as w
     set remaining_seconds = next_remaining,
         lifetime_seconds_purchased = current_wallet.lifetime_seconds_purchased + purchased_increment,
         lifetime_seconds_used = current_wallet.lifetime_seconds_used + used_increment,
         updated_at = now()
   where id = current_wallet.id
  returning w.id,
            w.remaining_seconds,
            w.lifetime_seconds_purchased,
            w.lifetime_seconds_used
    into wallet_id,
         remaining_seconds,
         lifetime_seconds_purchased,
         lifetime_seconds_used;

  insert into public.credit_transactions (
    user_id,
    wallet_id,
    transaction_type,
    delta_seconds,
    balance_after_seconds,
    related_payment_id,
    related_session_id,
    description,
    metadata,
    created_by
  )
  values (
    p_user_id,
    current_wallet.id,
    p_transaction_type,
    p_delta_seconds,
    remaining_seconds,
    p_related_payment_id,
    p_related_session_id,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  );

  return next;
end;
$$;

grant execute on function public.apply_wallet_seconds(
  uuid,
  integer,
  public.credit_transaction_type,
  text,
  uuid,
  uuid,
  jsonb,
  uuid
) to service_role;

create or replace function public.apply_payment_credit_once(
  p_payment_id uuid,
  p_provider_payment_id text default null,
  p_paid_at timestamptz default now(),
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table(
  wallet_id uuid,
  remaining_seconds integer,
  lifetime_seconds_purchased integer,
  lifetime_seconds_used integer,
  payment_status public.payment_status,
  credited boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_row public.payments%rowtype;
  package_row public.payment_packages%rowtype;
  current_wallet public.wallets%rowtype;
  next_remaining integer;
begin
  select *
    into payment_row
    from public.payments
   where id = p_payment_id
   for update;

  if not found then
    raise exception 'payment not found for id %', p_payment_id;
  end if;

  select *
    into current_wallet
    from public.wallets
   where user_id = payment_row.user_id
   for update;

  if not found then
    raise exception 'wallet not found for payment %', p_payment_id;
  end if;

  if payment_row.status = 'paid' then
    wallet_id := current_wallet.id;
    remaining_seconds := current_wallet.remaining_seconds;
    lifetime_seconds_purchased := current_wallet.lifetime_seconds_purchased;
    lifetime_seconds_used := current_wallet.lifetime_seconds_used;
    payment_status := payment_row.status;
    credited := false;
    return next;
  end if;

  if payment_row.status <> 'pending' then
    raise exception 'payment % is not pending', p_payment_id;
  end if;

  if payment_row.package_id is null then
    raise exception 'payment % does not reference a package', p_payment_id;
  end if;

  select *
    into package_row
    from public.payment_packages
   where id = payment_row.package_id;

  if not found then
    raise exception 'payment package not found for payment %', p_payment_id;
  end if;

  next_remaining := current_wallet.remaining_seconds + package_row.seconds_to_credit;

  update public.wallets as w
     set remaining_seconds = next_remaining,
         lifetime_seconds_purchased = current_wallet.lifetime_seconds_purchased + package_row.seconds_to_credit,
         updated_at = now()
   where id = current_wallet.id
  returning w.id,
            w.remaining_seconds,
            w.lifetime_seconds_purchased,
            w.lifetime_seconds_used
    into wallet_id,
         remaining_seconds,
         lifetime_seconds_purchased,
         lifetime_seconds_used;

  insert into public.credit_transactions (
    user_id,
    wallet_id,
    transaction_type,
    delta_seconds,
    balance_after_seconds,
    related_payment_id,
    description,
    metadata,
    created_by
  )
  values (
    payment_row.user_id,
    wallet_id,
    'purchase',
    package_row.seconds_to_credit,
    remaining_seconds,
    payment_row.id,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  );

  update public.payments
     set status = 'paid',
         paid_at = coalesce(p_paid_at, now()),
         provider_payment_id = coalesce(nullif(p_provider_payment_id, ''), payment_row.provider_payment_id),
         raw_payload = coalesce(payment_row.raw_payload, '{}'::jsonb) || coalesce(p_raw_payload, '{}'::jsonb),
         updated_at = now()
   where id = payment_row.id;

  payment_status := 'paid';
  credited := true;
  return next;
end;
$$;

grant execute on function public.apply_payment_credit_once(
  uuid,
  text,
  timestamptz,
  text,
  jsonb,
  uuid,
  jsonb
) to service_role;
