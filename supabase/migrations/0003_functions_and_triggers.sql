set search_path = public, extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.id then
    if new.role <> old.role then
      raise exception 'role cannot be changed by the current user';
    end if;

    if new.account_status <> old.account_status then
      raise exception 'account_status cannot be changed by the current user';
    end if;

    if lower(new.email) <> lower(old.email) then
      raise exception 'email must be updated through the authentication flow';
    end if;
  end if;

  return new;
end;
$$;

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

  return new;
end;
$$;

create or replace function public.sync_auth_user_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles as p
     set email = coalesce(new.email, p.email),
         last_login_at = coalesce(new.last_sign_in_at, p.last_login_at),
         account_status = case
           when p.account_status = 'pending_verification' and new.email_confirmed_at is not null
             then 'active'
           else p.account_status
         end,
         updated_at = now()
   where p.id = new.id;

  return new;
end;
$$;

create or replace function public.inherit_folder_subject()
returns trigger
language plpgsql
as $$
declare
  parent_subject_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select f.subject_id
    into parent_subject_id
    from public.folders as f
   where f.id = new.parent_id
     and f.deleted_at is null;

  if parent_subject_id is null then
    raise exception 'parent folder must exist and not be deleted';
  end if;

  if new.subject_id is null then
    new.subject_id = parent_subject_id;
  elsif new.subject_id <> parent_subject_id then
    raise exception 'child folder subject_id must match parent subject_id';
  end if;

  return new;
end;
$$;

create or replace function public.validate_source_file_metadata()
returns trigger
language plpgsql
as $$
declare
  folder_subject_id uuid;
  category_subject_id uuid;
begin
  select f.subject_id
    into folder_subject_id
    from public.folders as f
   where f.id = new.folder_id
     and f.deleted_at is null;

  if folder_subject_id is null then
    raise exception 'folder must exist, be active, and map to a subject';
  end if;

  if folder_subject_id <> new.subject_id then
    raise exception 'source file subject_id must match folder subject_id';
  end if;

  if new.category_id is not null then
    select c.subject_id
      into category_subject_id
      from public.categories as c
     where c.id = new.category_id;

    if category_subject_id is not null and category_subject_id <> new.subject_id then
      raise exception 'source file category_id must belong to the same subject or be global';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.sync_source_file_version_number()
returns trigger
language plpgsql
as $$
begin
  update public.source_files
     set version_number = greatest(version_number, new.version_number),
         updated_at = now()
   where id = new.source_file_id;

  return new;
end;
$$;

create or replace function public.guard_notification_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  if auth.uid() = old.user_id then
    if new.user_id <> old.user_id
      or new.notification_type <> old.notification_type
      or new.title <> old.title
      or new.body <> old.body
      or new.metadata <> old.metadata
      or new.created_at <> old.created_at then
      raise exception 'only read status fields may be changed by the current user';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger profiles_guard_self_update
before update on public.profiles
for each row
execute function public.guard_profile_self_update();

create trigger wallets_set_updated_at
before update on public.wallets
for each row
execute function public.set_updated_at();

create trigger payment_packages_set_updated_at
before update on public.payment_packages
for each row
execute function public.set_updated_at();

create trigger payment_customers_set_updated_at
before update on public.payment_customers
for each row
execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

create trigger subjects_set_updated_at
before update on public.subjects
for each row
execute function public.set_updated_at();

create trigger folders_set_updated_at
before update on public.folders
for each row
execute function public.set_updated_at();

create trigger folders_inherit_subject
before insert or update on public.folders
for each row
execute function public.inherit_folder_subject();

create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

create trigger source_files_set_updated_at
before update on public.source_files
for each row
execute function public.set_updated_at();

create trigger source_files_validate_metadata
before insert or update on public.source_files
for each row
execute function public.validate_source_file_metadata();

create trigger source_file_versions_sync_version_number
after insert on public.source_versions
for each row
execute function public.sync_source_file_version_number();

create trigger extension_installations_set_updated_at
before update on public.extension_installations
for each row
execute function public.set_updated_at();

create trigger sessions_set_updated_at
before update on public.sessions
for each row
execute function public.set_updated_at();

create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row
execute function public.set_updated_at();

create trigger notifications_guard_self_update
before update on public.notifications
for each row
execute function public.guard_notification_self_update();

create trigger system_settings_set_updated_at
before update on public.system_settings
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email, email_confirmed_at, last_sign_in_at on auth.users
for each row
execute function public.sync_auth_user_to_profile();
