import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf8');
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
  }

  return result;
}

const env = {
  ...loadEnvFile(path.join(webRoot, '.env.local')),
  ...process.env,
};

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ids = {
  subjectId: '66666666-6666-6666-6666-666666666664',
  fallbackSemestralCategoryId: '77777777-7777-7777-7777-777777777771',
  rootFolderId: '88888888-8888-8888-8888-888888888864',
  semestralFolderId: '88888888-8888-8888-8888-888888888874',
  sourceFileId: '99999999-9999-9999-9999-999999999992',
  sourceVersionId: '99999999-9999-9999-9999-999999999993',
  processingJobId: '99999999-9999-9999-9999-999999999994',
};

const subject = {
  id: ids.subjectId,
  name: 'Early Childhood Care and Education',
  slug: 'early-childhood-care-and-education',
  course_code: 'ECCE101',
  department: 'Teacher Education',
  description: 'Seeded ECCE subject for safe extension testing on a local mock practice page.',
  keywords: [
    'early childhood care and education',
    'ecce',
    'toddlers',
    'play based learning',
    'cognitive development',
    'social value of play',
    'age appropriate activities',
  ],
  url_patterns: [
    'practice/ecce-sample',
    'early-childhood-care-and-education',
    'digital.nios.ac.in/content/376en',
    'sample-question-paper-ecce',
  ],
  is_active: true,
};

const sourceChunks = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
    chunk_index: 0,
    page_number: 1,
    heading: 'Teaching learning process in ECCE',
    text_content:
      'In an ECCE centre, the teaching learning process should be activity and play based. Young children learn best through guided play, participation, exploration, songs, storytelling, and hands on activities rather than passive instruction alone.',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3',
    chunk_index: 1,
    page_number: 1,
    heading: 'Cognitive development milestones in toddlers',
    text_content:
      'An important milestone of cognitive development in toddlers is distinguishing between you and me. This shows emerging self awareness, social recognition, and early cognitive differentiation.',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',
    chunk_index: 2,
    page_number: 2,
    heading: 'Social value of play',
    text_content:
      'The social value of play includes developing friendly relationships, cooperation, sharing, and respect for others. It supports social interaction and group participation more directly than isolated physical coordination alone.',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5',
    chunk_index: 3,
    page_number: 2,
    heading: 'Indicators of development and progress',
    text_content:
      'An important indicator of development and progress of children is enjoying and coping well with age appropriate activities. Healthy engagement with suitable activities usually reflects steady development and adjustment.',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6',
    chunk_index: 4,
    page_number: 3,
    heading: 'Short answers reviewer',
    text_content:
      'Solitary play means a child plays alone while remaining engaged in an activity. Kinesthetic refers to learning or understanding through body movement and physical activity. The pre operational stage is the early childhood stage described by Piaget when symbolic thinking develops but logical operations are still limited.',
  },
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function tokenCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

