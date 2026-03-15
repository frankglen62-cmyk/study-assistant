set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.app_role as enum ('super_admin', 'admin', 'client');
create type public.account_status as enum ('active', 'suspended', 'pending_verification', 'banned');
create type public.wallet_status as enum ('active', 'locked');
create type public.credit_transaction_type as enum (
  'purchase',
  'usage_debit',
  'admin_adjustment_add',
  'admin_adjustment_subtract',
  'refund',
  'promo',
  'expiration',
  'restoration'
);
create type public.payment_provider as enum ('stripe', 'paymongo');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'canceled', 'refunded');
create type public.payment_type as enum ('topup', 'subscription');
create type public.folder_type as enum ('subject_root', 'category', 'custom');
create type public.source_status as enum ('draft', 'processing', 'active', 'archived', 'failed');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');
create type public.session_status as enum (
  'active',
  'paused',
  'ended',
  'timed_out',
  'no_credit',
  'no_match',
  'failed'
);
create type public.detection_mode as enum ('auto', 'manual');
create type public.installation_status as enum ('active', 'revoked');
create type public.support_ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text not null check (btrim(full_name) <> ''),
  email text not null check (btrim(email) <> ''),
  avatar_url text,
  account_status public.account_status not null default 'pending_verification',
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);

create unique index profiles_email_lower_uidx on public.profiles (lower(email));
create index profiles_role_status_idx on public.profiles (role, account_status);
create index profiles_created_at_idx on public.profiles (created_at desc);

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  remaining_seconds integer not null default 0 check (remaining_seconds >= 0),
  lifetime_seconds_purchased integer not null default 0 check (lifetime_seconds_purchased >= 0),
  lifetime_seconds_used integer not null default 0 check (lifetime_seconds_used >= 0),
  status public.wallet_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wallets_status_idx on public.wallets (status);
create index wallets_remaining_seconds_idx on public.wallets (remaining_seconds);

create table public.payment_packages (
  id uuid primary key default gen_random_uuid(),
  code text not null check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  description text not null default '',
  seconds_to_credit integer not null check (seconds_to_credit > 0),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (btrim(currency) <> ''),
  is_active boolean not null default true,
  provider_price_reference text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_packages_code_key unique (code)
);

create unique index payment_packages_provider_price_reference_uidx
  on public.payment_packages (provider_price_reference)
  where provider_price_reference is not null;
create index payment_packages_active_sort_idx on public.payment_packages (is_active, sort_order, created_at desc);

create table public.payment_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.payment_provider not null,
  provider_customer_id text not null check (btrim(provider_customer_id) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_customers_user_provider_key unique (user_id, provider),
  constraint payment_customers_provider_customer_key unique (provider, provider_customer_id)
);

create index payment_customers_created_at_idx on public.payment_customers (created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  provider public.payment_provider not null,
  provider_payment_id text not null check (btrim(provider_payment_id) <> ''),
  provider_checkout_session_id text,
  package_id uuid references public.payment_packages (id) on delete set null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (btrim(currency) <> ''),
  status public.payment_status not null default 'pending',
  payment_type public.payment_type not null default 'topup',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint payments_provider_payment_key unique (provider, provider_payment_id)
);

create unique index payments_checkout_session_uidx
  on public.payments (provider_checkout_session_id)
  where provider_checkout_session_id is not null;
create index payments_user_created_at_idx on public.payments (user_id, created_at desc);
create index payments_status_created_at_idx on public.payments (status, created_at desc);
create index payments_provider_status_idx on public.payments (provider, status, created_at desc);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  slug text not null check (btrim(slug) <> ''),
  course_code text,
  department text,
  description text,
  keywords text[] not null default '{}'::text[],
  url_patterns text[] not null default '{}'::text[],
  icon text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_slug_key unique (slug)
);

create unique index subjects_course_code_uidx
  on public.subjects (lower(course_code))
  where course_code is not null;
