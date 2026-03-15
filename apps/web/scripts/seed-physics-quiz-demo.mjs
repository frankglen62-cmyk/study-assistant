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
  subjectId: '66666666-6666-6666-6666-666666666661',
  quizCategoryId: '77777777-7777-7777-7777-777777777774',
  rootFolderId: '88888888-8888-8888-8888-888888888861',
  quizFolderId: '88888888-8888-8888-8888-888888888872',
  sourceFileId: '99999999-9999-9999-9999-999999999995',
  sourceVersionId: '99999999-9999-9999-9999-999999999996',
  processingJobId: '99999999-9999-9999-9999-999999999997',
};

const physicsSubject = {
  id: ids.subjectId,
  name: 'Physics',
  slug: 'physics',
  course_code: 'PHY101',
  department: 'Science',
  description: 'Physics reviewer and quiz support metadata for extension testing.',
  keywords: [
    'physics',
    'nsci',
    'nsci6101',
    'prelim',
    'lab',
    'force',
    'energy',
    'velocity',
    'voltage',
    'volt',
    'volts',
    'current',
    'electric current',
    'resistance',
    'ohm',
    "ohm's law",
    'ohms law',
    'circuits',
    'electricity',
    'charge',
    'true',
    'false',
    'true false',
    'prelim lab quiz',
  ],
  url_patterns: [
    'physics',
    'phy101',
    'nsci',
    'quiz',
    'attempt.php',
    'review.php',
    'semestral.amaes.com',
  ],
  is_active: true,
};

const sourceChunks = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1',
    chunk_index: 0,
    page_number: 1,
    heading: 'Electrical units overview',
    text_content:
      'Volt is the unit of electric potential difference or voltage. Ampere is the unit of electric current, and watt is the unit of power.',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab2',
    chunk_index: 1,
    page_number: 1,
    heading: "Ohm's law",
    text_content:
      "Ohm's law states that electric current is directly proportional to voltage and inversely proportional to resistance when temperature remains constant.",
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab3',
    chunk_index: 2,
    page_number: 2,
    heading: 'Current and charge in circuits',
    text_content:
      'In electric circuits, current goes around the loop. Charge carriers move through the circuit, but statements that charge itself is simply the unit or quantity going around without context are often misleading in basic true or false questions.',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab4',
    chunk_index: 3,
    page_number: 2,
    heading: 'True or false review',
    text_content:
      'Volts is the unit for current is false. Ohms law says current is proportional to voltage and inversely proportional to resistance is true. Volts is the unit of power is false because power is measured in watts.',
  },
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function tokenCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length;
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
  const actorUserId = await resolveActorUserId();

  const subjectResult = await supabase.from('subjects').upsert(physicsSubject, { onConflict: 'id' });
  if (subjectResult.error) {
    throw new Error(`Failed to update Physics subject metadata: ${subjectResult.error.message}`);
  }

  const foldersResult = await supabase.from('folders').upsert(
    [
      {
        id: ids.rootFolderId,
        parent_id: null,
        subject_id: ids.subjectId,
        folder_type: 'subject_root',
        name: 'Physics',
        slug: 'physics',
        sort_order: 1,
        is_active: true,
        created_by: actorUserId,
      },
      {
        id: ids.quizFolderId,
        parent_id: ids.rootFolderId,
        subject_id: ids.subjectId,
        folder_type: 'category',
        name: 'Quiz',
        slug: 'quiz',
        sort_order: 2,
        is_active: true,
        created_by: actorUserId,
      },
    ],
    { onConflict: 'id' },
  );

  if (foldersResult.error) {
    throw new Error(`Failed to seed Physics folders: ${foldersResult.error.message}`);
  }

  const sourceFileResult = await supabase.from('source_files').upsert(
    {
      id: ids.sourceFileId,
      folder_id: ids.quizFolderId,
      subject_id: ids.subjectId,
      category_id: ids.quizCategoryId,
      title: 'Physics Quiz Reviewer',
      original_filename: 'physics-quiz-reviewer.txt',
      storage_bucket: 'private-sources',
      storage_path: 'demo/physics-quiz-reviewer.txt',
      mime_type: 'text/plain',
      file_size_bytes: 4096,
      source_status: 'active',
      version_number: 1,
      source_priority: 20,
      tags: ['physics', 'quiz', 'reviewer', 'demo'],
      description: 'Seeded Physics reviewer for true/false quiz extraction and retrieval testing.',
      uploaded_by: actorUserId,
      activated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (sourceFileResult.error) {
    throw new Error(`Failed to seed Physics source file: ${sourceFileResult.error.message}`);
  }

  const versionResult = await supabase.from('source_versions').upsert(
    {
      id: ids.sourceVersionId,
      source_file_id: ids.sourceFileId,
      version_number: 1,
      storage_path: 'demo/physics-quiz-reviewer.txt',
      change_note: 'Initial seeded Physics quiz reviewer version.',
      created_by: actorUserId,
    },
    { onConflict: 'id' },
  );

  if (versionResult.error) {
    throw new Error(`Failed to seed Physics source version: ${versionResult.error.message}`);
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
    throw new Error(`Failed to seed Physics processing job: ${processingJobResult.error.message}`);
  }

  const chunksResult = await supabase.from('source_chunks').upsert(
    sourceChunks.map((chunk) => ({
      id: chunk.id,
      source_file_id: ids.sourceFileId,
      subject_id: ids.subjectId,
      category_id: ids.quizCategoryId,
      folder_id: ids.quizFolderId,
      chunk_index: chunk.chunk_index,
      page_number: chunk.page_number,
      heading: chunk.heading,
      text_content: chunk.text_content,
      text_hash: sha256(chunk.text_content),
      token_count: tokenCount(chunk.text_content),
      metadata: {
        file_name: 'physics-quiz-reviewer.txt',
        subject: physicsSubject.name,
        category: 'Quiz',
        seeded: true,
      },
      is_active: true,
    })),
    { onConflict: 'id' },
  );

  if (chunksResult.error) {
    throw new Error(`Failed to seed Physics quiz chunks: ${chunksResult.error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        subject: physicsSubject.name,
        category: 'Quiz',
        sourceFileId: ids.sourceFileId,
        chunkCount: sourceChunks.length,
      },
      null,
      2,
    ),
  );
}

await main();
