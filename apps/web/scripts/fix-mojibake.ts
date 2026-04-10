import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

// Parse env manually to avoid module issues
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match && match[1]) {
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

async function run() {
  console.log("Fetching questions...");
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
      process.exit(1);
    }
    
    if (pairs.length === 0) break;
    allPairs = allPairs.concat(pairs);
    page++;
  }

  console.log(`Found ${allPairs.length} pairs.`);
  let totalFixes = 0;

  for (const pair of allPairs) {
    let originalQ = pair.question_text || '';
    let originalA = pair.answer_text || '';
    
    let fixedQ = originalQ;
    let fixedA = originalA;

    // Fix Mojibake:  (Replacement Character)
    
    // 1. Apostrophes: words, lets, dont, etc.
    const fixApostrophes = (text) => text.replace(/([a-zA-Z])\ufffd([a-zA-Z])/g, "$1'$2");
    
    // 2. Quotes at boundaries
    const fixQuotes = (text) => {
        let t = text;
        t = t.replace(/(^|\s)\ufffd([a-zA-Z])/g, "$1'$2");
        t = t.replace(/([a-zA-Z])\ufffd(\s|$|[.,?!])/g, "$1'$2");
        return t;
    };

    // 3. Em-dashes / En-dashes
    const fixDashes = (text) => text.replace(/\ufffd/g, " - ");

    // Apply  fixes
    if (fixedQ.includes('\ufffd')) {
        fixedQ = fixApostrophes(fixedQ);
        fixedQ = fixQuotes(fixedQ);
        fixedQ = fixedQ.replace(/\ufffd/g, "'"); 
    }

    if (fixedA.includes('\ufffd')) {
        fixedA = fixApostrophes(fixedA);
        fixedA = fixQuotes(fixedA);
        fixedA = fixedA.replace(/\ufffd/g, "'");
    }

    // Apply the missed merged words from before that I noticed
    const mergedDict: Record<string, string> = {
        'Managinginformation': 'Managing information',
        'andsecurity': 'and security'
    }
    
    for (const [bad, good] of Object.entries(mergedDict)) {
        const regex = new RegExp(`\\b${bad}\\b`, 'gi');
        fixedQ = fixedQ.replace(regex, match => {
            if (match.charAt(0) === match.charAt(0).toUpperCase()) {
                return good.charAt(0).toUpperCase() + good.slice(1);
            }
            return good;
        });
        
        fixedA = fixedA.replace(regex, match => {
            if (match.charAt(0) === match.charAt(0).toUpperCase()) {
                return good.charAt(0).toUpperCase() + good.slice(1);
            }
            return good;
        });
    }

    if (fixedQ !== originalQ || fixedA !== originalA) {
      console.log(`\nID: ${pair.id}`);
      if (fixedQ !== originalQ) {
         console.log(`Original Q: ${originalQ}`);
         console.log(`Fixed Q:    ${fixedQ}`);
      }
      totalFixes++;

      await supabase
       .from('subject_qa_pairs')
       .update({ question_text: fixedQ, answer_text: fixedA })
       .eq('id', pair.id);
    }
  }

  console.log(`\nProposed fixes: ${totalFixes}`);
}

run();