create index subjects_active_name_idx on public.subjects (is_active, name);
create index subjects_keywords_gin_idx on public.subjects using gin (keywords);
create index subjects_url_patterns_gin_idx on public.subjects using gin (url_patterns);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.folders (id) on delete restrict,
  subject_id uuid references public.subjects (id) on delete restrict,
  folder_type public.folder_type not null,
  name text not null check (btrim(name) <> ''),
  slug text not null check (btrim(slug) <> ''),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_subject_root_shape_chk check (
    (folder_type = 'subject_root' and parent_id is null and subject_id is not null)
    or (folder_type in ('category', 'custom') and parent_id is not null)
  ),
  constraint folders_archived_deleted_chk check (
    not (archived_at is not null and deleted_at is not null)
  )
);

create unique index folders_subject_root_uidx
  on public.folders (subject_id)
  where folder_type = 'subject_root' and deleted_at is null;
create unique index folders_root_slug_uidx
  on public.folders (slug)
  where parent_id is null and deleted_at is null;
create unique index folders_parent_slug_uidx
  on public.folders (parent_id, slug)
  where parent_id is not null and deleted_at is null;
create index folders_subject_parent_sort_idx on public.folders (subject_id, parent_id, sort_order, created_at);
create index folders_active_lookup_idx on public.folders (is_active, deleted_at, archived_at);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.subjects (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  slug text not null check (btrim(slug) <> ''),
  description text,
  default_keywords text[] not null default '{}'::text[],
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index categories_global_slug_uidx
  on public.categories (slug)
  where subject_id is null;
create unique index categories_subject_slug_uidx
  on public.categories (subject_id, slug)
  where subject_id is not null;
create index categories_subject_sort_idx on public.categories (subject_id, sort_order, created_at);
create index categories_keywords_gin_idx on public.categories using gin (default_keywords);

create table public.source_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.folders (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  title text not null check (btrim(title) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  storage_bucket text not null default 'private-sources' check (btrim(storage_bucket) <> ''),
  storage_path text not null check (btrim(storage_path) <> ''),
  mime_type text not null check (btrim(mime_type) <> ''),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  source_status public.source_status not null default 'draft',
  processing_error text,
  version_number integer not null default 1 check (version_number > 0),
  source_priority integer not null default 0,
  tags text[] not null default '{}'::text[],
  description text,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  constraint source_files_storage_location_key unique (storage_bucket, storage_path),
  constraint source_files_archived_deleted_chk check (
    not (archived_at is not null and deleted_at is not null)
  )
);

create index source_files_folder_status_idx on public.source_files (folder_id, source_status, created_at desc);
create index source_files_subject_category_idx on public.source_files (subject_id, category_id, source_status, created_at desc);
create index source_files_active_retrieval_idx
  on public.source_files (subject_id, category_id, source_priority desc, activated_at desc)
  where source_status = 'active' and deleted_at is null;
create index source_files_tags_gin_idx on public.source_files using gin (tags);
create index source_files_title_trgm_idx on public.source_files using gin (title gin_trgm_ops);

create table public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_path text not null check (btrim(storage_path) <> ''),
  change_note text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint source_versions_file_version_key unique (source_file_id, version_number)
);

create index source_versions_source_created_at_idx on public.source_versions (source_file_id, created_at desc);

create table public.source_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  job_status public.job_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retries integer not null default 0 check (retries >= 0),
  created_at timestamptz not null default now()
);

create unique index source_processing_jobs_active_uidx
  on public.source_processing_jobs (source_file_id)
  where job_status in ('queued', 'processing');
create index source_processing_jobs_status_idx on public.source_processing_jobs (job_status, created_at desc);

