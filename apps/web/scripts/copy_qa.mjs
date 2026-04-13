import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    result[key] = value;
  }
  return result;
}

const env = { ...loadEnvFile(path.join(webRoot, '.env.local')), ...process.env };
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const { data: bgData, error: bgErr } = await supabase.from('subjects').select('*').ilike('name', 'Information Management%');
  if(bgErr) throw bgErr;
  
  const { data: destData, error: destErr } = await supabase.from('subjects').select('*').ilike('name', 'Professional Ethics in IT%');
  if(destErr) throw destErr;

  const sourceSubj = bgData[0];
  const targetSubj = destData[0];

  if (!sourceSubj) throw new Error("Couldn't find source subject: Information Management");
  if (!targetSubj) throw new Error("Couldn't find target subject: Professional Ethics in IT");

  console.log(`Source subject: ${sourceSubj.name} (${sourceSubj.id})`);
  console.log(`Target subject: ${targetSubj.name} (${targetSubj.id})`);

  const { data: pairs, error: pairsErr } = await supabase.from('subject_qa_pairs').select('*').eq('subject_id', sourceSubj.id).is('deleted_at', null);

  if (pairsErr) throw pairsErr;

  console.log(`Found ${pairs.length} pairs in source subject.`);

  // To avoid huge payloads, let's insert them in chunks
  const chunkSize = 200;
  let inserted = 0;
  for (let i = 0; i < pairs.length; i += chunkSize) {
    const chunk = pairs.slice(i, i + chunkSize);
    const newPairs = chunk.map(p => ({
      subject_id: targetSubj.id,
      question_text: p.question_text,
      answer_text: p.answer_text,
      short_explanation: p.short_explanation,
      keywords: p.keywords,
      sort_order: p.sort_order, // or we could offset it if we want them appended properly. But it doesn't matter too much.
      is_active: p.is_active,
      created_by: p.created_by,
      updated_by: p.updated_by
    }));

    const { error: insertErr } = await supabase.from('subject_qa_pairs').insert(newPairs);
    if (insertErr) {
       console.error(insertErr);
       throw insertErr;
    }
    inserted += newPairs.length;
    console.log(`Inserted chunk of ${newPairs.length} pairs. Total: ${inserted}`);
  }

  console.log(`Successfully inserted ${inserted} pairs to ${targetSubj.name}`);
}

run().catch(console.error);
