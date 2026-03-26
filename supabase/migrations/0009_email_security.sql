set search_path = public, extensions;

alter table public.profiles
  add column if not exists email_2fa_enabled boolean not null default false;
