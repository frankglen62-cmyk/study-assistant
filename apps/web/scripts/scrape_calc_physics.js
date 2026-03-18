const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeSubject() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log('Navigating to subject page...');
  await page.goto('https://www.answerscrib.com/subject/calculus-based-physics-2', { waitUntil: 'networkidle2' });
  
  // Scroll to bottom gradually to trigger any lazy loading
  console.log('Scrolling down to load all items...');
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      let distance = 300;
      let timer = setInterval(() => {
        let scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight - window.innerHeight) {
          // just try a bit more
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
  
await new Promise(r => setTimeout(r, 3000)); // 3 seconds grace
  
  console.log('Extracting Q&A pairs...');
  
  const qas = await page.evaluate(() => {
    const results = [];
    
    // Find all nodes that are colored green, which indicate the answer
    const greenAnswers = Array.from(document.querySelectorAll('li, span, p, div, strong'))
      .filter(el => {
        const style = window.getComputedStyle(el);
        const isGreenColor = style.color === 'rgb(40, 167, 69)' || style.color === 'rgb(25, 135, 84)' || 
                             style.color === 'green' || el.className.includes('text-green') ||
                             el.style.color.includes('green') || style.color.includes('128, 0') ||
                             el.className.includes('text-success');
        
        return isGreenColor && el.innerText.trim().length > 0;
      });
      
    greenAnswers.forEach(ansNode => {
      let parent = ansNode.parentElement;
      let questionNode = null;
      
      for (let i = 0; i < 5; i++) {
         if (!parent) break;
         
         const pTokens = parent.querySelectorAll('p');
         if (pTokens.length > 0) {
            questionNode = pTokens[0];
            break;
         }
         parent = parent.parentElement;
      }
      
      if (questionNode) {
         results.push({
           questionText: questionNode.innerText.trim(),
           answerText: ansNode.innerText.trim()
         });
      }
    });
    
    return results;
  });
  
  console.log(`Extracted ${qas.length} raw pairs.`);
  
  if (qas.length > 0) {
    const dedupedQa = [];
    const seen = new Set();
    
    qas.forEach(pair => {
      let { questionText, answerText } = pair;
      // Normalizing slightly
      const key = questionText.trim().toLowerCase() + '|' + answerText.trim().toLowerCase();
      
      if (!seen.has(key)) {
        seen.add(key);
        dedupedQa.push(pair);
      }
    });
    
    console.log(`Saved ${dedupedQa.length} unique pairs.`);
    fs.writeFileSync('C:/Users/glenn/Documents/NEW PROJECT/Calculus_Based_Physics_2.json', JSON.stringify(dedupedQa, null, 2));
    console.log('Saved to Calculus_Based_Physics_2.json');
  } else {
    // Dump HTML for debugging
    const html = await page.content();
    fs.writeFileSync('C:/Users/glenn/Documents/NEW PROJECT/debug_answerscrib.html', html);
    console.log('Failed to extract patterns. Dumped rendered HTML to debug_answerscrib.html');
  }
  
  await browser.close();
}

scrapeSubject().catch(e => {
  console.error(e);
  process.exit(1);
});
