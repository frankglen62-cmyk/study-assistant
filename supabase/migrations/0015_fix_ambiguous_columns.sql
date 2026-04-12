-- 0015: Fix ambiguous column references in all wallet/maintenance PL/pgSQL functions.
-- The RETURNS TABLE(...) output columns clash with identically named table columns.
-- Solution: Use #variable_conflict use_column so table columns win inside queries,
-- and explicitly assign to output variables only by name.
set search_path = public, extensions;

-- ============================================================
-- expire_wallet_grants_for_user
-- ============================================================
create or replace function public.expire_wallet_grants_for_user(
  p_user_id uuid,
  p_now timestamptz default now()
)
returns table(
  wallet_id uuid,
  expired_seconds integer,
  remaining_seconds integer,
  expired_grant_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  current_wallet public.wallets%rowtype;
  v_expired_seconds integer := 0;
  v_expired_grant_count integer := 0;
  v_next_remaining integer;
begin
  select *
    into current_wallet
    from public.wallets w
   where w.user_id = p_user_id
   for update;

  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  with expired_rows as (
    select wg.id, wg.remaining_seconds
      from public.wallet_grants wg
     where wg.user_id = p_user_id
       and wg.remaining_seconds > 0
       and wg.expired_at is null
       and wg.expires_at is not null
       and wg.expires_at <= p_now
     for update
  ),
  updated_rows as (
    update public.wallet_grants as wg
       set remaining_seconds = 0,
           expired_at = coalesce(wg.expired_at, p_now),
           depleted_at = coalesce(wg.depleted_at, p_now),
           updated_at = p_now
      from expired_rows as er
     where wg.id = er.id
     returning er.remaining_seconds as grant_remaining
  )
  select coalesce(sum(grant_remaining), 0)::integer, count(*)::integer
    into v_expired_seconds, v_expired_grant_count
    from updated_rows;

  if v_expired_seconds > 0 then
    v_next_remaining := greatest(0, current_wallet.remaining_seconds - v_expired_seconds);

    update public.wallets w2
       set remaining_seconds = v_next_remaining,
           updated_at = p_now
     where w2.id = current_wallet.id;

    insert into public.credit_transactions (
      user_id,
      wallet_id,
      transaction_type,
      delta_seconds,
      balance_after_seconds,
      description,
      metadata
    )
    values (
      p_user_id,
      current_wallet.id,
      'expiration',
      v_expired_seconds * -1,
      v_next_remaining,
      'Expired credits removed from wallet.',
      jsonb_build_object(
        'source',
        'wallet_grant_expiration',
        'expiredGrantCount',
        v_expired_grant_count
      )
    );
  else
    v_next_remaining := current_wallet.remaining_seconds;
  end if;

  -- Assign to output columns
  wallet_id := current_wallet.id;
  expired_seconds := v_expired_seconds;
  remaining_seconds := v_next_remaining;
  expired_grant_count := v_expired_grant_count;
  return next;
end;
$$;

-- ============================================================
-- process_expired_wallet_grants
-- ============================================================
create or replace function public.process_expired_wallet_grants(
  p_limit integer default 200,
  p_now timestamptz default now()
)
returns table(
  user_id uuid,
  wallet_id uuid,
  expired_seconds integer,
  remaining_seconds integer,
  expired_grant_count integer
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target record;
  expiration_result record;
begin
  for target in
    select wg.user_id
      from public.wallet_grants wg
     where wg.remaining_seconds > 0
       and wg.expired_at is null
       and wg.expires_at is not null
       and wg.expires_at <= p_now
     group by wg.user_id
     order by min(wg.expires_at) asc
     limit greatest(coalesce(p_limit, 200), 1)
  loop
    select *
      into expiration_result
      from public.expire_wallet_grants_for_user(target.user_id, p_now);

    if coalesce(expiration_result.expired_seconds, 0) > 0 then
      user_id := target.user_id;
      wallet_id := expiration_result.wallet_id;
      expired_seconds := expiration_result.expired_seconds;
      remaining_seconds := expiration_result.remaining_seconds;
      expired_grant_count := expiration_result.expired_grant_count;
      return next;
    end if;
  end loop;
end;
$$;

-- ============================================================
-- restore_elapsed_suspensions
-- ============================================================
create or replace function public.restore_elapsed_suspensions(
  p_limit integer default 200,
  p_now timestamptz default now()
)
returns table(
  user_id uuid,
  email text,
  previous_reason text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  target record;
begin
  for target in
    select p.id, p.email, p.status_reason
      from public.profiles p
     where p.account_status = 'suspended'
       and p.suspended_until is not null
       and p.suspended_until <= p_now
     order by p.suspended_until asc
     limit greatest(coalesce(p_limit, 200), 1)
     for update
  loop
    update public.profiles
       set account_status = 'active',
           suspended_until = null,
           status_reason = 'Automatic restore after suspension window elapsed.',
           status_changed_at = p_now,
           status_changed_by = null,
           updated_at = p_now
     where id = target.id;

    update public.wallets
       set status = 'active',
           updated_at = p_now
     where wallets.user_id = target.id;

    user_id := target.id;
    email := target.email;
    previous_reason := target.status_reason;
    return next;
  end loop;
end;
$$;

-- ============================================================
-- apply_wallet_seconds
-- ============================================================
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
#variable_conflict use_column
declare
  current_wallet public.wallets%rowtype;
  v_next_remaining integer;
  v_purchased_increment integer := 0;
  v_used_increment integer := 0;
  v_transaction_id uuid;
  v_grant_expires_at timestamptz := null;
begin
  perform *
    from public.expire_wallet_grants_for_user(p_user_id, now());

  select *
    into current_wallet
    from public.wallets w
   where w.user_id = p_user_id
   for update;

  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  v_next_remaining := current_wallet.remaining_seconds + p_delta_seconds;
  if v_next_remaining < 0 then
    raise exception 'insufficient credits for user %', p_user_id;
  end if;

  if p_delta_seconds > 0 and p_transaction_type in ('purchase', 'admin_adjustment_add', 'promo', 'restoration') then
    v_purchased_increment := p_delta_seconds;
    if coalesce(p_metadata, '{}'::jsonb) ? 'expiresAt'
      and nullif(trim(coalesce(p_metadata ->> 'expiresAt', '')), '') is not null then
      v_grant_expires_at := (p_metadata ->> 'expiresAt')::timestamptz;
    end if;
  end if;

  if p_transaction_type = 'usage_debit' and p_delta_seconds < 0 then
    v_used_increment := abs(p_delta_seconds);
  end if;

  if p_delta_seconds < 0 then
    perform public.consume_wallet_grants_for_user(p_user_id, abs(p_delta_seconds), now());
  end if;

  update public.wallets w2
     set remaining_seconds = v_next_remaining,
         lifetime_seconds_purchased = current_wallet.lifetime_seconds_purchased + v_purchased_increment,
         lifetime_seconds_used = current_wallet.lifetime_seconds_used + v_used_increment,
         updated_at = now()
   where w2.id = current_wallet.id;

  -- Assign output columns
  wallet_id := current_wallet.id;
  remaining_seconds := v_next_remaining;
  lifetime_seconds_purchased := current_wallet.lifetime_seconds_purchased + v_purchased_increment;
  lifetime_seconds_used := current_wallet.lifetime_seconds_used + v_used_increment;

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
    v_next_remaining,
    p_related_payment_id,
    p_related_session_id,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning id into v_transaction_id;

  if p_delta_seconds > 0 and p_transaction_type in ('purchase', 'admin_adjustment_add', 'promo', 'restoration') then
    perform public.insert_wallet_grant(
      p_user_id,
      current_wallet.id,
      v_transaction_id,
      p_transaction_type,
      p_delta_seconds,
      v_grant_expires_at,
      p_description,
      p_metadata,
      p_created_by
    );
  end if;

  return next;
end;
$$;

-- ============================================================
-- apply_payment_credit_once
-- ============================================================
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
#variable_conflict use_column
declare
  payment_row public.payments%rowtype;
  package_row public.payment_packages%rowtype;
  current_wallet public.wallets%rowtype;
  v_next_remaining integer;
  v_grant_expires_at timestamptz := null;
  v_transaction_id uuid;
begin
  select *
    into payment_row
    from public.payments
   where payments.id = p_payment_id
   for update;

  if not found then
    raise exception 'payment not found for id %', p_payment_id;
  end if;

  perform *
    from public.expire_wallet_grants_for_user(payment_row.user_id, coalesce(p_paid_at, now()));

  select *
    into current_wallet
    from public.wallets w
   where w.user_id = payment_row.user_id
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
    return;  -- exit early
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
   where payment_packages.id = payment_row.package_id;

  if not found then
    raise exception 'payment package not found for payment %', p_payment_id;
  end if;

  if package_row.credit_expires_after_days is not null then
    v_grant_expires_at := coalesce(p_paid_at, now()) + make_interval(days => package_row.credit_expires_after_days);
  end if;

  v_next_remaining := current_wallet.remaining_seconds + package_row.seconds_to_credit;

  update public.wallets w2
     set remaining_seconds = v_next_remaining,
         lifetime_seconds_purchased = current_wallet.lifetime_seconds_purchased + package_row.seconds_to_credit,
         updated_at = now()
   where w2.id = current_wallet.id;

  -- Assign output columns
  wallet_id := current_wallet.id;
  remaining_seconds := v_next_remaining;
  lifetime_seconds_purchased := current_wallet.lifetime_seconds_purchased + package_row.seconds_to_credit;
  lifetime_seconds_used := current_wallet.lifetime_seconds_used;

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
    current_wallet.id,
    'purchase',
    package_row.seconds_to_credit,
    v_next_remaining,
    payment_row.id,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb) || case
      when v_grant_expires_at is not null then jsonb_build_object('expiresAt', v_grant_expires_at)
      else '{}'::jsonb
    end,
    p_created_by
  )
  returning id into v_transaction_id;

  perform public.insert_wallet_grant(
    payment_row.user_id,
    current_wallet.id,
    v_transaction_id,
    'purchase',
    package_row.seconds_to_credit,
    v_grant_expires_at,
    p_description,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'packageCode',
      package_row.code,
      'creditExpiresAfterDays',
      package_row.credit_expires_after_days
    ),
    p_created_by
  );

  update public.payments
     set status = 'paid',
         paid_at = coalesce(p_paid_at, now()),
         provider_payment_id = coalesce(nullif(p_provider_payment_id, ''), payment_row.provider_payment_id),
         raw_payload = coalesce(payment_row.raw_payload, '{}'::jsonb) || coalesce(p_raw_payload, '{}'::jsonb),
         updated_at = now()
   where payments.id = payment_row.id;

  payment_status := 'paid';
  credited := true;
  return next;
