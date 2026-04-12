set search_path = public, extensions;

alter table public.profiles
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references public.profiles (id) on delete set null;

create table if not exists public.user_admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text not null check (btrim(note) <> ''),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists user_admin_notes_user_created_idx
  on public.user_admin_notes (user_id, created_at desc);

create table if not exists public.user_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  flag text not null check (btrim(flag) <> ''),
  color text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists user_flags_user_flag_uidx
  on public.user_flags (user_id, lower(flag));

create index if not exists user_flags_user_created_idx
  on public.user_flags (user_id, created_at desc);

create table if not exists public.user_access_overrides (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  can_use_extension boolean not null default true,
  can_buy_credits boolean not null default true,
  max_active_devices integer check (max_active_devices is null or max_active_devices > 0),
  daily_usage_limit_seconds integer check (daily_usage_limit_seconds is null or daily_usage_limit_seconds >= 0),
  monthly_usage_limit_seconds integer check (monthly_usage_limit_seconds is null or monthly_usage_limit_seconds >= 0),
  feature_flags jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_access_overrides_set_updated_at
before update on public.user_access_overrides
for each row
execute function public.set_updated_at();

alter table public.user_admin_notes enable row level security;
alter table public.user_admin_notes force row level security;

alter table public.user_flags enable row level security;
alter table public.user_flags force row level security;

alter table public.user_access_overrides enable row level security;
alter table public.user_access_overrides force row level security;

create policy user_admin_notes_select_admin
  on public.user_admin_notes
  for select
  to authenticated
  using (public.is_admin());

create policy user_admin_notes_insert_admin
  on public.user_admin_notes
  for insert
  to authenticated
  with check (public.is_admin());

create policy user_admin_notes_delete_admin
  on public.user_admin_notes
  for delete
  to authenticated
  using (public.is_admin());

create policy user_flags_select_admin
  on public.user_flags
  for select
  to authenticated
  using (public.is_admin());

create policy user_flags_insert_admin
  on public.user_flags
  for insert
  to authenticated
  with check (public.is_admin());

create policy user_flags_delete_admin
  on public.user_flags
  for delete
  to authenticated
  using (public.is_admin());

create policy user_access_overrides_select_admin
  on public.user_access_overrides
  for select
  to authenticated
  using (public.is_admin());

create policy user_access_overrides_insert_admin
  on public.user_access_overrides
  for insert
  to authenticated
  with check (public.is_admin());

create policy user_access_overrides_update_admin
  on public.user_access_overrides
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
