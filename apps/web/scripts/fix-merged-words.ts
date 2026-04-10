import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import { resolve } from 'path';

// Parse env manually to avoid module issues
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

const REPLACEMENTS: Array<[RegExp, string]> = [

  // "the" combos
  [/\b([Oo]f|[Ii]n|[Tt]o|[Oo]n|[Aa]nd|[Ww]ith|[Ii]s|[Aa]re|[Tt]hat|[Bb]y|[Ff]rom|[Aa]s|[Aa]t|[Ff]or|into|Into)the\b/g, "$1 the"],
  [/\b([Tt]he)(data|system|software|user|users|process|context|code|following|result|results|value|values|purpose|quality|company|organization|network|internet)\b/ig, "$1 $2"],
  
  // "this" / "that" combos
  [/\b([Ii]n|[Oo]n|[Oo]f|[Ff]or|[Ii]s|[Ww]ith|about)this\b/ig, "$1 this"],
  [/\b([Ii]n|[Oo]n|[Oo]f|[Ff]or|[Ii]s|[Ww]ith|about)that\b/ig, "$1 that"],

  // "be" combos
  [/\b([Cc]an|[Ww]ill|[Tt]o|[Ss]hould|[Ww]ould|[Cc]ould|[Mm]ust|may)be\b/ig, (match, p1) => {
      // skip "maybe" which is a real word
      if (p1.toLowerCase() === 'may') return match;
      return `${p1} be`;
  }],
  [/\b([Hh]as|[Hh]ave|[Hh]ad)been\b/g, "$1 been"],

  // "of" suffix combos
  [/\b(types|number|use|part|set|form|consists|suppliers|development|management|security|collection|series|components|concept|process|principles|kind|source|lack|amount|because)of\b/ig, "$1 of"],

  // "information" combos
  [/\b(managing|an|the|about|provide|use)information\b/ig, "$1 information"],
  [/\binformation(technology|system|systems|and|or|is|are|will)\b/ig, "information $1"],

  // "data" combos
  [/\bdata(is|and|or|base|bases)\b/ig, (match, p1) => p1.toLowerCase().startsWith('base') ? match : `data ${p1}`], // skip database(s)

  [/\bbasiccomponents\b/ig, "basic components"],
  [/\bandsecurity\b/ig, "and security"],
  [/\bsuppliersof\b/ig, "suppliers of"],
  [/\bInthis\b/g, "In this"],
  [/\binthis\b/g, "in this"],
  [/\b(resources|connections|data|systems|users|organization|network|business|internet|information|software|hardware|security|management|process|development)(within|without|between|throughout)\b/ig, "$1 $2"],
  
  // Some other common IT ones
  [/\b(software|hardware|network|server|client|computer|router)(is|and|or|are|will)\b/ig, "$1 $2"],
  [/\b(an|a)(organization|application|environment|example|object|entity|attribute|record)\b/ig, "$1 $2"]
];

async function run() {
  console.log("Fetching questions to scan for merged words...");
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

  console.log(`Found ${allPairs.length} pairs. Processing...`);
  let totalFixes = 0;

  for (const pair of allPairs) {
    let originalQ = pair.question_text || '';
    let originalA = pair.answer_text || '';
    
    let fixedQ = originalQ;
    let fixedA = originalA;

    for (const [regex, replacement] of REPLACEMENTS) {
        // Safe uppercase/lowercase preservation for regex replacements avoiding lowercase wiping
        fixedQ = fixedQ.replace(regex, (...args) => {
           if (typeof replacement === 'function') {
               return (replacement as any)(...args);
           }
           let res = replacement as string;
           for (let i = 1; i < args.length - 2; i++) {
               res = res.replace("$" + i, args[i]);
           }
           return res;
        });

        fixedA = fixedA.replace(regex, (...args) => {
           if (typeof replacement === 'function') {
               return (replacement as any)(...args);
           }
           let res = replacement as string;
           for (let i = 1; i < args.length - 2; i++) {
               res = res.replace("$" + i, args[i]);
           }
           return res;
        });
    }

    if (fixedQ !== originalQ || fixedA !== originalA) {
      console.log(`\nID: ${pair.id}`);
      if (fixedQ !== originalQ) {
         console.log(`Original Q: ${originalQ}`);
         console.log(`Fixed Q:    ${fixedQ}`);
      }
      if (fixedA !== originalA) {
         console.log(`Original A: ${originalA}`);
         console.log(`Fixed A:    ${fixedA}`);
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
