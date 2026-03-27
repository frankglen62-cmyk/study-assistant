// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

const envFile = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

for (const line of envFile.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeExactDuplicates() {
  console.log('Fetching all Q&A pairs...');
  
  // We fetch only the fields we need to find exact duplicates
  const { data: pairs, error } = await supabase
    .from('subject_qa_pairs')
    .select('id, subject_id, question_text, answer_text')
    .is('deleted_at', null)
    .order('created_at', { ascending: true }); // Keep the oldest ones

  if (error) {
    console.error('Error fetching Q&A pairs:', error);
    process.exit(1);
  }

  if (!pairs || pairs.length === 0) {
    console.log('No pairs found.');
    return;
  }

  console.log(`Found ${pairs.length} total Q&A pairs. Analyzing...`);

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const pair of pairs) {
    // We normalize the text to ensure minor spacing doesn't prevent duplicate detection,
    // but the user said "same question same answer". We should normalize safely.
    // E.g. trim whitespace and lowercase.
    // Wait, the user specifically mentioned "Criterion- related" vs "Criterion-related". 
    // We want to delete if the normalized question and normalized answer are the same.
    const normQ = (pair.question_text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const normA = (pair.answer_text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    
    // The unique key for "same question same answer" in the same subject
    const key = `${pair.subject_id}::${normQ}::${normA}`;

    if (seen.has(key)) {
      toDelete.push(pair.id);
    } else {
      seen.add(key);
    }
  }

  console.log(`Found ${toDelete.length} exact duplicates to delete.`);

  if (toDelete.length === 0) {
    console.log('No duplicates to delete.');
    return;
  }

  // Delete in batches of 1000
  const batchSize = 1000;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);
    const { error: deleteError } = await supabase
      .from('subject_qa_pairs')
      .delete()
      .in('id', batch);

    if (deleteError) {
      console.error('Error deleting batch:', deleteError);
    } else {
      console.log(`Deleted batch of ${batch.length} duplicates.`);
    }
  }
  
  console.log('Duplicate removal complete!');
}

removeExactDuplicates().catch(console.error);
