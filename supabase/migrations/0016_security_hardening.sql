set search_path = public, extensions;

-- ============================================================
-- Security hardening: authority, immutable entitlements, and
-- atomic session accounting.
-- ============================================================

-- A checkout must preserve the entitlement that was offered when the
-- payment row was created. Webhooks must never re-read mutable package terms.
alter table public.payments
  add column if not exists entitlement_seconds integer,
  add column if not exists entitlement_expires_after_days integer,
  add column if not exists entitlement_package_code text,
  add column if not exists refunded_amount_minor integer not null default 0,
  add column if not exists reversed_seconds integer not null default 0;

update public.payments as p
   set entitlement_seconds = coalesce(p.entitlement_seconds, pp.seconds_to_credit),
       entitlement_expires_after_days = coalesce(
         p.entitlement_expires_after_days,
         pp.credit_expires_after_days
       ),
       entitlement_package_code = coalesce(p.entitlement_package_code, pp.code)
  from public.payment_packages as pp
 where pp.id = p.package_id
   and (
     p.entitlement_seconds is null
     or p.entitlement_package_code is null
   );

alter table public.payments
  drop constraint if exists payments_entitlement_seconds_check;

alter table public.payments
  add constraint payments_entitlement_seconds_check
  check (entitlement_seconds is null or entitlement_seconds > 0);

alter table public.payments
  drop constraint if exists payments_entitlement_expiry_check;

alter table public.payments
  add constraint payments_entitlement_expiry_check
  check (
    entitlement_expires_after_days is null
    or entitlement_expires_after_days between 1 and 3650
  );

alter table public.payments
  drop constraint if exists payments_refund_totals_check;

alter table public.payments
  add constraint payments_refund_totals_check
  check (refunded_amount_minor >= 0 and reversed_seconds >= 0);

-- Analysis work uses a short server-owned lease. A hostile client cannot start
-- several expensive requests against the same session at once.
alter table public.sessions
  add column if not exists analysis_lease_token uuid,
  add column if not exists analysis_lease_expires_at timestamptz;

create index if not exists sessions_analysis_lease_expiry_idx
  on public.sessions (analysis_lease_expires_at)
  where analysis_lease_token is not null;

-- Keep only the newest active installation before installing the invariant.
with ranked_installations as (
  select
    id,
    row_number() over (
      partition by user_id
      order by coalesce(last_seen_at, created_at) desc, created_at desc, id desc
    ) as active_rank
  from public.extension_installations
  where installation_status = 'active'
)
update public.extension_installations as ei
   set installation_status = 'revoked',
       revoked_at = coalesce(ei.revoked_at, now()),
       updated_at = now()
  from ranked_installations as ranked
 where ranked.id = ei.id
   and ranked.active_rank > 1;

create unique index if not exists extension_installations_single_active_user_uidx
  on public.extension_installations (user_id)
  where installation_status = 'active';

-- Clients must never create their own long-lived pairing-code rows.
revoke all on table public.extension_pairing_codes from anon, authenticated;

-- An admin may manage ordinary profile data, but only a super admin may change
-- another user's role. Nobody may promote their own profile directly.
create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.email is distinct from old.email then
    raise exception 'email must be changed through the verified email-change flow';
  end if;

  if new.role is distinct from old.role then
    if not public.is_super_admin() or auth.uid() = old.id then
      raise exception 'role cannot be changed by the current user';
    end if;
  end if;

  if auth.uid() = old.id then
    if new.account_status is distinct from old.account_status then
      raise exception 'account status cannot be changed by the current user';
    end if;

  elsif not public.is_admin() then
    raise exception 'profile update is not permitted';
  end if;

  return new;
end;
$$;

