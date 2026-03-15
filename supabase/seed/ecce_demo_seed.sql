set search_path = public, extensions;

insert into public.subjects (
  id,
  name,
  slug,
  course_code,
  department,
  description,
  keywords,
  url_patterns,
  is_active
)
values (
  '66666666-6666-6666-6666-666666666664',
  'Early Childhood Care and Education',
  'early-childhood-care-and-education',
  'ECCE101',
  'Teacher Education',
  'Seeded ECCE subject for safe extension testing on a local mock practice page.',
  array[
    'early childhood care and education',
    'ecce',
    'toddlers',
    'play based learning',
    'cognitive development',
    'social value of play',
    'age appropriate activities'
  ],
  array[
    'practice/ecce-sample',
    'early-childhood-care-and-education',
    'digital.nios.ac.in/content/376en',
    'sample-question-paper-ecce'
  ],
  true
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  course_code = excluded.course_code,
  department = excluded.department,
  description = excluded.description,
  keywords = excluded.keywords,
  url_patterns = excluded.url_patterns,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.folders (
  id,
  parent_id,
  subject_id,
  folder_type,
  name,
  slug,
  sort_order,
  is_active,
  created_by
)
values
  (
    '88888888-8888-8888-8888-888888888864',
    null,
    '66666666-6666-6666-6666-666666666664',
    'subject_root',
    'Early Childhood Care and Education',
    'early-childhood-care-and-education',
    4,
    true,
    '22222222-2222-2222-2222-222222222222'
  ),
  (
    '88888888-8888-8888-8888-888888888874',
    '88888888-8888-8888-8888-888888888864',
    '66666666-6666-6666-6666-666666666664',
    'category',
    'Semestral',
    'semestral',
    1,
    true,
    '22222222-2222-2222-2222-222222222222'
  )
on conflict (id) do update
set
  parent_id = excluded.parent_id,
  subject_id = excluded.subject_id,
  folder_type = excluded.folder_type,
  name = excluded.name,
  slug = excluded.slug,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.source_files (
  id,
  folder_id,
  subject_id,
  category_id,
  title,
  original_filename,
  storage_bucket,
  storage_path,
  mime_type,
  file_size_bytes,
  source_status,
  version_number,
  source_priority,
  tags,
  description,
  uploaded_by,
  activated_at
)
values (
  '99999999-9999-9999-9999-999999999992',
  '88888888-8888-8888-8888-888888888874',
  '66666666-6666-6666-6666-666666666664',
  '77777777-7777-7777-7777-777777777771',
  'ECCE Semestral Reviewer',
  'ecce-semestral-reviewer.txt',
  'private-sources',
  'demo/ecce-semestral-reviewer.txt',
  'text/plain',
  4096,
  'active',
  1,
  15,
  array['ecce', 'semestral', 'reviewer', 'demo'],
  'Seeded reviewer for safe mock extension testing.',
  '22222222-2222-2222-2222-222222222222',
  now()
)
on conflict (id) do update
set
  folder_id = excluded.folder_id,
  subject_id = excluded.subject_id,
  category_id = excluded.category_id,
  title = excluded.title,
  original_filename = excluded.original_filename,
  storage_bucket = excluded.storage_bucket,
  storage_path = excluded.storage_path,
  mime_type = excluded.mime_type,
  file_size_bytes = excluded.file_size_bytes,
  source_status = excluded.source_status,
  version_number = excluded.version_number,
  source_priority = excluded.source_priority,
  tags = excluded.tags,
  description = excluded.description,
  uploaded_by = excluded.uploaded_by,
  activated_at = excluded.activated_at,
  updated_at = now();

insert into public.source_versions (
  id,
  source_file_id,
  version_number,
  storage_path,
  change_note,
  created_by
)
values (
  '99999999-9999-9999-9999-999999999993',
  '99999999-9999-9999-9999-999999999992',
  1,
  'demo/ecce-semestral-reviewer.txt',
  'Initial seeded ECCE reviewer version.',
  '22222222-2222-2222-2222-222222222222'
)
on conflict (id) do update
set
  source_file_id = excluded.source_file_id,
  version_number = excluded.version_number,
  storage_path = excluded.storage_path,
  change_note = excluded.change_note,
  created_by = excluded.created_by;

insert into public.source_processing_jobs (
  id,
  source_file_id,
  job_status,
  started_at,
  completed_at,
  retries
)
values (
  '99999999-9999-9999-9999-999999999994',
  '99999999-9999-9999-9999-999999999992',
  'completed',
  now(),
  now(),
  0
)
on conflict (id) do update
set
  source_file_id = excluded.source_file_id,
  job_status = excluded.job_status,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  retries = excluded.retries;

insert into public.source_chunks (
  id,
  source_file_id,
  subject_id,
  category_id,
  folder_id,
  chunk_index,
  page_number,
  heading,
  text_content,
  text_hash,
  token_count,
  metadata,
  is_active
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    '99999999-9999-9999-9999-999999999992',
    '66666666-6666-6666-6666-666666666664',
    '77777777-7777-7777-7777-777777777771',
    '88888888-8888-8888-8888-888888888874',
    0,
    1,
    'Teaching learning process in ECCE',
    'In an ECCE centre, the teaching learning process should be activity and play based. Young children learn best through guided play, participation, exploration, songs, storytelling, and hands on activities rather than passive instruction alone.',
    '82f2eb57f73eb64d7b6188c4a4436be63d20e2951c99cf2fc03fb7f0f95bf26d',
    34,
    '{"file_name":"ecce-semestral-reviewer.txt","subject":"Early Childhood Care and Education","category":"Semestral","seeded":true}',
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    '99999999-9999-9999-9999-999999999992',
    '66666666-6666-6666-6666-666666666664',
    '77777777-7777-7777-7777-777777777771',
    '88888888-8888-8888-8888-888888888874',
    1,
    1,
    'Cognitive development milestones in toddlers',
    'An important milestone of cognitive development in toddlers is distinguishing between you and me. This shows emerging self awareness, social recognition, and early cognitive differentiation.',
    '2fe7171cf6e110cd1d7d7ba1dc6cd4dbf30ae839db7d6114b2ec33ed08c1f0cf',
    24,
    '{"file_name":"ecce-semestral-reviewer.txt","subject":"Early Childhood Care and Education","category":"Semestral","seeded":true}',
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    '99999999-9999-9999-9999-999999999992',
    '66666666-6666-6666-6666-666666666664',
    '77777777-7777-7777-7777-777777777771',
    '88888888-8888-8888-8888-888888888874',
    2,
    2,
    'Social value of play',
    'The social value of play includes developing friendly relationships, cooperation, sharing, and respect for others. It supports social interaction and group participation more directly than isolated physical coordination alone.',
    '0c5c0b8ac4d50c9750a6a699d6d695e38c70ef4944c5ff9ec1340c5b409855ab',
    26,
    '{"file_name":"ecce-semestral-reviewer.txt","subject":"Early Childhood Care and Education","category":"Semestral","seeded":true}',
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    '99999999-9999-9999-9999-999999999992',
    '66666666-6666-6666-6666-666666666664',
    '77777777-7777-7777-7777-777777777771',
    '88888888-8888-8888-8888-888888888874',
    3,
    2,
    'Indicators of development and progress',
    'An important indicator of development and progress of children is enjoying and coping well with age appropriate activities. Healthy engagement with suitable activities usually reflects steady development and adjustment.',
    '10ecb5a6e3dace0ec9555f9f54f7ff10a4c312d2ef0c89778a8270f8492c6ca0',
    27,
    '{"file_name":"ecce-semestral-reviewer.txt","subject":"Early Childhood Care and Education","category":"Semestral","seeded":true}',
    true
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
    '99999999-9999-9999-9999-999999999992',
    '66666666-6666-6666-6666-666666666664',
    '77777777-7777-7777-7777-777777777771',
    '88888888-8888-8888-8888-888888888874',
    4,
    3,
    'Short answers reviewer',
    'Solitary play means a child plays alone while remaining engaged in an activity. Kinesthetic refers to learning or understanding through body movement and physical activity. The pre operational stage is the early childhood stage described by Piaget when symbolic thinking develops but logical operations are still limited.',
    'ee2db109f305c5249d71629fc0dcb565d157a2dbab29181a67c7c7e558ddfda5',
    42,
    '{"file_name":"ecce-semestral-reviewer.txt","subject":"Early Childhood Care and Education","category":"Semestral","seeded":true}',
    true
  )
on conflict (id) do update
set
  source_file_id = excluded.source_file_id,
  subject_id = excluded.subject_id,
  category_id = excluded.category_id,
  folder_id = excluded.folder_id,
  chunk_index = excluded.chunk_index,
  page_number = excluded.page_number,
  heading = excluded.heading,
  text_content = excluded.text_content,
  text_hash = excluded.text_hash,
  token_count = excluded.token_count,
  metadata = excluded.metadata,
  is_active = excluded.is_active;
