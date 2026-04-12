set search_path = public, extensions;

alter table public.payment_packages
  add column if not exists credit_expires_after_days integer
    check (
      credit_expires_after_days is null
      or credit_expires_after_days between 1 and 3650
    );

create table if not exists public.wallet_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  source_transaction_id uuid references public.credit_transactions (id) on delete set null,
  grant_type public.credit_transaction_type not null,
  total_seconds integer not null check (total_seconds > 0),
  remaining_seconds integer not null check (remaining_seconds >= 0),
  expires_at timestamptz,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  depleted_at timestamptz,
  expired_at timestamptz,
  constraint wallet_grants_remaining_lte_total_chk check (remaining_seconds <= total_seconds)
);

create unique index if not exists wallet_grants_source_transaction_uidx
  on public.wallet_grants (source_transaction_id)
  where source_transaction_id is not null;

create index if not exists wallet_grants_user_expiry_idx
  on public.wallet_grants (user_id, expires_at, created_at);

create index if not exists wallet_grants_active_lookup_idx
  on public.wallet_grants (user_id, expires_at, created_at)
  where remaining_seconds > 0 and expired_at is null;

create index if not exists wallet_grants_wallet_created_idx
  on public.wallet_grants (wallet_id, created_at desc);

drop trigger if exists wallet_grants_set_updated_at on public.wallet_grants;
create trigger wallet_grants_set_updated_at
before update on public.wallet_grants
for each row
execute function public.set_updated_at();

alter table public.wallet_grants enable row level security;
alter table public.wallet_grants force row level security;

create policy wallet_grants_select_own
  on public.wallet_grants
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy wallet_grants_select_admin
  on public.wallet_grants
  for select
  to authenticated
  using (public.is_admin());

create policy wallet_grants_insert_admin
  on public.wallet_grants
  for insert
  to authenticated
  with check (public.is_admin());

create policy wallet_grants_update_admin
  on public.wallet_grants
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.wallet_grants (
  user_id,
  wallet_id,
  grant_type,
  total_seconds,
  remaining_seconds,
  expires_at,
  description,
  metadata,
  created_at,
  updated_at
)
select
  w.user_id,
  w.id,
  'restoration',
  w.remaining_seconds,
  w.remaining_seconds,
  null,
  'Migrated legacy wallet balance into wallet grants.',
  jsonb_build_object(
    'source',
    'wallet_grants_backfill',
    'migration',
    '0014_wallet_grants_and_admin_rollups'
  ),
  now(),
  now()
from public.wallets as w
where w.remaining_seconds > 0
  and not exists (
    select 1
    from public.wallet_grants as wg
    where wg.wallet_id = w.id
  );

