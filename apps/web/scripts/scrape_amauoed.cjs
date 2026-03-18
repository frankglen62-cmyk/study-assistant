const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

const urls = [
  'https://amauoed.com/courses/nsci/calculus-based-physics-1-6100-nsci',
  'https://amauoed.com/courses/nsci/calculus-based-physics-1-6100-nsci?page=2',
  'https://amauoed.com/courses/nsci/calculus-based-physics-1-6100-nsci?page=3'
];

async function scrapeAmauoed() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  let allQas = [];
  
  for (let i = 0; i < urls.length; i++) {
    console.log(`Navigating to Page ${i + 1}: ${urls[i]}`);
    await page.goto(urls[i], { waitUntil: 'networkidle2' });
    
    // Give it a brief moment to render text
    await new Promise(r => setTimeout(r, 2000));
    
    // Scroll to bottom to ensure all cards are loaded
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        let distance = 300;
        let timer = setInterval(() => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const pageQas = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll('.card.mb-2.bg-secondary .card-body');
      
      cards.forEach(card => {
        const qDiv = card.querySelector('div.mb-2');
        if (!qDiv) return;
        
        const questionText = qDiv.innerText.trim();
        
        // Find the correct answer (has chip bg-success)
        const items = card.querySelectorAll('li');
        let answerText = null;
        for (let li of items) {
          const chip = li.querySelector('.chip.bg-success');
          if (chip && chip.innerText.trim().toLowerCase() === 'correct') {
            // The answer is usually in a strong tag or just text inside li
            const strong = li.querySelector('strong');
            if (strong) {
              answerText = strong.innerText.trim();
            } else {
              // fallback if no strong tag
              answerText = li.innerText.replace('Correct', '').trim();
            }
            break;
          }
        }
        
        if (questionText && answerText) {
          results.push({ questionText, answerText });
        }
      });
      return results;
    });
    
    console.log(`Page ${i + 1} extracted pairs: ${pageQas.length}`);
    allQas.push(...pageQas);
  }
  
  console.log(`Total extracted raw pairs: ${allQas.length}`);
  
  if (allQas.length === 222) {
    console.log('SUCCESS: Exactly 222 pairs extracted as expected per user requirement!');
  } else {
    console.log(`WARNING: Expected 222 pairs but got ${allQas.length}`);
  }
  
  // Deduplicate
  const dedupedQa = [];
  const seen = new Set();
  
  allQas.forEach(pair => {
    const key = pair.questionText.trim().toLowerCase() + '|' + pair.answerText.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      dedupedQa.push(pair);
    }
  });
  
  console.log(`Saved ${dedupedQa.length} unique pairs out of ${allQas.length} raw pairs.`);
  const outPath = 'C:/Users/glenn/Documents/NEW PROJECT/apps/web/scripts/generated/amauoed_physics_1.json';
  fs.writeFileSync(outPath, JSON.stringify(dedupedQa, null, 2));
  console.log(`Saved to ${outPath}`);
  
  console.log('Importing to Supabase via script for Calculus-Based Physics 2...');
  try {
    const output = execSync(`node "C:/Users/glenn/Documents/NEW PROJECT/apps/web/scripts/import-subject-qa-json.mjs" --json "C:/Users/glenn/Documents/NEW PROJECT/apps/web/scripts/generated/amauoed_physics_1.json" --name "Calculus-Based Physics 2" --code "UGRD-NSCI6101"`, { stdio: 'inherit' });
    console.log('Import finished.');
  } catch(e) {
    console.error('Import failed', e);
  }
  
  await browser.close();
}

scrapeAmauoed().catch(e => {
  console.error(e);
  process.exit(1);
});
