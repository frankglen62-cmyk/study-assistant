set search_path = public, extensions;

alter table public.profiles
  add column if not exists suspended_until timestamptz;

create index if not exists profiles_account_status_created_idx
  on public.profiles (account_status, created_at desc);

create index if not exists profiles_role_created_idx
  on public.profiles (role, created_at desc);

create index if not exists profiles_suspended_until_idx
  on public.profiles (suspended_until)
  where account_status = 'suspended';

create index if not exists wallets_remaining_seconds_idx
  on public.wallets (remaining_seconds);

create index if not exists wallets_user_status_idx
  on public.wallets (user_id, status);

create index if not exists sessions_user_created_idx
  on public.sessions (user_id, created_at desc);

create index if not exists sessions_status_user_created_idx
  on public.sessions (status, user_id, created_at desc);
