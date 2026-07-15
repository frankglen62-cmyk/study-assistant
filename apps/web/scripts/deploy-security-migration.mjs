import fs from 'node:fs';
import path from 'node:path';

import postgres from 'postgres';

const workspaceRoot = path.resolve(import.meta.dirname, '../../..');
const envPath = path.join(workspaceRoot, 'apps/web/.env.local');
const migrationPath = path.join(workspaceRoot, 'supabase/migrations/0016_security_hardening.sql');

function loadEnv(filePath) {
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const env = loadEnv(envPath);
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing from apps/web/.env.local.');

const mode = process.argv[2] ?? 'preflight';
if (!['preflight', 'deploy', 'verify'].includes(mode)) {
  throw new Error('Usage: node deploy-security-migration.mjs [preflight|deploy|verify]');
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
});

async function getState() {
  const [identity] = await sql`
    select current_database() as database_name, current_user as user_name
  `;
  const [state] = await sql`
    select
      to_regprocedure('public.settle_active_session_usage(uuid,uuid,integer)') is not null
        as settlement_exists,
      to_regprocedure('public.rotate_extension_refresh_token(uuid,text,text,timestamptz)') is not null
        as rotation_exists,
      to_regprocedure('public.consume_security_rate_limit(text,integer,integer)') is not null
        as rate_limit_exists,
      to_regclass('public.security_rate_limits') is not null
        as rate_limit_table_exists
  `;
  const [securityState] = await sql`
    select
      (
        select count(*) = 5
          from information_schema.columns
         where table_schema = 'public'
           and table_name = 'payments'
           and column_name in (
             'entitlement_seconds',
             'entitlement_expires_after_days',
             'entitlement_package_code',
             'refunded_amount_minor',
             'reversed_seconds'
           )
      ) as payment_snapshot_columns_exist,
      to_regclass('public.extension_installations_single_active_user_uidx') is not null
        as single_installation_index_exists,
      not has_table_privilege('anon', 'public.extension_pairing_codes', 'select')
        as pairing_codes_hidden_from_anon,
      not has_table_privilege('authenticated', 'public.extension_pairing_codes', 'select')
        as pairing_codes_hidden_from_authenticated,
      not has_function_privilege(
        'anon',
        'public.settle_active_session_usage(uuid,uuid,integer)',
        'execute'
      ) as settlement_hidden_from_anon,
      has_function_privilege(
        'service_role',
        'public.settle_active_session_usage(uuid,uuid,integer)',
        'execute'
      ) as settlement_available_to_service_role,
      (
        select relrowsecurity
          from pg_class
         where oid = 'public.security_rate_limits'::regclass
      ) as rate_limit_rls_enabled
  `;
  const migrationTable = await sql`
    select to_regclass('supabase_migrations.schema_migrations') is not null as exists
  `;
  let latestMigrations = [];
  let migrationColumns = [];
  if (migrationTable[0].exists) {
    migrationColumns = await sql`
      select column_name, data_type
        from information_schema.columns
       where table_schema = 'supabase_migrations'
         and table_name = 'schema_migrations'
       order by ordinal_position
    `;
    latestMigrations = await sql`
      select version
        from supabase_migrations.schema_migrations
       order by version desc
       limit 8
    `;
  }
  return {
    connected: true,
    database: identity.database_name,
    user: identity.user_name,
    migrationTableExists: migrationTable[0].exists,
    migrationColumns,
    latestMigrations,
    ...state,
    ...securityState,
  };
}

try {
  if (mode === 'deploy') {
    const before = await getState();
    if (before.settlement_exists && before.rotation_exists && before.rate_limit_exists) {
      console.log(JSON.stringify({ deployed: false, reason: 'already_applied', state: before }, null, 2));
      process.exitCode = 0;
    } else {
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migrationSql);
      });
      const after = await getState();
      console.log(JSON.stringify({ deployed: true, state: after }, null, 2));
    }
  } else {
    const state = await getState();
    console.log(JSON.stringify({ mode, state }, null, 2));
    if (
      mode === 'verify' &&
      (
        !state.settlement_exists ||
        !state.rotation_exists ||
        !state.rate_limit_exists ||
        !state.rate_limit_table_exists ||
        !state.payment_snapshot_columns_exist ||
        !state.single_installation_index_exists ||
        !state.pairing_codes_hidden_from_anon ||
        !state.pairing_codes_hidden_from_authenticated ||
        !state.settlement_hidden_from_anon ||
        !state.settlement_available_to_service_role ||
        !state.rate_limit_rls_enabled
      )
    ) {
      throw new Error('Security migration verification failed.');
    }
  }
} finally {
  await sql.end();
}
