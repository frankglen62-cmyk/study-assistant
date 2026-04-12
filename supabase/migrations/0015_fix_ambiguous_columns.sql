set search_path = public, extensions;

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
    select wg.user_id
      from public.wallet_grants as wg
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
    select p.id, p.email, p.status_reason
      from public.profiles as p
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
     where user_id = target.id;

    user_id := target.id;
    email := target.email;
    previous_reason := target.status_reason;
    return next;
  end loop;
end;
$$;