-- Replace payment crediting so the immutable checkout snapshot, not the
-- current package row, determines how many seconds are granted.
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
  current_wallet public.wallets%rowtype;
  v_entitlement_seconds integer;
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
    from public.wallets as w
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
    return;
  end if;

  if payment_row.status <> 'pending' then
    raise exception 'payment % is not pending', p_payment_id;
  end if;

  v_entitlement_seconds := payment_row.entitlement_seconds;
  if v_entitlement_seconds is null or v_entitlement_seconds <= 0 then
    raise exception 'payment % has no immutable entitlement snapshot', p_payment_id;
  end if;

  if payment_row.entitlement_expires_after_days is not null then
    v_grant_expires_at := coalesce(p_paid_at, now())
      + make_interval(days => payment_row.entitlement_expires_after_days);
  end if;

  v_next_remaining := current_wallet.remaining_seconds + v_entitlement_seconds;

  update public.wallets as w
     set remaining_seconds = v_next_remaining,
         lifetime_seconds_purchased = current_wallet.lifetime_seconds_purchased + v_entitlement_seconds,
         updated_at = now()
   where w.id = current_wallet.id;

  wallet_id := current_wallet.id;
  remaining_seconds := v_next_remaining;
  lifetime_seconds_purchased := current_wallet.lifetime_seconds_purchased + v_entitlement_seconds;
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
    v_entitlement_seconds,
    v_next_remaining,
    payment_row.id,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'packageCode', payment_row.entitlement_package_code,
      'creditExpiresAfterDays', payment_row.entitlement_expires_after_days,
      'entitlementSeconds', v_entitlement_seconds
    ) || case
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
    v_entitlement_seconds,
    v_grant_expires_at,
    p_description,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'packageCode', payment_row.entitlement_package_code,
      'creditExpiresAfterDays', payment_row.entitlement_expires_after_days,
      'entitlementSeconds', v_entitlement_seconds
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

