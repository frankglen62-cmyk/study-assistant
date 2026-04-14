const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log("Loading env...");
  const envRaw = fs.readFileSync('apps/web/.env.local', 'utf8');
  const env = envRaw.split('\n').reduce((acc, line) => { 
    const idx = line.indexOf('=');
    if(idx !== -1) {
      acc[line.substring(0, idx).trim()] = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, ''); 
    }
    return acc; 
  }, {}); 
  
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('https://www.answerscrib.com/subject/load-testing.php/data-communications-and-networking-2', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3000)); 
  
  // Scroll to load all
  for (let s = 0; s < 10; s++) {
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
  }
  
  const qas = await page.evaluate(() => {
    const results = [];
    const listItems = Array.from(document.querySelectorAll('li'));
    
    listItems.forEach(li => {
      const boldElem = li.querySelector('b, strong');
      const isBoldCss = window.getComputedStyle(li).fontWeight === '700' || window.getComputedStyle(li).fontWeight === 'bold';
      
      let isAnswer = false;
      let aText = "";
      
      if (boldElem && boldElem.innerText.trim().length > 0) {
        isAnswer = true;
        aText = boldElem.innerText.trim();
      } else if (isBoldCss && li.innerText.trim().length > 0) {
        isAnswer = true;
        aText = li.innerText.trim();
      }
      
      if (isAnswer) {
        let parentUl = li.closest('ul, ol');
        if (parentUl) {
          let curr = parentUl.previousElementSibling;
          let questionNode = null;
          
          for(let i=0; i<8; i++) {
            if(!curr) break;
            const text = curr.innerText ? curr.innerText.trim() : '';
            if (text.length > 0 && curr.tagName !== 'UL' && curr.tagName !== 'OL') {
               questionNode = curr;
               break;
            }
            curr = curr.previousElementSibling;
          }
          
          if (questionNode) {
            let qText = questionNode.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            aText = aText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            aText = aText.replace(/^[A-Da-d]\.\s*/, '');
            results.push({ q: qText, a: aText });
          }
        }
      }
    });

    return results;
  });
  
  let uniqueQa = [];
  qas.forEach(item => {
    if (!uniqueQa.find(ex => ex.q === item.q && ex.a === item.a)) {
      uniqueQa.push(item);
    }
  });

  console.log(`Found ${uniqueQa.length} unique pairs out of ${qas.length} raw pairs.`);
  
  // Get subject ID and Admin ID
  const { data: subject, error: subErr } = await supabase.from('subjects').select('id').ilike('name', 'Load Testing%').limit(1).single();
  if (subErr || !subject) throw new Error("Couldn't find Load Testing subject");
  
  const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'super_admin').limit(1).single();
  const adminId = admin ? admin.id : null;

  const payload = uniqueQa.map((item, index) => ({
    subject_id: subject.id,
    question_text: item.q,
    answer_text: item.a,
    sort_order: index + 1,
    is_active: true,
    created_by: adminId
  }));

  console.log(`Inserting ${payload.length} items into Load Testing...`);
  const chunkSize = 100;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    const { error } = await supabase.from('subject_qa_pairs').insert(chunk);
    if (error) {
      console.error(`Error inserting chunk:`, error);
      throw error;
    }
  }

  console.log("Successfully inserted all pairs into Load Testing subject!");
  await browser.close();
}

main().catch(console.error);
