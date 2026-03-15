set search_path = public, extensions;

create table if not exists public.subject_qa_pairs (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  question_text text not null check (btrim(question_text) <> ''),
  answer_text text not null check (btrim(answer_text) <> ''),
  short_explanation text,
  keywords text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subject_qa_pairs_subject_category_idx
  on public.subject_qa_pairs (subject_id, category_id, is_active, sort_order, updated_at desc)
  where deleted_at is null;

create index if not exists subject_qa_pairs_subject_active_idx
  on public.subject_qa_pairs (subject_id, is_active, updated_at desc)
  where deleted_at is null;

create index if not exists subject_qa_pairs_keywords_gin_idx
  on public.subject_qa_pairs using gin (keywords);

create index if not exists subject_qa_pairs_question_trgm_idx
  on public.subject_qa_pairs using gin (question_text gin_trgm_ops);

create index if not exists subject_qa_pairs_answer_trgm_idx
  on public.subject_qa_pairs using gin (answer_text gin_trgm_ops);

alter table public.subject_qa_pairs enable row level security;
alter table public.subject_qa_pairs force row level security;

create policy subject_qa_pairs_select_admin
  on public.subject_qa_pairs
  for select
  to authenticated
  using (public.is_admin());

create policy subject_qa_pairs_insert_admin
  on public.subject_qa_pairs
  for insert
  to authenticated
  with check (public.is_admin());

create policy subject_qa_pairs_update_admin
  on public.subject_qa_pairs
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists subject_qa_pairs_set_updated_at on public.subject_qa_pairs;
create trigger subject_qa_pairs_set_updated_at
before update on public.subject_qa_pairs
for each row
execute function public.set_updated_at();
