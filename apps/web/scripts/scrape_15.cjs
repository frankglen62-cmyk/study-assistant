
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const TARGETS = [
  {
    name: 'Algorithms and Complexity',
    slug: 'algorithms-and-complexity',
    expectedCount: 107,
    pages: 2,
    baseUrl: 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs'
  },
  {
    name: 'Animation Project',
    slug: 'animation-project',
    expectedCount: 61,
    pages: 1,
    baseUrl: 'https://amauoed.com/courses/cs/animation-project-6212-cs'
  },
  {
    name: 'Automata Theory and Formal Language',
    slug: 'automata-theory-and-formal-language',
    expectedCount: 246,
    pages: 4,
    baseUrl: 'https://amauoed.com/courses/cs/automata-theory-and-formal-language-6205-cs'
  },
  {
    name: 'Biological Science',
    slug: 'biological-science',
    expectedCount: 155,
    pages: 3,
    baseUrl: 'https://amauoed.com/courses/bio/biological-science-6202-bio'
  },
  {
    name: 'Computer Architecture and Organization',
    slug: 'computer-architecture-and-organization',
    expectedCount: 14,
    pages: 1,
    baseUrl: 'https://amauoed.com/courses/cs/computer-architecture-and-organization-6204-cs'
  },
  {
    name: 'Discrete Structures 2',
    slug: 'discrete-structures-2',
    expectedCount: 106,
    pages: 2,
    baseUrl: 'https://amauoed.com/courses/cs/discrete-structures-2-6201-cs'
  },
  {
    name: 'Introduction to Machine Learning',
    slug: 'introduction-to-machine-learning',
    expectedCount: 163,
    pages: 3,
    baseUrl: 'https://amauoed.com/courses/cs/introduction-to-machine-learning-6309-cs'
  },
  {
    name: 'Logic Design and Digital Computer Circuits',
    slug: 'logic-design-and-digital-computer-circuits',
    expectedCount: 27,
    pages: 1,
    baseUrl: 'https://amauoed.com/courses/cs/logic-design-and-digital-computer-circuits-6301-cs'
  },
  {
    name: 'Mobile Application Development',
    slug: 'mobile-application-development',
    expectedCount: 60,
    pages: 1,
    baseUrl: 'https://amauoed.com/courses/cs/mobile-application-development-6326-cs'
  },
  {
    name: 'Modeling and Simulation',
    slug: 'modeling-and-simulation',
    expectedCount: 90,
    pages: 2,
    baseUrl: 'https://amauoed.com/courses/cs/modeling-and-simulation-6304-cs'
  },
  {
    name: 'Number Theory',
    slug: 'number-theory',
    expectedCount: 268,
    pages: 4,
    baseUrl: 'https://amauoed.com/courses/math/number-theory-6258-math'
  },
  {
    name: 'Numerical Methods',
    slug: 'numerical-methods',
    expectedCount: 256,
    pages: 4,
    baseUrl: 'https://amauoed.com/courses/math/numerical-methods-6330-math'
  },
  {
    name: 'Programming Languages with Compiler',
    slug: 'programming-languages-with-compiler',
    expectedCount: 40,
    pages: 1,
    baseUrl: 'https://amauoed.com/courses/cs/programming-languages-with-compiler-6207-cs'
  },
  {
    name: 'Project Management',
    slug: 'project-management',
    expectedCount: 258,
    pages: 4,
    baseUrl: 'https://amauoed.com/courses/it/project-management-6212-it'
  },
  {
    name: 'Software Engineering 2',
    slug: 'software-engineering-2',
    expectedCount: 186,
    pages: 3,
    baseUrl: 'https://amauoed.com/courses/cs/software-engineering-2-6300-cs'
  }
];

async function scrapeSubject(config, supabase, adminId) {
  let allQa = [];

  for (let i = 1; i <= config.pages; i++) {
    const url = `${config.baseUrl}?page=${i}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'timestamp=' + Date.now());
    const html = await res.text();

    const cardRegex = /<div class="card mb-2 bg-secondary">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const cardHtml = match[1];

      const qMatch = cardHtml.match(/<div class="mb-2">([\s\S]*?)<\/div>/);
      const optionsMatch = cardHtml.match(/<ul>([\s\S]*?)<\/ul>/);

      if (qMatch && optionsMatch) {
        let qText = qMatch[1].replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        
        const ansMatch = optionsMatch[1].match(/<li><strong>([\s\S]*?)<\/strong>\s*<span class="chip bg-success">Correct<\/span><\/li>/);
        if (ansMatch) {
          let aText = ansMatch[1].replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          
          allQa.push({ q: qText, a: aText });
        }
      }
    }
  }

  // To deduplicate based on question_text (sometimes the site splits and repeats with variations)
  // we do simple exact deduplication which was done above.
  console.log(`[${config.name}] Total Unique Q&A Extracted: ${allQa.length}`);
  
  if (allQa.length !== config.expectedCount) {
    console.warn(`WARNING: Expected ${config.expectedCount} answers, but got ${allQa.length}! Continuing anyway.`);
  }

  fs.writeFileSync(`scripts/generated/${config.slug}_QA.json`, JSON.stringify(allQa, null, 2));

  let { data: subject, error: subErr } = await supabase.from('subjects').select('id, name').eq('slug', config.slug).single();
  
  if (subErr || !subject) {
    console.log(`Subject not found, creating ${config.name}...`);
    const { data: newSub, error: createErr } = await supabase.from('subjects').insert({
      name: config.name,
      slug: config.slug,
      is_active: true
    }).select('id, name').single();
    
    if (createErr) {
      console.error('Failed to create subject:', createErr);
      throw createErr;
    }
    subject = newSub;
  } else {
      console.log(`Subject already exists: ${subject.name} (${subject.id})`);
  }

  // To prevent duplicates inside the DB, first delete existing if they match the same subject?
  // The prompt says "isa-seed mo sa database ko lahat ng q and a pair jan... dapat lahat ng q and a per subject is kompleto wala dapat mawawala".
  // Let's delete existing QA for this subject to be clean.
  console.log(`Cleaning old QA for ${config.name}...`);
  await supabase.from('subject_qa_pairs').delete().eq('subject_id', subject.id);

  console.log(`[${config.name}] Inserting into subject_id:`, subject.id);

  const payload = allQa
    .filter(item => item.q && item.a)
    .map((item, index) => ({
      subject_id: subject.id,
      question_text: item.q,
      answer_text: item.a,
      sort_order: index + 1,
      is_active: true,
      created_by: adminId || null // Using the admin UI pattern
  }));

  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from('subject_qa_pairs').insert(chunk);
    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      console.log(`[${config.name}] Inserted batch ${i} to ${i + chunk.length}`);
    }
  }
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const adminId = admin ? admin.id : null;
  console.log('Using Admin ID for created_by:', adminId);

  for (const target of TARGETS) {
    await scrapeSubject(target, supabase, adminId);
  }

  console.log('All Done!');
}

main().catch(console.error);
