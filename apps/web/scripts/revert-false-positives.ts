import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && match[1] && match[2]) {
      process.env[match[1]] = match[2].trim();
    }
  }
} catch (e) {
  console.log("Could not load .env.local from " + resolve(process.cwd(), '.env.local'));
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

const REVERTS: Array<[RegExp, string]> = [
  [/\bthrough out\b/ig, "throughout"],
  [/\bthrough put\b/ig, "throughput"],
  [/\bbreak through\b/ig, "breakthrough"],
  [/\bstrike through\b/ig, "strikethrough"]
];

async function run() {
  let allPairs: any[] = [];
  let page = 0;
  const limit = 1000;
  while(true) {
    const { data: pairs, error } = await supabase
      .from('subject_qa_pairs')
      .select('id, question_text, answer_text')
      .range(page * limit, (page + 1) * limit - 1);

    if (error) {
       console.error(error);
       break;
    }
    if (pairs.length === 0) break;
    allPairs = allPairs.concat(pairs);
    page++;
  }

  let totalFixes = 0;

  for (const pair of allPairs) {
    let originalQ = pair.question_text || '';
    let originalA = pair.answer_text || '';
    
    let fixedQ = originalQ;
    let fixedA = originalA;

    for (const [regex, rep] of REVERTS) {
      fixedQ = fixedQ.replace(regex, rep);
      fixedA = fixedA.replace(regex, rep);
    }

    if (fixedQ !== originalQ || fixedA !== originalA) {
      console.log(`Reverting pair ${pair.id}`);
      await supabase
       .from('subject_qa_pairs')
       .update({ question_text: fixedQ, answer_text: fixedA })
       .eq('id', pair.id);

      totalFixes++;
    }
  }

  console.log(`Reverted ${totalFixes} false positives.`);
}

run();
