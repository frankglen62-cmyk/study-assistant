import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const values = {};

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  }

  return values;
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDirectory, '..', '..', '..');
  const envPath = path.join(repoRoot, 'apps', 'web', '.env.local');
  const mergedEnv = {
    ...loadEnvFile(envPath),
    ...process.env,
  };
  const databaseUrl = mergedEnv.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(`DATABASE_URL not found in ${envPath}.`);
  }

  const sql = postgres(databaseUrl, {
    ssl: 'require',
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  });

  const migrations = [
    {
      id: '0012',
      file: path.join(repoRoot, 'supabase', 'migrations', '0012_admin_user_controls.sql'),
      isApplied: async () => {
        const [row] = await sql`
          select to_regclass('public.user_admin_notes') as note_table,
                 to_regclass('public.user_flags') as flag_table,
                 to_regclass('public.user_access_overrides') as access_table
        `;
        return row.note_table && row.flag_table && row.access_table;
      },
    },
    {
      id: '0013',
      file: path.join(repoRoot, 'supabase', 'migrations', '0013_user_suspension_and_admin_indexes.sql'),
      isApplied: async () => {
        const [row] = await sql`
          select exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = 'profiles'
              and column_name = 'suspended_until'
          ) as applied
        `;
        return row.applied;
      },
    },
    {
      id: '0014',
      file: path.join(repoRoot, 'supabase', 'migrations', '0014_wallet_grants_and_admin_rollups.sql'),
      isApplied: async () => {
        const [row] = await sql`
          select
            to_regclass('public.wallet_grants') is not null as has_wallet_grants,
            exists (
              select 1
              from information_schema.columns
              where table_schema = 'public'
                and table_name = 'payment_packages'
                and column_name = 'credit_expires_after_days'
            ) as has_package_expiry,
            to_regclass('public.admin_user_rollups') is not null as has_rollup_view
        `;
        return row.has_wallet_grants && row.has_package_expiry && row.has_rollup_view;
      },
    },
  ];

  try {
    for (const migration of migrations) {
      const applied = await migration.isApplied();

      if (applied) {
        console.log(`${migration.id}: already applied`);
        continue;
      }

      console.log(`${migration.id}: applying ${path.basename(migration.file)}`);
      const sqlText = fs.readFileSync(migration.file, 'utf8');
      await sql.unsafe(sqlText);
      console.log(`${migration.id}: applied`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
