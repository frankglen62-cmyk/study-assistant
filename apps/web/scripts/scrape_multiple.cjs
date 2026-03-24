const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const TARGETS = [
  {
    name: 'Application Life Cycle Management',
    slug: 'application-life-cycle-management',
    expectedCount: 272,
    pages: 5,
    baseUrl: 'https://amauoed.com/courses/cs/application-life-cycle-management-6302-cs'
  },
  {
    name: 'Cloud Computing and the Internet of Things',
    slug: 'cloud-computing-and-the-internet-of-things',
    expectedCount: 292,
    pages: 5,
    baseUrl: 'https://amauoed.com/courses/ite/cloud-computing-and-the-internet-of-things-6300-ite'
  },
  {
    name: 'Database Management System 2',
    slug: 'database-management-system-2',
    expectedCount: 187,
    pages: 4,
    baseUrl: 'https://amauoed.com/courses/it/database-management-system-2-oracle-10g-admin-6203-it'
  },
  {
    name: 'Ethics',
    slug: 'ethics',
    expectedCount: 139,
    pages: 3,
    baseUrl: 'https://amauoed.com/courses/ge/ethics-6107-ge'
  },
  {
    name: 'Discrete Mathematics',
    slug: 'discrete-mathematics',
    expectedCount: 326,
    pages: 6,
    baseUrl: 'https://amauoed.com/courses/cs/discrete-mathematics-6105-cs'
  }
];

async function scrapeSubject(config, supabase, adminId) {
  let allQa = [];

  for (let i = 1; i <= config.pages; i++) {
    const url = `${config.baseUrl}?page=${i}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
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
          
          if (!allQa.find(item => item.q === qText && item.a === aText)) {
            allQa.push({ q: qText, a: aText });
          }
        }
      }
    }
  }

  console.log(`[${config.name}] Total Unique Q&A Extracted: ${allQa.length}`);
  
  if (allQa.length !== config.expectedCount) {
    console.warn(`WARNING: Expected ${config.expectedCount} answers, but got ${allQa.length}! Continuing anyway.`);
  }

  fs.writeFileSync(`scripts/generated/${config.slug}_QA.json`, JSON.stringify(allQa, null, 2));

  let { data: subject, error: subErr } = await supabase.from('subjects').select('id').eq('slug', config.slug).single();
  
  if (subErr || !subject) {
    console.log(`Subject not found, creating ${config.name}...`);
    const { data: newSub, error: createErr } = await supabase.from('subjects').insert({
      name: config.name,
      slug: config.slug,
      is_active: true
    }).select('id').single();
    
    if (createErr) {
      console.error('Failed to create subject:', createErr);
      throw createErr;
    }
    subject = newSub;
  }

  console.log(`[${config.name}] Inserting into subject_id:`, subject.id);

  const payload = allQa
    .filter(item => item.q && item.a)
    .map((item, index) => ({
      subject_id: subject.id,
      question_text: item.q,
      answer_text: item.a,
      sort_order: index + 1,
      is_active: true,
      created_by: adminId
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
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: admin } = await supabase.from('profiles').select('id').limit(1).single();
  const adminId = admin ? admin.id : null;

  for (const target of TARGETS) {
    await scrapeSubject(target, supabase, adminId);
  }

  console.log('All Done!');
}

main().catch(console.error);
