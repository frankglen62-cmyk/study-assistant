-- Migration: Protect Q&A pairs from accidental deletion
-- 1. Change CASCADE to RESTRICT so deleting a subject row does NOT auto-delete Q&A pairs
-- 2. Add DELETE policy restricted to admin only (service_role bypasses RLS anyway)
-- 3. Add a trigger that prevents deleting Q&A pairs unless deleted_at is set (soft-delete first)

set search_path = public, extensions;

-- Step 1: Change the FK from CASCADE to RESTRICT
-- This prevents PostgreSQL from auto-deleting Q&A pairs when a subject is deleted.
-- The application code must explicitly handle Q&A pair cleanup before deleting subjects.
alter table public.subject_qa_pairs
  drop constraint if exists subject_qa_pairs_subject_id_fkey;

alter table public.subject_qa_pairs
  add constraint subject_qa_pairs_subject_id_fkey
  foreign key (subject_id) references public.subjects (id)
  on delete restrict;

-- Step 2: Add a DELETE policy (admin only) so only admins can hard-delete rows
create policy subject_qa_pairs_delete_admin
  on public.subject_qa_pairs
  for delete
  to authenticated
  using (public.is_admin());

-- Step 3: Create a trigger function that prevents hard-deleting Q&A pairs 
-- unless they have already been soft-deleted (deleted_at IS NOT NULL).
-- This ensures the application must soft-delete first, then clean up later.
create or replace function public.protect_qa_pair_hard_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only allow hard deletion of rows that were already soft-deleted
  if OLD.deleted_at is null then
    raise exception 'Cannot hard-delete a Q&A pair that has not been soft-deleted first. Set deleted_at before deleting.';
  end if;
  return OLD;
end;
$$;

drop trigger if exists protect_qa_pair_hard_delete_trigger on public.subject_qa_pairs;
create trigger protect_qa_pair_hard_delete_trigger
  before delete on public.subject_qa_pairs
  for each row
  execute function public.protect_qa_pair_hard_delete();
