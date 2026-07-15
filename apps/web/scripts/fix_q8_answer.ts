import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

const envPath = new URL('../.env.local', import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const FULL_ANSWER = `Evaluating the database server hardware
Installing the Oracle software
Planning the database and security strategy
Creating, migrating, and opening the database
Backing up the database
Enrolling system users and planning for their Oracle Network access.
Implementing the database design
Recovering from database failure
Monitoring database performance`;

async function main() {
  // Step 1: Find the truncated Q&A pair
  const { data: pairs, error: findError } = await supabase
    .from('subject_qa_pairs')
    .select('id, question_text, answer_text, subject_id')
    .ilike('question_text', '%correct order of designing%')
    .is('deleted_at', null);

  if (findError) {
    console.error('Error finding pair:', findError);
    return;
  }

  if (!pairs || pairs.length === 0) {
    console.log('No matching Q&A pair found.');
    return;
  }

  console.log(`Found ${pairs.length} matching pair(s):`);
  for (const pair of pairs) {
    console.log(`\n  ID: ${pair.id}`);
    console.log(`  Subject ID: ${pair.subject_id}`);
    console.log(`  Current answer (${pair.answer_text.length} chars):`);
    console.log(`    "${pair.answer_text}"`);
    console.log(`  Full answer (${FULL_ANSWER.length} chars):`);
    console.log(`    "${FULL_ANSWER}"`);

    // Step 2: Update with full answer
    const { error: updateError } = await supabase
      .from('subject_qa_pairs')
      .update({
        answer_text: FULL_ANSWER,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pair.id);

    if (updateError) {
      console.error(`  ❌ Failed to update pair ${pair.id}:`, updateError);
    } else {
      console.log(`  ✅ Updated pair ${pair.id} with full answer text.`);
    }
  }
}

main();