create table public.source_chunks (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.source_files (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  folder_id uuid references public.folders (id) on delete set null,
  chunk_index integer not null check (chunk_index >= 0),
  page_number integer check (page_number is null or page_number > 0),
  heading text,
  text_content text not null check (btrim(text_content) <> ''),
  text_hash text not null check (char_length(text_hash) >= 32),
  token_count integer not null check (token_count > 0),
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index source_chunks_active_hash_uidx
  on public.source_chunks (source_file_id, text_hash)
  where is_active = true;
create index source_chunks_file_chunk_idx on public.source_chunks (source_file_id, chunk_index);
create index source_chunks_scope_idx on public.source_chunks (subject_id, category_id, source_file_id)
  where is_active = true;
create index source_chunks_metadata_gin_idx on public.source_chunks using gin (metadata);

create table public.extension_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_name text,
  browser_name text,
  extension_version text,
  installation_status public.installation_status not null default 'active',
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index extension_installations_user_status_idx
  on public.extension_installations (user_id, installation_status, created_at desc);
create index extension_installations_last_seen_idx on public.extension_installations (last_seen_at desc);

create table public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.extension_installations (id) on delete cascade,
  token_hash text not null check (char_length(token_hash) >= 32),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint extension_tokens_token_hash_key unique (token_hash)
);

create index extension_tokens_installation_expires_idx
  on public.extension_tokens (installation_id, expires_at desc);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  extension_installation_id uuid references public.extension_installations (id) on delete set null,
  status public.session_status not null default 'active',
  start_time timestamptz not null default now(),
  end_time timestamptz,
  last_activity_at timestamptz,
  current_subject_id uuid references public.subjects (id) on delete set null,
  current_category_id uuid references public.categories (id) on delete set null,
  detection_mode public.detection_mode not null default 'auto',
  used_seconds integer not null default 0 check (used_seconds >= 0),
  page_url text,
  page_domain text,
  page_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_status_idx on public.sessions (user_id, status, start_time desc);
create index sessions_installation_status_idx on public.sessions (extension_installation_id, status, start_time desc);
create index sessions_subject_category_idx on public.sessions (current_subject_id, current_category_id, start_time desc);
create unique index sessions_single_open_session_uidx
  on public.sessions (user_id)
  where status in ('active', 'paused') and end_time is null;

create table public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  page_url text,
  page_title text,
  extracted_question_text text,
  extracted_options jsonb,
  selected_subject_id uuid references public.subjects (id) on delete set null,
  detected_subject_id uuid references public.subjects (id) on delete set null,
  selected_category_id uuid references public.categories (id) on delete set null,
  detected_category_id uuid references public.categories (id) on delete set null,
  detection_confidence numeric(5, 4) check (
    detection_confidence is null or (detection_confidence >= 0 and detection_confidence <= 1)
  ),
  retrieval_confidence numeric(5, 4) check (
    retrieval_confidence is null or (retrieval_confidence >= 0 and retrieval_confidence <= 1)
  ),
  final_confidence numeric(5, 4) check (
    final_confidence is null or (final_confidence >= 0 and final_confidence <= 1)
  ),
  answer_text text,
  short_explanation text,
  answer_schema jsonb not null default '{}'::jsonb,
  no_match_reason text,
  processing_ms integer check (processing_ms is null or processing_ms >= 0),
  model_used text,
  created_at timestamptz not null default now()
);

create index question_attempts_session_created_idx on public.question_attempts (session_id, created_at desc);
create index question_attempts_user_created_idx on public.question_attempts (user_id, created_at desc);
create index question_attempts_subject_category_idx
  on public.question_attempts (detected_subject_id, detected_category_id, created_at desc);
create index question_attempts_confidence_idx
  on public.question_attempts (final_confidence, detection_confidence, retrieval_confidence, created_at desc);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  transaction_type public.credit_transaction_type not null,
  delta_seconds integer not null check (delta_seconds <> 0),
  balance_after_seconds integer not null check (balance_after_seconds >= 0),
  related_payment_id uuid references public.payments (id) on delete set null,
  related_session_id uuid references public.sessions (id) on delete set null,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);
create index credit_transactions_wallet_created_idx on public.credit_transactions (wallet_id, created_at desc);
create index credit_transactions_payment_idx on public.credit_transactions (related_payment_id);
create index credit_transactions_session_idx on public.credit_transactions (related_session_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_role public.app_role,
  event_type text not null check (btrim(event_type) <> ''),
  entity_type text not null check (btrim(entity_type) <> ''),
  entity_id text,
  event_summary text not null check (btrim(event_summary) <> ''),
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_created_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_event_created_idx on public.audit_logs (event_type, created_at desc);
create index audit_logs_entity_created_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  notification_type text not null check (btrim(notification_type) <> ''),
  title text not null check (btrim(title) <> ''),
  body text not null check (btrim(body) <> ''),
  is_read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id, is_read, created_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (btrim(subject) <> ''),
  message text not null check (btrim(message) <> ''),
  status public.support_ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_status_idx on public.support_tickets (user_id, status, created_at desc);
create index support_tickets_status_created_idx on public.support_tickets (status, created_at desc);

create table public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint system_settings_key_chk check (btrim(key) <> '')
);
