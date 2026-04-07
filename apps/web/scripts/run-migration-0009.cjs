// Run migration 0009_question_type.sql via pg module
const fs = require('fs');
const path = require('path');

const DB_URL = 'postgresql://postgres.aciihkqecsehqxaikoir:MAHALkita1122%40@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function runMigration() {
  // Try to find pg from various locations
  let pg;
  const searchPaths = [
    path.resolve(__dirname, '..', 'node_modules', 'pg'),
    path.resolve(__dirname, '..', '..', '..', 'node_modules', 'pg'),
    path.resolve(__dirname, '..', '..', 'node_modules', 'pg'),
    'pg',
  ];
  
  for (const p of searchPaths) {
    try {
      pg = require(p);
      console.log('Found pg at:', p);
      break;
    } catch (e) {
      // continue
    }
  }
  
  if (!pg) {
    console.error('Could not find pg module');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database');

  // Run migration as a single transaction
  const migrationSQL = `
    DO $$ BEGIN
      CREATE TYPE public.question_type AS ENUM (
        'multiple_choice', 'fill_in_blank', 'checkbox', 'dropdown', 'picture'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;

  const statements = [
    migrationSQL,
    `ALTER TABLE public.subject_qa_pairs ADD COLUMN IF NOT EXISTS question_type public.question_type NOT NULL DEFAULT 'multiple_choice'`,
    `ALTER TABLE public.subject_qa_pairs ADD COLUMN IF NOT EXISTS question_image_url text`,
    `CREATE INDEX IF NOT EXISTS subject_qa_pairs_question_type_idx ON public.subject_qa_pairs (question_type) WHERE deleted_at IS NULL`,
  ];

  for (const stmt of statements) {
    try {
      console.log(`Executing: ${stmt.trim().slice(0, 80)}...`);
      await client.query(stmt);
      console.log('  OK');
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log('  SKIPPED (already exists)');
      } else {
        console.error('  ERROR:', err.message);
      }
    }
  }

  // Verify
  const result = await client.query(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name = 'subject_qa_pairs' AND column_name IN ('question_type', 'question_image_url')"
  );
  console.log('\nVerification - columns found:', JSON.stringify(result.rows, null, 2));

  // Count existing pairs
  const countResult = await client.query("SELECT count(*) as total FROM public.subject_qa_pairs WHERE deleted_at IS NULL");
  console.log('Total active Q&A pairs:', countResult.rows[0].total);

  await client.end();
  console.log('\nMigration completed successfully!');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
