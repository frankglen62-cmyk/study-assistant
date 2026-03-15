set search_path = public, extensions;

create table public.client_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  answer_style text not null default 'concise'
    check (answer_style in ('concise', 'detailed')),
  show_confidence boolean not null default true,
  default_detection_mode public.detection_mode not null default 'auto',
  low_credit_notifications boolean not null default true,
  theme_preference text not null default 'system'
    check (theme_preference in ('light', 'dark', 'system')),
  language text not null default 'English'
    check (btrim(language) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_settings_updated_at_idx
  on public.client_settings (updated_at desc);

alter table public.client_settings enable row level security;
alter table public.client_settings force row level security;

create policy client_settings_select_own
  on public.client_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy client_settings_insert_own
  on public.client_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy client_settings_update_own
  on public.client_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy client_settings_manage_admin
  on public.client_settings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create trigger client_settings_set_updated_at
before update on public.client_settings
for each row
execute function public.set_updated_at();

create unique index credit_transactions_purchase_payment_uidx
  on public.credit_transactions (related_payment_id)
  where related_payment_id is not null
    and transaction_type = 'purchase';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_full_name text;
  resolved_status public.account_status;
begin
  resolved_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'New User'
  );

  resolved_status := case
    when new.email_confirmed_at is null then 'pending_verification'
    else 'active'
  end;

  insert into public.profiles (
    id,
    role,
    full_name,
    email,
    account_status,
    timezone,
    created_at,
    updated_at
  )
  values (
    new.id,
    'client',
    resolved_full_name,
    coalesce(new.email, ''),
    resolved_status,
    'UTC',
    now(),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.client_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

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

create or replace function public.set_user_account_status(
  p_user_id uuid,
  p_account_status public.account_status,
  p_wallet_status public.wallet_status
)
returns table(
  user_id uuid,
  account_status public.account_status,
  wallet_status public.wallet_status
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set account_status = p_account_status,
         updated_at = now()
   where id = p_user_id;

  if not found then
    raise exception 'profile not found for user %', p_user_id;
  end if;

  update public.wallets
     set status = p_wallet_status,
         updated_at = now()
   where user_id = p_user_id;

  if not found then
    raise exception 'wallet not found for user %', p_user_id;
  end if;

  user_id := p_user_id;
  account_status := p_account_status;
  wallet_status := p_wallet_status;
  return next;
end;
$$;

grant execute on function public.set_user_account_status(
  uuid,
  public.account_status,
  public.wallet_status
) to service_role;
