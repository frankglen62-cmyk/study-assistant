set search_path = public, extensions;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles as p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.role = 'super_admin'
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
      and p.account_status = 'active'
  );
$$;

grant execute on function public.current_app_role() to anon, authenticated, service_role;
grant execute on function public.is_super_admin() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.payment_customers enable row level security;
alter table public.payments enable row level security;
alter table public.payment_packages enable row level security;
alter table public.subjects enable row level security;
alter table public.folders enable row level security;
alter table public.categories enable row level security;
alter table public.source_files enable row level security;
alter table public.source_versions enable row level security;
alter table public.source_chunks enable row level security;
alter table public.source_processing_jobs enable row level security;
alter table public.sessions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.extension_installations enable row level security;
alter table public.extension_tokens enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.system_settings enable row level security;

alter table public.profiles force row level security;
alter table public.wallets force row level security;
alter table public.credit_transactions force row level security;
alter table public.payment_customers force row level security;
alter table public.payments force row level security;
alter table public.payment_packages force row level security;
alter table public.subjects force row level security;
alter table public.folders force row level security;
alter table public.categories force row level security;
alter table public.source_files force row level security;
alter table public.source_versions force row level security;
alter table public.source_chunks force row level security;
alter table public.source_processing_jobs force row level security;
alter table public.sessions force row level security;
alter table public.question_attempts force row level security;
alter table public.extension_installations force row level security;
alter table public.extension_tokens force row level security;
alter table public.audit_logs force row level security;
alter table public.notifications force row level security;
alter table public.support_tickets force row level security;
alter table public.system_settings force row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy wallets_select_own
  on public.wallets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy wallets_select_admin
  on public.wallets
  for select
  to authenticated
  using (public.is_admin());

create policy wallets_update_admin
  on public.wallets
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy credit_transactions_select_own
  on public.credit_transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy credit_transactions_select_admin
  on public.credit_transactions
  for select
  to authenticated
  using (public.is_admin());

create policy credit_transactions_insert_admin
  on public.credit_transactions
  for insert
  to authenticated
  with check (public.is_admin());

create policy payment_customers_select_admin
  on public.payment_customers
  for select
  to authenticated
  using (public.is_admin());

create policy payments_select_own
  on public.payments
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy payments_select_admin
  on public.payments
  for select
  to authenticated
  using (public.is_admin());

create policy payments_update_admin
  on public.payments
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payment_packages_select_active_public
  on public.payment_packages
  for select
  to anon, authenticated
  using (is_active = true);

create policy payment_packages_select_admin
  on public.payment_packages
  for select
  to authenticated
  using (public.is_admin());

create policy payment_packages_insert_admin
  on public.payment_packages
  for insert
  to authenticated
  with check (public.is_admin());

create policy payment_packages_update_admin
  on public.payment_packages
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy subjects_select_admin
  on public.subjects
  for select
  to authenticated
  using (public.is_admin());

create policy subjects_insert_admin
  on public.subjects
  for insert
  to authenticated
  with check (public.is_admin());

create policy subjects_update_admin
  on public.subjects
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy folders_select_admin
  on public.folders
  for select
  to authenticated
  using (public.is_admin());

create policy folders_insert_admin
  on public.folders
  for insert
  to authenticated
  with check (public.is_admin());

create policy folders_update_admin
  on public.folders
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy categories_select_admin
  on public.categories
  for select
  to authenticated
  using (public.is_admin());

create policy categories_insert_admin
  on public.categories
  for insert
  to authenticated
  with check (public.is_admin());

create policy categories_update_admin
  on public.categories
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy source_files_select_admin
  on public.source_files
  for select
  to authenticated
  using (public.is_admin());

create policy source_files_insert_admin
  on public.source_files
  for insert
  to authenticated
  with check (public.is_admin());

create policy source_files_update_admin
  on public.source_files
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy source_versions_select_admin
  on public.source_versions
  for select
  to authenticated
  using (public.is_admin());

create policy source_versions_insert_admin
  on public.source_versions
  for insert
  to authenticated
  with check (public.is_admin());

create policy source_versions_update_admin
  on public.source_versions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy source_chunks_select_admin
  on public.source_chunks
  for select
  to authenticated
  using (public.is_admin());

create policy source_chunks_insert_admin
  on public.source_chunks
  for insert
  to authenticated
  with check (public.is_admin());

create policy source_chunks_update_admin
  on public.source_chunks
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy source_processing_jobs_select_admin
  on public.source_processing_jobs
  for select
  to authenticated
  using (public.is_admin());

create policy source_processing_jobs_insert_admin
  on public.source_processing_jobs
  for insert
  to authenticated
  with check (public.is_admin());

create policy source_processing_jobs_update_admin
  on public.source_processing_jobs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy sessions_select_own
  on public.sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy sessions_select_admin
  on public.sessions
  for select
  to authenticated
  using (public.is_admin());

create policy sessions_update_admin
  on public.sessions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy question_attempts_select_own
  on public.question_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy question_attempts_select_admin
  on public.question_attempts
  for select
  to authenticated
  using (public.is_admin());

create policy extension_installations_select_own
  on public.extension_installations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy extension_installations_select_admin
  on public.extension_installations
  for select
  to authenticated
  using (public.is_admin());

create policy extension_installations_update_admin
  on public.extension_installations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy extension_tokens_super_admin_all
  on public.extension_tokens
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy audit_logs_select_admin
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

create policy audit_logs_insert_admin
  on public.audit_logs
  for insert
  to authenticated
  with check (public.is_admin());

create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy notifications_select_admin
  on public.notifications
  for select
  to authenticated
  using (public.is_admin());

create policy notifications_insert_admin
  on public.notifications
  for insert
  to authenticated
  with check (public.is_admin());

create policy notifications_update_admin
  on public.notifications
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy support_tickets_select_own
  on public.support_tickets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy support_tickets_insert_own
  on public.support_tickets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy support_tickets_select_admin
  on public.support_tickets
  for select
  to authenticated
  using (public.is_admin());

create policy support_tickets_update_admin
  on public.support_tickets
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy system_settings_super_admin_all
  on public.system_settings
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