end;
$$;

-- ============================================================
-- consume_wallet_grants_for_user (also fix for safety)
-- ============================================================
create or replace function public.consume_wallet_grants_for_user(
  p_user_id uuid,
  p_seconds integer,
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  seconds_left integer := greatest(p_seconds, 0);
  grant_row record;
  consumed integer;
begin
  if seconds_left = 0 then
    return 0;
  end if;

  for grant_row in
    select wg.id, wg.remaining_seconds
      from public.wallet_grants wg
     where wg.user_id = p_user_id
       and wg.remaining_seconds > 0
       and wg.expired_at is null
       and (wg.expires_at is null or wg.expires_at > p_now)
     order by wg.expires_at asc nulls last, wg.created_at asc, wg.id asc
     for update
  loop
    exit when seconds_left <= 0;

    consumed := least(seconds_left, grant_row.remaining_seconds);

    update public.wallet_grants
       set remaining_seconds = wallet_grants.remaining_seconds - consumed,
           depleted_at = case
             when wallet_grants.remaining_seconds - consumed = 0 then coalesce(depleted_at, p_now)
             else depleted_at
           end,
           updated_at = p_now
     where wallet_grants.id = grant_row.id;

    seconds_left := seconds_left - consumed;
  end loop;

  if seconds_left > 0 then
    raise exception 'insufficient wallet grants for user %', p_user_id;
  end if;

  return p_seconds;
end;
$$;
