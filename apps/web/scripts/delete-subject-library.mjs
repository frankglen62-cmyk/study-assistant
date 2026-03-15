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
    courseCode: '',
    name: '',
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

    if (key === 'code') {
      args.courseCode = next;
    }

    if (key === 'name') {
      args.name = next;
    }

    index += 1;
  }

  if (!args.courseCode && !args.name) {
    throw new Error('Usage: node delete-subject-library.mjs --code <course code> | --name <subject name>');
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));

const subjectLookup = await supabase
  .from('subjects')
  .select('id, name, course_code')
  .or(
    [args.courseCode ? `course_code.eq.${args.courseCode}` : null, args.name ? `name.eq.${args.name}` : null]
      .filter(Boolean)
      .join(','),
  )
  .limit(1)
  .maybeSingle();

if (subjectLookup.error) {
  throw new Error(`Failed to load subject: ${subjectLookup.error.message}`);
}

if (!subjectLookup.data) {
  throw new Error('Subject not found.');
}

const subjectId = subjectLookup.data.id;

const allFoldersResponse = await supabase
  .from('folders')
  .select('id, parent_id, subject_id');

if (allFoldersResponse.error) {
  throw new Error(`Failed to inspect folders: ${allFoldersResponse.error.message}`);
}

const allFolders = allFoldersResponse.data ?? [];
const relatedFolderIds = new Set(allFolders.filter((folder) => folder.subject_id === subjectId).map((folder) => folder.id));

let changed = true;
while (changed) {
  changed = false;
  for (const folder of allFolders) {
    if (folder.parent_id && relatedFolderIds.has(folder.parent_id) && !relatedFolderIds.has(folder.id)) {
      relatedFolderIds.add(folder.id);
      changed = true;
    }
  }
}

const folderById = new Map(allFolders.map((folder) => [folder.id, folder]));
function getFolderDepth(folderId) {
  const folder = folderById.get(folderId);
  if (!folder?.parent_id || !relatedFolderIds.has(folder.parent_id)) {
    return 0;
  }

  return 1 + getFolderDepth(folder.parent_id);
}

const relatedSourceFilesResponse = await supabase
  .from('source_files')
  .select('id, storage_bucket, storage_path')
  .eq('subject_id', subjectId);

if (relatedSourceFilesResponse.error) {
  throw new Error(`Failed to inspect source files: ${relatedSourceFilesResponse.error.message}`);
}

const relatedSourceFiles = relatedSourceFilesResponse.data ?? [];
const storagePathsByBucket = new Map();

for (const file of relatedSourceFiles) {
  const bucketEntries = storagePathsByBucket.get(file.storage_bucket) ?? [];
  bucketEntries.push(file.storage_path);
  storagePathsByBucket.set(file.storage_bucket, bucketEntries);
}

for (const [bucket, storagePaths] of storagePathsByBucket) {
  if (!storagePaths.length) {
    continue;
  }

  const { error } = await supabase.storage.from(bucket).remove(storagePaths);
  if (error) {
    console.warn(`Failed to remove storage objects from ${bucket}: ${error.message}`);
  }
}

if (relatedSourceFiles.length > 0) {
  const deletedSourceFiles = await supabase.from('source_files').delete().eq('subject_id', subjectId);
  if (deletedSourceFiles.error) {
    throw new Error(`Failed to delete source files: ${deletedSourceFiles.error.message}`);
  }
}

const deletedQaPairs = await supabase.from('subject_qa_pairs').delete().eq('subject_id', subjectId);
if (deletedQaPairs.error) {
  throw new Error(`Failed to delete subject Q&A pairs: ${deletedQaPairs.error.message}`);
}

const deletedCategories = await supabase.from('categories').delete().eq('subject_id', subjectId);
if (deletedCategories.error) {
  throw new Error(`Failed to delete categories: ${deletedCategories.error.message}`);
}

for (const folderId of Array.from(relatedFolderIds).sort((left, right) => getFolderDepth(right) - getFolderDepth(left))) {
  const deletedFolder = await supabase.from('folders').delete().eq('id', folderId);
  if (deletedFolder.error) {
    throw new Error(`Failed to delete folder ${folderId}: ${deletedFolder.error.message}`);
  }
}

const deletedSubject = await supabase.from('subjects').delete().eq('id', subjectId);
if (deletedSubject.error) {
  throw new Error(`Failed to delete subject: ${deletedSubject.error.message}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      deletedSubjectId: subjectId,
      deletedSubjectName: subjectLookup.data.name,
      deletedCourseCode: subjectLookup.data.course_code,
      deletedFolderCount: relatedFolderIds.size,
      deletedSourceFileCount: relatedSourceFiles.length,
    },
    null,
    2,
  ),
);
