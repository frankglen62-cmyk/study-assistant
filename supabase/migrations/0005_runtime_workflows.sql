set search_path = public, extensions;

create table public.extension_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null unique check (char_length(code_hash) >= 32),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_installation_id uuid references public.extension_installations (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index extension_pairing_codes_user_idx
  on public.extension_pairing_codes (user_id, created_at desc);

create index extension_pairing_codes_expiry_idx
  on public.extension_pairing_codes (expires_at)
  where used_at is null;

alter table public.extension_pairing_codes enable row level security;

create policy extension_pairing_codes_select_own
  on public.extension_pairing_codes
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy extension_pairing_codes_insert_own
  on public.extension_pairing_codes
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy extension_pairing_codes_update_admin
  on public.extension_pairing_codes
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

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
begin
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

  if p_transaction_type in ('purchase', 'admin_adjustment_add', 'promo', 'restoration') and p_delta_seconds > 0 then
    purchased_increment := p_delta_seconds;
  end if;

  if p_transaction_type = 'usage_debit' and p_delta_seconds < 0 then
    used_increment := abs(p_delta_seconds);
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
  );

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

create or replace function public.match_source_chunks(
  p_query_embedding extensions.vector(1536),
  p_subject_id uuid,
  p_category_id uuid default null,
  p_match_count integer default 8,
  p_min_similarity double precision default 0.55
)
returns table (
  chunk_id uuid,
  source_file_id uuid,
  subject_id uuid,
  category_id uuid,
  folder_id uuid,
  heading text,
  text_content text,
  similarity double precision,
  source_title text,
  source_priority integer,
  chunk_metadata jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    sc.id as chunk_id,
    sc.source_file_id,
    sc.subject_id,
    sc.category_id,
    sc.folder_id,
    sc.heading,
    sc.text_content,
    1 - (sc.embedding <=> p_query_embedding) as similarity,
    sf.title as source_title,
    sf.source_priority,
    sc.metadata as chunk_metadata
  from public.source_chunks as sc
  inner join public.source_files as sf
    on sf.id = sc.source_file_id
  where sc.is_active = true
    and sc.embedding is not null
    and sf.deleted_at is null
    and sf.archived_at is null
    and sf.source_status = 'active'
    and sc.subject_id = p_subject_id
    and (p_category_id is null or sc.category_id is null or sc.category_id = p_category_id)
    and (1 - (sc.embedding <=> p_query_embedding)) >= p_min_similarity
  order by similarity desc, sf.source_priority desc, sc.created_at desc
  limit greatest(p_match_count, 1);
$$;

grant execute on function public.match_source_chunks(
  extensions.vector,
  uuid,
  uuid,
  integer,
  double precision
) to service_role;