async function ensureSemestralCategory() {
  const existing = await supabase
    .from('categories')
    .select('id')
    .eq('slug', 'semestral')
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to query semestral category: ${existing.error.message}`);
  }

  if (existing.data?.id) {
    return existing.data.id;
  }

  const inserted = await supabase.from('categories').insert({
    id: ids.fallbackSemestralCategoryId,
    subject_id: null,
    name: 'Semestral',
    slug: 'semestral',
    description: 'Global semestral category.',
    default_keywords: ['semestral'],
    is_active: true,
    sort_order: 1,
  });

  if (inserted.error) {
    throw new Error(`Failed to create semestral category: ${inserted.error.message}`);
  }

  return ids.fallbackSemestralCategoryId;
}

async function resolveActorUserId() {
  const response = await supabase
    .from('profiles')
    .select('id, email, role')
    .in('role', ['super_admin', 'admin'])
    .eq('account_status', 'active')
    .order('role', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (response.error) {
    throw new Error(`Failed to resolve admin actor: ${response.error.message}`);
  }

  if (!response.data?.id) {
    throw new Error('No active admin or super_admin profile was found for seeding.');
  }

  return response.data.id;
}

async function main() {
  const semestralCategoryId = await ensureSemestralCategory();
  const actorUserId = await resolveActorUserId();

  const subjectResult = await supabase.from('subjects').upsert(subject, { onConflict: 'id' });
  if (subjectResult.error) {
    throw new Error(`Failed to seed ECCE subject: ${subjectResult.error.message}`);
  }

  const foldersResult = await supabase.from('folders').upsert(
    [
      {
        id: ids.rootFolderId,
        parent_id: null,
        subject_id: ids.subjectId,
        folder_type: 'subject_root',
        name: 'Early Childhood Care and Education',
        slug: 'early-childhood-care-and-education',
        sort_order: 4,
        is_active: true,
        created_by: actorUserId,
      },
      {
        id: ids.semestralFolderId,
        parent_id: ids.rootFolderId,
        subject_id: ids.subjectId,
        folder_type: 'category',
        name: 'Semestral',
        slug: 'semestral',
        sort_order: 1,
        is_active: true,
        created_by: actorUserId,
      },
    ],
    { onConflict: 'id' },
  );

  if (foldersResult.error) {
    throw new Error(`Failed to seed ECCE folders: ${foldersResult.error.message}`);
  }

  const sourceFileResult = await supabase.from('source_files').upsert(
    {
      id: ids.sourceFileId,
      folder_id: ids.semestralFolderId,
      subject_id: ids.subjectId,
      category_id: semestralCategoryId,
      title: 'ECCE Semestral Reviewer',
      original_filename: 'ecce-semestral-reviewer.txt',
      storage_bucket: 'private-sources',
      storage_path: 'demo/ecce-semestral-reviewer.txt',
      mime_type: 'text/plain',
      file_size_bytes: 4096,
      source_status: 'active',
      version_number: 1,
      source_priority: 15,
      tags: ['ecce', 'semestral', 'reviewer', 'demo'],
      description: 'Seeded reviewer for safe mock extension testing.',
      uploaded_by: actorUserId,
      activated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (sourceFileResult.error) {
    throw new Error(`Failed to seed ECCE source file: ${sourceFileResult.error.message}`);
  }

  const versionResult = await supabase.from('source_versions').upsert(
    {
      id: ids.sourceVersionId,
      source_file_id: ids.sourceFileId,
      version_number: 1,
      storage_path: 'demo/ecce-semestral-reviewer.txt',
      change_note: 'Initial seeded ECCE reviewer version.',
      created_by: actorUserId,
    },
    { onConflict: 'id' },
  );

  if (versionResult.error) {
    throw new Error(`Failed to seed ECCE source version: ${versionResult.error.message}`);
  }

  const processingJobResult = await supabase.from('source_processing_jobs').upsert(
    {
      id: ids.processingJobId,
      source_file_id: ids.sourceFileId,
      job_status: 'completed',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      retries: 0,
    },
    { onConflict: 'id' },
  );

  if (processingJobResult.error) {
    throw new Error(`Failed to seed ECCE processing job: ${processingJobResult.error.message}`);
  }

  const chunksResult = await supabase.from('source_chunks').upsert(
    sourceChunks.map((chunk) => ({
      id: chunk.id,
      source_file_id: ids.sourceFileId,
      subject_id: ids.subjectId,
      category_id: semestralCategoryId,
      folder_id: ids.semestralFolderId,
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      heading: chunk.heading,
      text_content: chunk.text_content,
      text_hash: sha256(chunk.text_content),
      token_count: tokenCount(chunk.text_content),
      metadata: {
        file_name: 'ecce-semestral-reviewer.txt',
        subject: subject.name,
        category: 'Semestral',
        seeded: true,
      },
      is_active: true,
    })),
    { onConflict: 'id' },
  );

  if (chunksResult.error) {
    throw new Error(`Failed to seed ECCE chunks: ${chunksResult.error.message}`);
  }

  const verification = await supabase
    .from('source_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', ids.subjectId);

  if (verification.error) {
    throw new Error(`Failed to verify ECCE chunks: ${verification.error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        subject: subject.name,
        category: 'Semestral',
        sourceFileId: ids.sourceFileId,
        chunkCount: verification.count ?? sourceChunks.length,
        practiceUrl: 'http://localhost:3000/practice/ecce-sample',
      },
      null,
      2,
    ),
  );
}

await main();