create or replace function public.insert_wallet_grant(
  p_user_id uuid,
  p_wallet_id uuid,
  p_source_transaction_id uuid,
  p_grant_type public.credit_transaction_type,
  p_total_seconds integer,
  p_expires_at timestamptz default null,
  p_description text default '',
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  grant_id uuid;
begin
  if p_total_seconds <= 0 then
    raise exception 'wallet grant total must be positive';
  end if;

  insert into public.wallet_grants (
    user_id,
    wallet_id,
    source_transaction_id,
    grant_type,
    total_seconds,
    remaining_seconds,
    expires_at,
    description,
    metadata,
    created_by
  )
  values (
    p_user_id,
    p_wallet_id,
    p_source_transaction_id,
    p_grant_type,
    p_total_seconds,
    p_total_seconds,
    p_expires_at,
    coalesce(p_description, ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning id into grant_id;

  return grant_id;
end;
$$;

grant execute on function public.insert_wallet_grant(
  uuid,
  uuid,
  uuid,
  public.credit_transaction_type,
  integer,
  timestamptz,
  text,
  jsonb,
  uuid
) to service_role;

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
declare
  current_wallet public.wallets%rowtype;
  next_remaining integer;
begin
  select *
    into current_wallet
    from public.wallets
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  with expired_rows as (
    select id, remaining_seconds
      from public.wallet_grants
     where user_id = p_user_id
       and remaining_seconds > 0
       and expired_at is null
       and expires_at is not null
       and expires_at <= p_now
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
     returning er.remaining_seconds
  )
  select coalesce(sum(remaining_seconds), 0), count(*)
    into expired_seconds, expired_grant_count
    from updated_rows;

  if expired_seconds > 0 then
    next_remaining := greatest(0, current_wallet.remaining_seconds - expired_seconds);

    update public.wallets as w
       set remaining_seconds = next_remaining,
           updated_at = p_now
     where id = current_wallet.id
     returning w.remaining_seconds
      into remaining_seconds;

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
      expired_seconds * -1,
      remaining_seconds,
      'Expired credits removed from wallet.',
      jsonb_build_object(
        'source',
        'wallet_grant_expiration',
        'expiredGrantCount',
        expired_grant_count
      )
    );
  else
    remaining_seconds := current_wallet.remaining_seconds;
  end if;

  wallet_id := current_wallet.id;
  return next;
end;
$$;

grant execute on function public.expire_wallet_grants_for_user(
  uuid,
  timestamptz
) to service_role;

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
    select id, remaining_seconds
      from public.wallet_grants
     where user_id = p_user_id
       and remaining_seconds > 0
       and expired_at is null
       and (expires_at is null or expires_at > p_now)
     order by expires_at asc nulls last, created_at asc, id asc
     for update
  loop
    exit when seconds_left <= 0;

    consumed := least(seconds_left, grant_row.remaining_seconds);

    update public.wallet_grants
       set remaining_seconds = remaining_seconds - consumed,
           depleted_at = case
             when remaining_seconds - consumed = 0 then coalesce(depleted_at, p_now)
             else depleted_at
           end,
           updated_at = p_now
     where id = grant_row.id;

    seconds_left := seconds_left - consumed;
  end loop;

  if seconds_left > 0 then
    raise exception 'insufficient wallet grants for user %', p_user_id;
  end if;

  return p_seconds;
end;
$$;

grant execute on function public.consume_wallet_grants_for_user(
  uuid,
  integer,
  timestamptz
) to service_role;

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
declare
  target record;
  expiration_result record;
begin
  for target in
    select user_id
      from public.wallet_grants
     where remaining_seconds > 0
       and expired_at is null
       and expires_at is not null
       and expires_at <= p_now
     group by user_id
     order by min(expires_at) asc
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

grant execute on function public.process_expired_wallet_grants(
  integer,
  timestamptz
) to service_role;

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
declare
  target record;
begin
  for target in
    select id, email, status_reason
      from public.profiles
     where account_status = 'suspended'
       and suspended_until is not null
       and suspended_until <= p_now
     order by suspended_until asc
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
     where user_id = target.id;

    user_id := target.id;
    email := target.email;
    previous_reason := target.status_reason;
    return next;
  end loop;
end;
$$;

grant execute on function public.restore_elapsed_suspensions(
  integer,
  timestamptz
) to service_role;

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
  transaction_id uuid;
  grant_expires_at timestamptz := null;
begin
  perform *
    from public.expire_wallet_grants_for_user(p_user_id, now());

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

  if p_delta_seconds > 0 and p_transaction_type in ('purchase', 'admin_adjustment_add', 'promo', 'restoration') then
    purchased_increment := p_delta_seconds;
    if coalesce(p_metadata, '{}'::jsonb) ? 'expiresAt'
      and nullif(trim(coalesce(p_metadata ->> 'expiresAt', '')), '') is not null then
      grant_expires_at := (p_metadata ->> 'expiresAt')::timestamptz;
    end if;
  end if;

  if p_transaction_type = 'usage_debit' and p_delta_seconds < 0 then
    used_increment := abs(p_delta_seconds);
  end if;

  if p_delta_seconds < 0 then
    perform public.consume_wallet_grants_for_user(p_user_id, abs(p_delta_seconds), now());
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
  )
  returning id into transaction_id;

  if p_delta_seconds > 0 and p_transaction_type in ('purchase', 'admin_adjustment_add', 'promo', 'restoration') then
    perform public.insert_wallet_grant(
      p_user_id,
      current_wallet.id,
      transaction_id,
      p_transaction_type,
      p_delta_seconds,
      grant_expires_at,
      p_description,
      p_metadata,
      p_created_by
    );
  end if;

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
  grant_expires_at timestamptz := null;
  transaction_id uuid;
begin
  select *
    into payment_row
    from public.payments
   where id = p_payment_id
   for update;

  if not found then
    raise exception 'payment not found for id %', p_payment_id;
  end if;

  perform *
    from public.expire_wallet_grants_for_user(payment_row.user_id, coalesce(p_paid_at, now()));

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

  if package_row.credit_expires_after_days is not null then
    grant_expires_at := coalesce(p_paid_at, now()) + make_interval(days => package_row.credit_expires_after_days);
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
    coalesce(p_metadata, '{}'::jsonb) || case
      when grant_expires_at is not null then jsonb_build_object('expiresAt', grant_expires_at)
      else '{}'::jsonb
    end,
    p_created_by
  )
  returning id into transaction_id;

  perform public.insert_wallet_grant(
    payment_row.user_id,
    wallet_id,
    transaction_id,
    'purchase',
    package_row.seconds_to_credit,
    grant_expires_at,
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

create or replace view public.admin_user_rollups as
with session_rollups as (
  select
    s.user_id,
    count(*)::integer as session_count,
    bool_or(s.status = 'active') as has_active_session,
    max(coalesce(s.last_activity_at, s.end_time, s.start_time)) as last_active_at,
    max(s.start_time) as last_session_at
  from public.sessions as s
  group by s.user_id
),
flag_rollups as (
  select
    uf.user_id,
    coalesce(array_agg(uf.flag order by lower(uf.flag)), '{}'::text[]) as flag_labels,
    coalesce(string_agg(uf.flag, ' ' order by lower(uf.flag)), '') as flags_text
  from public.user_flags as uf
  group by uf.user_id
),
payment_rollups as (
  select distinct on (p.user_id)
    p.user_id,
    p.status as last_payment_status,
    coalesce(p.paid_at, p.created_at) as last_payment_at,
    pp.name as current_package_name,
    pp.code as current_package_code
  from public.payments as p
  left join public.payment_packages as pp
    on pp.id = p.package_id
  order by p.user_id, coalesce(p.paid_at, p.created_at) desc, p.created_at desc
),
grant_rollups as (
  select
    wg.user_id,
    min(wg.expires_at) filter (
      where wg.remaining_seconds > 0
        and wg.expired_at is null
        and wg.expires_at is not null
    ) as next_credit_expiry_at,
    coalesce(sum(wg.remaining_seconds) filter (
      where wg.remaining_seconds > 0
        and wg.expired_at is null
        and wg.expires_at is not null
    ), 0)::integer as expiring_credit_seconds
  from public.wallet_grants as wg
  group by wg.user_id
)
select
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  p.account_status,
  p.created_at,
  p.status_reason,
  p.suspended_until,
  coalesce(w.status, 'locked'::public.wallet_status) as wallet_status,
  coalesce(w.remaining_seconds, 0) as remaining_seconds,
  coalesce(w.lifetime_seconds_purchased, 0) as lifetime_seconds_purchased,
  coalesce(w.lifetime_seconds_used, 0) as lifetime_seconds_used,
  coalesce(sr.session_count, 0) as session_count,
  coalesce(sr.has_active_session, false) as has_active_session,
  sr.last_active_at,
  sr.last_session_at,
  pr.current_package_name,
  pr.current_package_code,
  pr.last_payment_status,
  pr.last_payment_at,
  coalesce(gr.next_credit_expiry_at, null) as next_credit_expiry_at,
  coalesce(gr.expiring_credit_seconds, 0) as expiring_credit_seconds,
  coalesce(fr.flag_labels, '{}'::text[]) as flag_labels,
  coalesce(fr.flags_text, '') as flags_text
from public.profiles as p
left join public.wallets as w
  on w.user_id = p.id
left join session_rollups as sr
  on sr.user_id = p.id
left join payment_rollups as pr
  on pr.user_id = p.id
left join grant_rollups as gr
  on gr.user_id = p.id
left join flag_rollups as fr
  on fr.user_id = p.id;
