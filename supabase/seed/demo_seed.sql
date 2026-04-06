set search_path = public, extensions;

-- Demo seed assumes matching auth users already exist with the UUIDs below.
-- Create auth users first in Supabase Auth, then run this seed for app data.

insert into public.profiles (id, role, full_name, email, account_status, timezone)
values
  ('11111111-1111-1111-1111-111111111111', 'super_admin', 'Super Admin', 'superadmin@example.com', 'active', 'Asia/Manila'),
  ('22222222-2222-2222-2222-222222222222', 'admin', 'Operations Admin', 'admin@example.com', 'active', 'Asia/Manila'),
  ('33333333-3333-3333-3333-333333333333', 'client', 'Client One', 'client.one@example.com', 'active', 'Asia/Manila'),
  ('44444444-4444-4444-4444-444444444444', 'client', 'Client Two', 'client.two@example.com', 'active', 'Asia/Manila')
on conflict (id) do nothing;

insert into public.wallets (user_id, remaining_seconds, lifetime_seconds_purchased)
values
  ('33333333-3333-3333-3333-333333333333', 10800, 10800),
  ('44444444-4444-4444-4444-444444444444', 3600, 3600)
on conflict (user_id) do nothing;

insert into public.payment_packages (id, code, name, description, seconds_to_credit, amount_minor, currency, is_active, sort_order)
values
  ('55555555-5555-5555-5555-555555555551', 'one-hour', '1 Hour', 'Starter top-up package', 3600, 499, 'PHP', true, 1),
  ('55555555-5555-5555-5555-555555555552', 'three-hours', '3 Hours', 'Extended study package', 10800, 1299, 'PHP', true, 2),
  ('55555555-5555-5555-5555-555555555553', 'five-hours', '5 Hours', 'Popular top-up package', 18000, 1999, 'PHP', true, 3),
  ('55555555-5555-5555-5555-555555555554', 'ten-hours', '10 Hours', 'Best-value top-up package', 36000, 3499, 'PHP', true, 4)
on conflict (id) do nothing;

insert into public.subjects (id, name, slug, course_code, keywords, url_patterns, is_active)
values
  ('66666666-6666-6666-6666-666666666661', 'Physics', 'physics', 'PHY101', array['force', 'energy', 'velocity'], array['physics', 'phy101'], true),
  ('66666666-6666-6666-6666-666666666662', 'Mathematics', 'mathematics', 'MATH101', array['algebra', 'calculus', 'equation'], array['math', 'mathematics'], true),
  ('66666666-6666-6666-6666-666666666663', 'English', 'english', 'ENG101', array['grammar', 'essay', 'reading'], array['english', 'eng101'], true)
on conflict (id) do nothing;

insert into public.categories (id, subject_id, name, slug, default_keywords, is_active, sort_order)
values
  ('77777777-7777-7777-7777-777777777771', null, 'Semestral', 'semestral', array['semestral'], true, 1),
  ('77777777-7777-7777-7777-777777777772', null, 'Midterm', 'midterm', array['midterm'], true, 2),
  ('77777777-7777-7777-7777-777777777773', null, 'Finals', 'finals', array['finals'], true, 3),
  ('77777777-7777-7777-7777-777777777774', null, 'Quiz', 'quiz', array['quiz'], true, 4),
  ('77777777-7777-7777-7777-777777777775', null, 'Reviewer', 'reviewer', array['reviewer'], true, 5)
on conflict do nothing;

insert into public.folders (id, parent_id, subject_id, folder_type, name, slug, sort_order, is_active, created_by)
values
  ('88888888-8888-8888-8888-888888888861', null, '66666666-6666-6666-6666-666666666661', 'subject_root', 'Physics', 'physics', 1, true, '22222222-2222-2222-2222-222222222222'),
  ('88888888-8888-8888-8888-888888888862', null, '66666666-6666-6666-6666-666666666662', 'subject_root', 'Mathematics', 'mathematics', 2, true, '22222222-2222-2222-2222-222222222222'),
  ('88888888-8888-8888-8888-888888888863', null, '66666666-6666-6666-6666-666666666663', 'subject_root', 'English', 'english', 3, true, '22222222-2222-2222-2222-222222222222'),
  ('88888888-8888-8888-8888-888888888871', '88888888-8888-8888-8888-888888888861', '66666666-6666-6666-6666-666666666661', 'category', 'Midterm', 'midterm', 1, true, '22222222-2222-2222-2222-222222222222')
on conflict do nothing;

insert into public.source_files (
  id, folder_id, subject_id, category_id, title, original_filename, storage_bucket, storage_path,
  mime_type, file_size_bytes, source_status, version_number, source_priority, uploaded_by, activated_at
)
values
  (
    '99999999-9999-9999-9999-999999999991',
    '88888888-8888-8888-8888-888888888871',
    '66666666-6666-6666-6666-666666666661',
    '77777777-7777-7777-7777-777777777772',
    'Physics Midterm Reviewer',
    'physics-midterm-reviewer.pdf',
    'private-sources',
    'physics/physics-midterm-reviewer-v1.pdf',
    'application/pdf',
    245760,
    'active',
    1,
    10,
    '22222222-2222-2222-2222-222222222222',
    now()
  )
on conflict do nothing;

insert into public.source_chunks (
  id, source_file_id, subject_id, category_id, folder_id, chunk_index, page_number, heading,
  text_content, text_hash, token_count, metadata, is_active
)
values
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    '99999999-9999-9999-9999-999999999991',
    '66666666-6666-6666-6666-666666666661',
    '77777777-7777-7777-7777-777777777772',
    '88888888-8888-8888-8888-888888888871',
    0,
    1,
    'Dynamics',
    'Force is equal to mass multiplied by acceleration. Velocity describes speed with direction.',
    '8d4b6a9107120d0c6bd7e6e7f31c0bc21f3d97f308b7933ce4c0b9aa5e2df441',
    22,
    '{"file_name":"physics-midterm-reviewer.pdf","subject":"Physics","category":"Midterm"}',
    true
  )
on conflict do nothing;

insert into public.sessions (
  id, user_id, status, start_time, end_time, last_activity_at, current_subject_id, current_category_id,
  detection_mode, used_seconds, page_url, page_domain, page_title
)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '33333333-3333-3333-3333-333333333333',
    'ended',
    now() - interval '2 days',
    now() - interval '2 days' + interval '12 minutes',
    now() - interval '2 days' + interval '11 minutes',
    '66666666-6666-6666-6666-666666666661',
    '77777777-7777-7777-7777-777777777772',
    'auto',
    720,
    'https://lms.example.com/physics/midterm',
    'lms.example.com',
    'Physics Midterm Quiz'
  )
on conflict do nothing;
