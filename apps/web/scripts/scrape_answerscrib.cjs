const puppeteer = require('puppeteer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const TARGETS = [
  {
    name: 'Quantitative Methods',
    slug: 'quantitative-methods',
    expectedCount: 453,
    url: 'https://www.answerscrib.com/subject/quantitative-methods'
  },
  {
    name: 'System Administration and Maintenance',
    slug: 'system-administration-and-maintenance',
    expectedCount: 124,
    url: 'https://www.answerscrib.com/subject/system-administration-and-maintenance'
  }
];

async function scrapeSubject(config, browser, supabase, adminId) {
  console.log(`[${config.name}] Opening page...`);
  const page = await browser.newPage();
  
  await page.goto(config.url, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000)); 
  
  // Try to load more if there's pagination (Answerscrib sometimes loads all on scroll)
  for (let s = 0; s < 10; s++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const qas = await page.evaluate(() => {
    const results = [];
    const greenAnswers = Array.from(document.querySelectorAll('li, span, p, div, strong'))
      .filter(el => {
        const style = window.getComputedStyle(el);
        const isGreenColor = style.color === 'rgb(40, 167, 69)' || style.color === 'rgb(25, 135, 84)' || 
                             style.color === 'green' || el.className.includes('text-green') ||
                             el.style.color.includes('green') || style.color.includes('128, 0');
        
        return isGreenColor && el.innerText.trim().length > 0;
      });
      
    greenAnswers.forEach(ansNode => {
      let parent = ansNode.parentElement;
      let questionNode = null;
      for (let i = 0; i < 4; i++) {
         if (!parent) break;
         const pTokens = parent.querySelectorAll('p, strong, h3, h4');
         // Make sure we select the first legitimate text block that is not the answer node
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
         // remove letter prefixes like "d. " or "A. " from answerscrib answers
         aText = aText.replace(/^[A-Da-d]\.\s*/, '');
         results.push({ q: qText, a: aText });
      }
    });
    return results;
  });
  
  console.log(`[${config.name}] Extracted ${qas.length} raw pairs.`);
  
  let uniqueQa = [];
  qas.forEach(item => {
    if (!uniqueQa.find(ex => ex.q === item.q && ex.a === item.a)) {
      uniqueQa.push(item);
    }
  });

  console.log(`[${config.name}] Total Unique: ${uniqueQa.length} / Expected: ${config.expectedCount}`);
  
  if (uniqueQa.length > 0) {
    fs.writeFileSync(`apps/web/scripts/generated/${config.slug}_QA.json`, JSON.stringify(uniqueQa, null, 2));
    
    let { data: subject, error: subErr } = await supabase.from('subjects').select('id').eq('slug', config.slug).single();
    if (subErr || !subject) {
      console.log(`[${config.name}] Creating subject...`);
      const { data: newSub, error: createErr } = await supabase.from('subjects').insert({
        name: config.name,
        slug: config.slug,
        is_active: true
      }).select('id').single();
      if (createErr) throw createErr;
      subject = newSub;
    }

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
  }
  
  await page.close();
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: admin } = await supabase.from('profiles').select('id').limit(1).single();
  const adminId = admin ? admin.id : null;

  for (const target of TARGETS) {
    await scrapeSubject(target, browser, supabase, adminId);
  }

  await browser.close();
  console.log('All Answerscrib Done!');
}

main().catch(console.error);
