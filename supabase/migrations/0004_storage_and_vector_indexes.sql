set search_path = public, extensions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-sources',
  'private-sources',
  false,
  104857600,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No browser-facing storage policies are created for private-sources.
-- Admin uploads and all retrieval flow through server-side privileged code.

create index source_chunks_embedding_hnsw_idx
  on public.source_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 96)
  where is_active = true and embedding is not null;

create index source_chunks_retrieval_filter_idx
  on public.source_chunks (subject_id, category_id, folder_id, source_file_id)
  where is_active = true;

create index source_files_processing_status_idx
  on public.source_files (source_status, updated_at desc)
  where deleted_at is null;

create index folders_name_trgm_idx on public.folders using gin (name gin_trgm_ops);
create index subjects_name_trgm_idx on public.subjects using gin (name gin_trgm_ops);
create index categories_name_trgm_idx on public.categories using gin (name gin_trgm_ops);
