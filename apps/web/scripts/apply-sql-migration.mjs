import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '..', '..');

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

function parseArgs(argv) {
  const args = {
    filePath: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--file' && argv[index + 1]) {
      args.filePath = argv[index + 1];
      index += 1;
    }
  }

  if (!args.filePath) {
    throw new Error('Usage: node apply-sql-migration.mjs --file <sql-file>');
  }

  return args;
}

const env = {
  ...loadEnvFile(path.join(webRoot, '.env.local')),
  ...process.env,
};

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required.');
}

const args = parseArgs(process.argv.slice(2));
const sqlPath = path.resolve(repoRoot, args.filePath);
const sqlText = readFileSync(sqlPath, 'utf8');

const connection = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 1,
});

try {
  await connection.unsafe(sqlText);
  console.log(JSON.stringify({ ok: true, file: args.filePath }, null, 2));
} finally {
  await connection.end({ timeout: 5 });
}
