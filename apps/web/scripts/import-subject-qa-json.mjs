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

function parseArgs(argv) {
  const args = {
    jsonPath: '',
    subjectName: '',
    courseCode: '',
    department: 'Science',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      continue;
    }

    const key = value.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      continue;
    }

    if (key === 'json') {
      args.jsonPath = next;
    }

    if (key === 'name') {
      args.subjectName = next;
    }

    if (key === 'code') {
      args.courseCode = next;
    }

    if (key === 'department') {
      args.department = next;
    }

    index += 1;
  }

  if (!args.jsonPath || !args.subjectName || !args.courseCode) {
    throw new Error('Usage: node import-subject-qa-json.mjs --json <path> --name <subject name> --code <course code> [--department <department>]');
  }

  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeQuestion(value) {
  return (value || '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildKeywords(row, args) {
  const tokens = `${row.questionText} ${row.answerText} ${args.subjectName} ${args.courseCode}`
    .toLowerCase()
    .match(/[a-z0-9-]{3,}/g) ?? [];

  return Array.from(new Set(tokens)).slice(0, 24);
}

function buildSubjectKeywords(args, rows) {
  const subjectTokens = `${args.subjectName} ${args.courseCode}`
    .toLowerCase()
    .match(/[a-z0-9-]{3,}/g) ?? [];

  const rowTokens = rows
    .flatMap((row) => `${row.questionText} ${row.answerText}`.toLowerCase().match(/[a-z0-9-]{4,}/g) ?? [])
    .filter((token) => !/^\d+$/.test(token));

  return Array.from(new Set([...subjectTokens, ...rowTokens])).slice(0, 30);
}

async function resolveActorUserId() {
  const response = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['super_admin', 'admin'])
    .eq('account_status', 'active')
    .order('role', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (response.error) {
    throw new Error(`Failed to resolve admin actor: ${response.error.message}`);
  }

  if (!response.data?.id) {
    throw new Error('No active admin or super_admin profile was found.');
  }

  return response.data.id;
}

async function ensureSubject(args) {
  const slug = slugify(args.subjectName);
  const uniqueSourceUrls = Array.from(
    new Set(
      rows
        .map((row) => row.sourceUrl)
        .filter(Boolean),
    ),
  );

  const subjectPayload = {
    name: args.subjectName,
    slug,
    course_code: args.courseCode,
    department: args.department,
    description: `Imported from workbook source for ${args.subjectName}.`,
    keywords: buildSubjectKeywords(args, rows),
    url_patterns: uniqueSourceUrls.map((url) => url.toLowerCase()),
    is_active: true,
  };

  const existing = await supabase
    .from('subjects')
    .select('id')
    .or(`course_code.eq.${args.courseCode},slug.eq.${slug}`)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to look up subject: ${existing.error.message}`);
  }

  if (existing.data?.id) {
    const updated = await supabase.from('subjects').update(subjectPayload).eq('id', existing.data.id).select('id').single();
    if (updated.error) {
      throw new Error(`Failed to update subject: ${updated.error.message}`);
    }
    return { id: updated.data.id, slug };
  }

  const inserted = await supabase.from('subjects').insert(subjectPayload).select('id').single();
  if (inserted.error) {
    throw new Error(`Failed to create subject: ${inserted.error.message}`);
  }

  return { id: inserted.data.id, slug };
}

async function ensureRootFolder(subjectId, subjectName, slug, actorUserId) {
  const existing = await supabase
    .from('folders')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('folder_type', 'subject_root')
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to look up subject folder: ${existing.error.message}`);
  }

  if (existing.data?.id) {
    return existing.data.id;
  }

  const inserted = await supabase
    .from('folders')
    .insert({
      subject_id: subjectId,
      parent_id: null,
      folder_type: 'subject_root',
      name: subjectName,
      slug,
      sort_order: 100,
      is_active: true,
      created_by: actorUserId,
    })
    .select('id')
    .single();

  if (inserted.error) {
    throw new Error(`Failed to create subject folder: ${inserted.error.message}`);
  }

  return inserted.data.id;
}

async function loadExistingPairs(subjectId) {
  const response = await supabase
    .from('subject_qa_pairs')
    .select('id, question_text')
    .eq('subject_id', subjectId)
    .is('deleted_at', null);

  if (response.error) {
    const rawMessage = `${response.error.message ?? ''} ${response.error.details ?? ''}`.toLowerCase();
    if (rawMessage.includes('subject_qa_pairs') && (rawMessage.includes('does not exist') || rawMessage.includes('schema cache'))) {
      throw new Error('subject_qa_pairs table is not available yet. Apply migration 0008_subject_qa_pairs.sql first.');
    }

    throw new Error(`Failed to load existing Q&A pairs: ${response.error.message}`);
  }

  return new Map(
    (response.data ?? []).map((row) => [normalizeQuestion(row.question_text), row.id]),
  );
}

async function importPairs(subjectId, actorUserId, args) {
  const existingPairs = await loadExistingPairs(subjectId);
  let insertedCount = 0;
  let updatedCount = 0;

  for (const [index, row] of rows.entries()) {
    const normalizedQuestion = normalizeQuestion(row.questionText);
    if (!normalizedQuestion || !row.answerText.trim()) {
      continue;
    }

    const payload = {
      subject_id: subjectId,
      category_id: null,
      question_text: row.questionText.trim(),
      answer_text: row.answerText.trim(),
      short_explanation: null,
      keywords: buildKeywords(row, args),
      sort_order: index + 1,
      is_active: true,
      updated_by: actorUserId,
    };

    const existingId = existingPairs.get(normalizedQuestion) ?? null;

    if (existingId) {
      const updated = await supabase.from('subject_qa_pairs').update(payload).eq('id', existingId);
      if (updated.error) {
        throw new Error(`Failed to update Q&A pair for "${row.questionText}": ${updated.error.message}`);
      }
      updatedCount += 1;
      continue;
    }

    const inserted = await supabase.from('subject_qa_pairs').insert({
      ...payload,
      created_by: actorUserId,
    });
    if (inserted.error) {
      throw new Error(`Failed to insert Q&A pair for "${row.questionText}": ${inserted.error.message}`);
    }
    insertedCount += 1;
  }

  return { insertedCount, updatedCount };
}

const args = parseArgs(process.argv.slice(2));
const rows = JSON.parse(readFileSync(path.resolve(args.jsonPath), 'utf8').replace(/^\uFEFF/, ''));

if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error('Imported JSON rows are empty.');
}

const actorUserId = await resolveActorUserId();
const { id: subjectId, slug } = await ensureSubject(args);
const folderId = await ensureRootFolder(subjectId, args.subjectName, slug, actorUserId);
const importResult = await importPairs(subjectId, actorUserId, args);

console.log(
  JSON.stringify(
    {
      ok: true,
      subjectId,
      folderId,
      subjectName: args.subjectName,
      courseCode: args.courseCode,
      importedRows: rows.length,
      inserted: importResult.insertedCount,
      updated: importResult.updatedCount,
    },
    null,
    2,
  ),
);
