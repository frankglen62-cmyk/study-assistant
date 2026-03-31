const puppeteer = require('puppeteer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const TARGETS = [
  {
    name: 'Information Technology Practicum',
    slug: 'information-technology-practicum',
    expectedCount: 80,
    url: 'https://www.answerscrib.com/subject/information-technology-practicum'
  },
  {
    name: 'Computer Fundamentals',
    slug: 'computer-fundamentals',
    expectedCount: 164,
    url: 'https://www.answerscrib.com/subject/computer-fundamentals'
  },
  {
    name: 'Web Application Development 2',
    slug: 'web-application-development-2',
    expectedCount: 222,
    url: 'https://www.answerscrib.com/subject/web-application-development'
  }
];

async function scrapeAnswerscrib(config, browser, supabase, adminId) {
  console.log(`[${config.name}] Opening page...`);
  const page = await browser.newPage();
  
  await page.goto(config.url, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 5000)); 
  
  // Try to load more if there's pagination (Answerscrib sometimes loads all on scroll)
  for (let s = 0; s < 25; s++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const qas = await page.evaluate(() => {
    const results = [];
    const mainCards = document.querySelectorAll('div.card-body, div.post-content, li.list-group-item, div.mb-4, .search-result');
    
    // Some general answerscrib extraction logic based on the HTML structure
    if (mainCards.length > 0) {
       mainCards.forEach(card => {
         const greenAns = card.querySelector('.text-success, [style*="color: green"], [style*="color: rgb(40, 167, 69)"], [style*="color:#28A745"]');
         if (greenAns) {
             let qText = card.innerText.replace(greenAns.innerText, '').trim();
             // attempt to extract just the question from mixed text if its format 'Q: ... A: ...'
             const firstLineMatches = qText.split('\n');
             if (firstLineMatches.length > 0) qText = firstLineMatches[0].trim();

             let aText = greenAns.innerText.trim();
             aText = aText.replace(/^[A-Da-d]\.\s*/, '');
             results.push({ q: qText, a: aText });
         }
       });
    }

    // fallback extraction for other answerscrib layouts
    if (results.length === 0) {
      const greenAnswers = Array.from(document.querySelectorAll('li, span, p, div, strong'))
        .filter(el => {
          const style = window.getComputedStyle(el);
          const isGreenColor = style.color === 'rgb(40, 167, 69)' || style.color === 'rgb(25, 135, 84)' || 
                               style.color === 'green' || el.className.includes('text-success') ||
                               (el.style && el.style.color && el.style.color.includes('green'));
          return isGreenColor && el.innerText.trim().length > 0;
        });
        
      greenAnswers.forEach(ansNode => {
        let parent = ansNode.parentElement;
        let questionNode = null;
        for (let i = 0; i < 4; i++) {
           if (!parent) break;
           const pTokens = parent.querySelectorAll('p, strong, h3, h4, div.question-text');
           for (let p of pTokens) {
              if (p !== ansNode && p.innerText.trim().length > 0) {
                 questionNode = p;
                 break;
              }
           }
           if (questionNode) break;
           parent = parent.parentElement;
        }
        
        if (questionNode) {
           let qText = questionNode.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
           let aText = ansNode.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
           aText = aText.replace(/^[A-Da-d]\.\s*/, '');
           results.push({ q: qText, a: aText });
        }
      });
    }

    return results;
  });
  
  console.log(`[${config.name}] Extracted ${qas.length} raw pairs.`);
  
  // Apply deduplication per user request: "ibalik mo yung duplication filter para sa lahat dapat may ganun ayoko ng may duplicate like same question at answer, pwede same question pero different answer"
  let uniqueQa = [];
  qas.forEach(item => {
    if (!uniqueQa.find(ex => ex.q === item.q && ex.a === item.a)) {
      uniqueQa.push(item);
    }
  });

  console.log(`[${config.name}] Total Unique: ${uniqueQa.length} / Expected: ${config.expectedCount}`);
  
  if (uniqueQa.length > 0) {
    fs.writeFileSync(`scripts/generated/${config.slug}_QA.json`, JSON.stringify(uniqueQa, null, 2));
    
    let { data: subject, error: subErr } = await supabase.from('subjects').select('id, name').eq('slug', config.slug).single();
    if (subErr || !subject) {
      console.log(`[${config.name}] Creating subject...`);
      const { data: newSub, error: createErr } = await supabase.from('subjects').insert({
        name: config.name,
        slug: config.slug,
        is_active: true
      }).select('id, name').single();
      if (createErr) throw createErr;
      subject = newSub;
    } else {
      console.log(`[${config.name}] Subject exists:`, subject.name);
    }

    console.log(`[${config.name}] Cleaning old QA for this subject to prevent old duplicates...`);
    await supabase.from('subject_qa_pairs').delete().eq('subject_id', subject.id);

    const payload = uniqueQa.filter(item => item.q && item.a).map((item, index) => ({
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
      if (error) console.error(`[${config.name}] Error inserting chunk:`, error);
    }
    console.log(`[${config.name}] Database seeded.`);
  } else {
    console.warn(`[${config.name}] Failed to extract any QAs!`);
  }
  
  await page.close();
}

async function scrapeBlogspot(config, browser, supabase, adminId) {
  console.log(`[${config.name}] Opening page...`);
  const page = await browser.newPage();
  
  await page.goto(config.url, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000)); 
  
  const qas = await page.evaluate(() => {
    const results = [];
    const html = document.body.innerHTML;
    // split by <br> or <br />
    const segments = html.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]+>/g, '').trim()).filter(s => s.length > 0);
    
    // We are looking for sequences like:
    // Segment 1: Question
    // Segment 2: ----Answer
    for (let i = 0; i < segments.length - 1; i++) {
        if (segments[i+1].startsWith('----')) {
            const q = segments[i].trim();
            let a = segments[i+1].substring(4).trim();
            // remove letter prefixes
            a = a.replace(/^[A-Da-d]\.\s*/, '');
            if (q.length > 5 && a.length > 0) {
               results.push({ q, a });
            }
        }
    }
    return results;
  });
  
  console.log(`[${config.name}] Extracted ${qas.length} raw pairs.`);
  
  // Include deduplication "ibalik mo yung duplication filter"
  let uniqueQa = [];
  qas.forEach(item => {
    if (!uniqueQa.find(ex => ex.q === item.q && ex.a === item.a)) {
      uniqueQa.push(item);
    }
  });

  console.log(`[${config.name}] Total Unique: ${uniqueQa.length}`);
  
  if (uniqueQa.length > 0) {
    fs.writeFileSync(`scripts/generated/${config.slug}_QA.json`, JSON.stringify(uniqueQa, null, 2));
    
    let { data: subject, error: subErr } = await supabase.from('subjects').select('id, name').eq('slug', config.slug).single();
    if (subErr || !subject) {
      console.log(`[${config.name}] Creating subject...`);
      const { data: newSub, error: createErr } = await supabase.from('subjects').insert({
        name: config.name,
        slug: config.slug,
        is_active: true
      }).select('id, name').single();
      if (createErr) throw createErr;
      subject = newSub;
    } else {
      console.log(`[${config.name}] Subject exists:`, subject.name);
    }

    console.log(`[${config.name}] Cleaning old QA for this subject to prevent old duplicates...`);
    await supabase.from('subject_qa_pairs').delete().eq('subject_id', subject.id);

    const payload = uniqueQa.filter(item => item.q && item.a).map((item, index) => ({
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
      if (error) console.error(`[${config.name}] Error inserting chunk:`, error);
    }
    console.log(`[${config.name}] Database seeded.`);
  } else {
    console.warn(`[${config.name}] Failed to extract any QAs!`);
  }
  
  await page.close();
}


async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
  const adminId = admin ? admin.id : null;
  console.log('Using Admin ID:', adminId);

  // Wika Lipunan
  const wikaConfig = {
    name: 'Wika Lipunan at Kultura',
    slug: 'wika-lipunan-at-kultura',
    url: 'https://jennysonline.blogspot.com/2021/08/wika-lipunan-at-kultura.html'
  };
  await scrapeBlogspot(wikaConfig, browser, supabase, adminId);

  // Answerscribs
  for (const target of TARGETS) {
    await scrapeAnswerscrib(target, browser, supabase, adminId);
  }

  await browser.close();
  console.log('All Done!');
}

main().catch(console.error);