-- Refund and dispute events revoke the proportional entitlement exactly once.
-- If already-consumed credits cannot be recovered, the wallet is locked for
-- admin review instead of allowing a negative or silently inconsistent balance.
create or replace function public.reverse_payment_credit_once(
  p_payment_id uuid,
  p_refunded_amount_minor integer,
  p_reason text,
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_wallet public.wallets%rowtype;
  v_target_amount integer;
  v_target_seconds integer;
  v_seconds_due integer;
  v_reversed integer := 0;
  v_shortfall integer := 0;
  v_next_remaining integer;
  v_next_status public.payment_status;
begin
  select * into v_payment
    from public.payments
   where id = p_payment_id
   for update;

  if not found then
    raise exception 'payment not found for id %', p_payment_id;
  end if;

  if v_payment.status not in ('paid', 'refunded') then
    raise exception 'payment % is not eligible for reversal', p_payment_id;
  end if;

  if v_payment.amount_minor <= 0 or v_payment.entitlement_seconds is null then
    raise exception 'payment % has no valid reversal snapshot', p_payment_id;
  end if;

  v_target_amount := least(v_payment.amount_minor, greatest(0, p_refunded_amount_minor));
  v_target_seconds := floor(
    (v_payment.entitlement_seconds::numeric * v_target_amount::numeric) / v_payment.amount_minor::numeric
  )::integer;
  v_seconds_due := greatest(0, v_target_seconds - v_payment.reversed_seconds);

  select * into v_wallet
    from public.wallets
   where user_id = v_payment.user_id
   for update;

  if not found then
    raise exception 'wallet not found for payment %', p_payment_id;
  end if;

  if v_seconds_due > 0 then
    v_reversed := least(v_seconds_due, v_wallet.remaining_seconds);
    v_shortfall := v_seconds_due - v_reversed;

    if v_reversed > 0 then
      perform public.consume_wallet_grants_for_user(v_payment.user_id, v_reversed, now());
      v_next_remaining := v_wallet.remaining_seconds - v_reversed;

      update public.wallets
         set remaining_seconds = v_next_remaining,
             status = case when v_shortfall > 0 then 'locked' else status end,
             updated_at = now()
       where id = v_wallet.id;

      insert into public.credit_transactions (
        user_id,
        wallet_id,
        transaction_type,
        delta_seconds,
        balance_after_seconds,
        related_payment_id,
        description,
        metadata
      ) values (
        v_payment.user_id,
        v_wallet.id,
        'refund',
        v_reversed * -1,
        v_next_remaining,
        v_payment.id,
        coalesce(nullif(p_reason, ''), 'Payment entitlement reversed.'),
        jsonb_build_object(
          'refundedAmountMinor', v_target_amount,
          'targetReversedSeconds', v_target_seconds,
          'shortfallSeconds', v_shortfall
        )
      );
    else
      update public.wallets
         set status = 'locked',
             updated_at = now()
       where id = v_wallet.id;
      v_next_remaining := v_wallet.remaining_seconds;
    end if;
  else
    v_next_remaining := v_wallet.remaining_seconds;
  end if;

  v_next_status := case when v_target_amount >= v_payment.amount_minor then 'refunded' else 'paid' end;

  update public.payments
     set status = v_next_status,
         refunded_amount_minor = greatest(refunded_amount_minor, v_target_amount),
         -- Mark the provider-reported entitlement target as handled even when
         -- consumed credits caused a shortfall. Replayed webhook events must
         -- never debit a later, unrelated top-up.
         reversed_seconds = greatest(reversed_seconds, v_target_seconds),
         raw_payload = coalesce(raw_payload, '{}'::jsonb) || coalesce(p_raw_payload, '{}'::jsonb),
         updated_at = now()
   where id = v_payment.id;

  return jsonb_build_object(
    'paymentStatus', v_next_status,
    'reversedSeconds', v_reversed,
    'totalReversedSeconds', greatest(v_payment.reversed_seconds, v_target_seconds),
    'shortfallSeconds', v_shortfall,
    'remainingSeconds', v_next_remaining,
    'walletLocked', v_shortfall > 0 or v_wallet.status = 'locked'
  );
end;
$$;

-- Serialize wallet, allowance, and session checkpoint updates in one database
-- transaction. p_minimum_seconds is one only for expensive analysis requests;
-- status/wallet polling passes zero.
create or replace function public.settle_active_session_usage(
  p_user_id uuid,
  p_session_id uuid,
  p_minimum_seconds integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_session public.sessions%rowtype;
  v_wallet public.wallets%rowtype;
  v_override public.user_access_overrides%rowtype;
  v_daily_used integer := 0;
  v_monthly_used integer := 0;
  v_daily_remaining integer := null;
  v_monthly_remaining integer := null;
  v_allowance integer := null;
  v_limit_kind text := null;
  v_elapsed integer := 0;
  v_requested integer := 0;
  v_consumed integer := 0;
  v_next_status public.session_status := 'active';
  v_wallet_result record;
begin
  if p_minimum_seconds < 0 or p_minimum_seconds > 60 then
    raise exception 'minimum session debit is out of range';
  end if;

  select *
    into v_session
    from public.sessions
   where id = p_session_id
     and user_id = p_user_id
     and end_time is null
   for update;

  if not found then
    raise exception 'session not found or already closed';
  end if;

  perform * from public.expire_wallet_grants_for_user(p_user_id, v_now);

  select *
    into v_wallet
    from public.wallets
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  if v_session.status <> 'active' then
    return jsonb_build_object(
      'session', to_jsonb(v_session),
      'wallet', to_jsonb(v_wallet),
      'consumedSeconds', 0,
      'usageLimitReached', null
    );
  end if;

  if v_wallet.status = 'locked' then
    update public.sessions
       set status = 'ended',
           end_time = v_now,
           last_activity_at = v_now,
           updated_at = v_now
     where id = v_session.id
     returning * into v_session;

    return jsonb_build_object(
      'session', to_jsonb(v_session),
      'wallet', to_jsonb(v_wallet),
      'consumedSeconds', 0,
      'usageLimitReached', null
    );
  end if;

  select *
    into v_override
    from public.user_access_overrides
   where user_id = p_user_id;

  if v_override.daily_usage_limit_seconds is not null then
    select coalesce(sum(abs(delta_seconds)), 0)::integer
      into v_daily_used
      from public.credit_transactions
     where user_id = p_user_id
       and transaction_type = 'usage_debit'
       and created_at >= date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
    v_daily_remaining := greatest(0, v_override.daily_usage_limit_seconds - v_daily_used);
  end if;

  if v_override.monthly_usage_limit_seconds is not null then
    select coalesce(sum(abs(delta_seconds)), 0)::integer
      into v_monthly_used
      from public.credit_transactions
     where user_id = p_user_id
       and transaction_type = 'usage_debit'
       and created_at >= date_trunc('month', v_now at time zone 'UTC') at time zone 'UTC';
    v_monthly_remaining := greatest(0, v_override.monthly_usage_limit_seconds - v_monthly_used);
  end if;

  if v_daily_remaining is not null and v_daily_remaining <= 0 then
    v_limit_kind := 'daily';
  elsif v_monthly_remaining is not null and v_monthly_remaining <= 0 then
    v_limit_kind := 'monthly';
  end if;

  if v_limit_kind is not null then
    update public.sessions
       set status = 'timed_out',
           end_time = v_now,
           last_activity_at = v_now,
           updated_at = v_now
     where id = v_session.id
     returning * into v_session;

    return jsonb_build_object(
      'session', to_jsonb(v_session),
      'wallet', to_jsonb(v_wallet),
      'consumedSeconds', 0,
      'usageLimitReached', v_limit_kind
    );
  end if;

  if v_daily_remaining is not null and v_monthly_remaining is not null then
    v_allowance := least(v_daily_remaining, v_monthly_remaining);
    v_limit_kind := case when v_daily_remaining <= v_monthly_remaining then 'daily' else 'monthly' end;
  elsif v_daily_remaining is not null then
    v_allowance := v_daily_remaining;
    v_limit_kind := 'daily';
  elsif v_monthly_remaining is not null then
    v_allowance := v_monthly_remaining;
    v_limit_kind := 'monthly';
  end if;

  v_elapsed := greatest(
    0,
    floor(extract(epoch from (v_now - coalesce(v_session.last_activity_at, v_session.start_time))))::integer
  );
  v_requested := greatest(v_elapsed, p_minimum_seconds);

  if v_requested <= 0 then
    return jsonb_build_object(
      'session', to_jsonb(v_session),
      'wallet', to_jsonb(v_wallet),
      'consumedSeconds', 0,
      'usageLimitReached', null
    );
  end if;

  v_consumed := least(v_requested, v_wallet.remaining_seconds);
  if v_allowance is not null then
    v_consumed := least(v_consumed, v_allowance);
  end if;

  if v_consumed > 0 then
    select *
      into v_wallet_result
      from public.apply_wallet_seconds(
        p_user_id,
        v_consumed * -1,
        'usage_debit',
        'Live study session time usage',
        null,
        v_session.id,
        jsonb_build_object(
          'source', 'session_usage',
          'elapsedSeconds', v_elapsed,
          'consumedSeconds', v_consumed,
          'minimumSeconds', p_minimum_seconds
        ),
        null
      );

    select * into v_wallet from public.wallets where user_id = p_user_id;
  end if;

  if v_allowance is not null and v_consumed >= v_allowance then
    v_next_status := 'timed_out';
  elsif v_consumed < v_requested or v_wallet.remaining_seconds <= 0 then
    v_next_status := 'no_credit';
  else
    v_next_status := 'active';
  end if;

  update public.sessions
     set used_seconds = used_seconds + v_consumed,
         last_activity_at = v_now,
         status = v_next_status,
         end_time = case when v_next_status in ('timed_out', 'no_credit') then v_now else null end,
         updated_at = v_now
   where id = v_session.id
   returning * into v_session;

  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'wallet', to_jsonb(v_wallet),
    'consumedSeconds', v_consumed,
    'usageLimitReached', case when v_next_status = 'timed_out' then v_limit_kind else null end
  );
end;
$$;

create or replace function public.acquire_session_analysis_lease(
  p_user_id uuid,
  p_session_id uuid,
  p_lease_token uuid,
  p_lease_seconds integer default 90
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.sessions%rowtype;
begin
  if p_lease_seconds < 15 or p_lease_seconds > 300 then
    raise exception 'analysis lease duration is out of range';
  end if;

  select *
    into v_session
    from public.sessions
   where id = p_session_id
     and user_id = p_user_id
   for update;

  if not found or v_session.status <> 'active' or v_session.end_time is not null then
    raise exception 'session is not active';
  end if;

  if v_session.analysis_lease_token is not null
     and v_session.analysis_lease_expires_at > now() then
    raise exception 'analysis already in progress';
  end if;

  update public.sessions
     set analysis_lease_token = p_lease_token,
         analysis_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where id = p_session_id;
end;
$$;

create or replace function public.release_session_analysis_lease(
  p_user_id uuid,
  p_session_id uuid,
  p_lease_token uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.sessions
     set analysis_lease_token = null,
         analysis_lease_expires_at = null,
         updated_at = now()
   where id = p_session_id
     and user_id = p_user_id
     and analysis_lease_token = p_lease_token;
$$;

-- Atomic refresh-token rotation prevents two successors from being issued from
-- the same predecessor token.
create or replace function public.rotate_extension_refresh_token(
  p_installation_id uuid,
  p_current_token_hash text,
  p_next_token_hash text,
  p_next_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_installation public.extension_installations%rowtype;
  v_token public.extension_tokens%rowtype;
  v_override public.user_access_overrides%rowtype;
begin
  select *
    into v_installation
    from public.extension_installations
   where id = p_installation_id
   for update;

  if not found or v_installation.installation_status <> 'active' then
    raise exception 'installation is not active';
  end if;

  select *
    into v_override
    from public.user_access_overrides
   where user_id = v_installation.user_id;

  if v_override.can_use_extension = false then
    raise exception 'extension access is disabled';
  end if;

  select *
    into v_token
    from public.extension_tokens
   where installation_id = p_installation_id
     and token_hash = p_current_token_hash
   for update;

  if not found then
    raise exception 'refresh token is invalid';
  end if;

  if v_token.revoked_at is not null then
    update public.extension_installations
       set installation_status = 'revoked',
           revoked_at = coalesce(revoked_at, now()),
           updated_at = now()
     where id = p_installation_id;

    update public.extension_tokens
       set revoked_at = coalesce(revoked_at, now())
     where installation_id = p_installation_id;

    -- Returning null (rather than raising) commits the family revocation.
    return null;
  end if;

  if v_token.expires_at <= now() then
    raise exception 'refresh token is invalid or expired';
  end if;

  update public.extension_tokens
     set revoked_at = now()
   where id = v_token.id;

  insert into public.extension_tokens (
    installation_id,
    token_hash,
    expires_at
  )
  values (
    p_installation_id,
    p_next_token_hash,
    p_next_expires_at
  );

  return v_installation.user_id;
end;
$$;

-- OTP verification must update the attempt counter and consume a successful
-- code while holding the same row lock.
create or replace function public.verify_otp_code_atomic(
  p_user_id uuid,
  p_purpose text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otp public.otp_codes%rowtype;
  v_attempts integer;
begin
  select *
    into v_otp
    from public.otp_codes
   where user_id = p_user_id
     and purpose = p_purpose
     and used_at is null
   order by created_at desc
   limit 1
   for update;

  if not found or v_otp.expires_at <= now() then
    return jsonb_build_object('status', 'not_found', 'remainingAttempts', 0);
  end if;

  if v_otp.attempts >= v_otp.max_attempts then
    update public.otp_codes set used_at = now() where id = v_otp.id;
    return jsonb_build_object('status', 'locked', 'remainingAttempts', 0);
  end if;

  v_attempts := v_otp.attempts + 1;

  if v_otp.code_hash <> p_code_hash then
    update public.otp_codes
       set attempts = v_attempts,
           used_at = case when v_attempts >= v_otp.max_attempts then now() else null end
     where id = v_otp.id;

    return jsonb_build_object(
      'status', case when v_attempts >= v_otp.max_attempts then 'locked' else 'invalid' end,
      'remainingAttempts', greatest(0, v_otp.max_attempts - v_attempts)
    );
  end if;

  update public.otp_codes
     set attempts = v_attempts,
         used_at = now()
   where id = v_otp.id;

  return jsonb_build_object('status', 'verified', 'remainingAttempts', greatest(0, v_otp.max_attempts - v_attempts));
end;
$$;

-- A database-backed fixed-window limiter is shared by every serverless
-- instance. Only keyed hashes are stored, never raw IPs or account ids.
create table if not exists public.security_rate_limits (
  key_hash text primary key,
  request_count integer not null default 0 check (request_count >= 0),
  window_started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.security_rate_limits enable row level security;
revoke all on table public.security_rate_limits from public, anon, authenticated;

create index if not exists security_rate_limits_expiry_idx
  on public.security_rate_limits (expires_at);

create or replace function public.consume_security_rate_limit(
  p_key_hash text,
  p_max_requests integer,
  p_window_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_entry public.security_rate_limits%rowtype;
  v_allowed boolean := false;
begin
  if length(p_key_hash) <> 64
     or p_max_requests < 1
     or p_max_requests > 10000
     or p_window_ms < 1000
     or p_window_ms > 86400000 then
    raise exception 'rate limit parameters are invalid';
  end if;

  insert into public.security_rate_limits (
    key_hash,
    request_count,
    window_started_at,
    expires_at,
    updated_at
  )
  values (
    p_key_hash,
    0,
    v_now,
    v_now + (p_window_ms * interval '1 millisecond'),
    v_now
  )
  on conflict (key_hash) do nothing;

  select *
    into v_entry
    from public.security_rate_limits
   where key_hash = p_key_hash
   for update;

  if v_entry.expires_at <= v_now then
    v_entry.request_count := 1;
    v_entry.window_started_at := v_now;
    v_entry.expires_at := v_now + (p_window_ms * interval '1 millisecond');
    v_allowed := true;
  elsif v_entry.request_count < p_max_requests then
    v_entry.request_count := v_entry.request_count + 1;
    v_allowed := true;
  end if;

  update public.security_rate_limits
     set request_count = v_entry.request_count,
         window_started_at = v_entry.window_started_at,
         expires_at = v_entry.expires_at,
         updated_at = v_now
   where key_hash = p_key_hash;

  return jsonb_build_object(
    'allowed', v_allowed,
    'count', v_entry.request_count,
    'resetAt', v_entry.expires_at
  );
end;
$$;

-- SECURITY DEFINER functions inherit PUBLIC execute by default in PostgreSQL.
-- Use an explicit client allow-list: only the three read-only role helpers
-- required by RLS remain callable by anon/authenticated users. All other
-- elevated functions are service-role-only.
do $$
declare
  secured_function record;
begin
  for secured_function in
    select p.oid::regprocedure as signature, p.proname
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
  loop
    if secured_function.proname not in ('current_app_role', 'is_super_admin', 'is_admin') then
      execute format(
        'revoke all privileges on function %s from public, anon, authenticated',
        secured_function.signature
      );
    end if;
    execute format(
      'grant execute on function %s to service_role',
      secured_function.signature
    );
  end loop;
end;
$$;

grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_super_admin() to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
