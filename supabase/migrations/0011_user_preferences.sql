set search_path = public, extensions;

create type public.appearance_mode as enum ('light', 'dark', 'system');

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  appearance_mode public.appearance_mode not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

create policy user_preferences_select_own
  on public.user_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy user_preferences_insert_own
  on public.user_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy user_preferences_update_own
  on public.user_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger user_preferences_set_updated_at
  before update on public.user_preferences
  for each row
  execute function public.set_updated_at();

-- Migrate existing theme preferences from client_settings if they exist
insert into public.user_preferences (user_id, appearance_mode)
select user_id, theme_preference::public.appearance_mode
from public.client_settings
on conflict (user_id) do nothing;
