const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeSubject() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  console.log('Navigating to subject page...');
  await page.goto('https://www.answerscrib.com/subject/information-tech-capstone-project', { waitUntil: 'networkidle2' });
  
  // Wait for the <p> tags holding the questions to appear
  await page.waitForTimeout(3000); // 3 seconds grace for animations/fetches
  
  console.log('Extracting Q&A pairs...');
  
  const qas = await page.evaluate(() => {
    const results = [];
    
    // Most Q&A sites wrap each pair in an article or a discrete container div
    // But since the structure is unknown, we can look for the green text, then step out.
    // Answerscrib usually uses something like <li class="... text-green- ...">
    const greenAnswers = Array.from(document.querySelectorAll('li, span, p, div, strong'))
      .filter(el => {
        // Find elements that have inline style color=green OR class containing text-green
        const style = window.getComputedStyle(el);
        const isGreenColor = style.color === 'rgb(40, 167, 69)' || style.color === 'rgb(25, 135, 84)' || 
                             style.color === 'green' || el.className.includes('text-green') ||
                             el.style.color.includes('green') || style.color.includes('128, 0');
        
        return isGreenColor && el.innerText.trim().length > 0;
      });
      
    greenAnswers.forEach(ansNode => {
      // Find the closest parent that contains both the answer and its question
      // Usually it's a div holding the <p> question and the <ul> choices
      let parent = ansNode.parentElement;
      let questionNode = null;
      
      // Traverse up to 4 levels to find a <p> or <strong> that might act as the question
      for (let i = 0; i < 4; i++) {
         if (!parent) break;
         
         // In typical Answerscrib, question is a <p> right above the <ul>
         const pTokens = parent.querySelectorAll('p');
         if (pTokens.length > 0) {
            questionNode = pTokens[0];
            break;
         }
         parent = parent.parentElement;
      }
      
      if (questionNode) {
         results.push({
           q: questionNode.innerText.trim(),
           a: ansNode.innerText.trim()
         });
      }
    });
    
    return results;
  });
  
  console.log(`Extracted ${qas.length} pairs.`);
  
  if (qas.length > 0) {
    let csvData = 'Question,Answer\n';
    
    // Deduplicate
    const seen = new Set();
    qas.forEach(pair => {
      let { q, a } = pair;
      const key = q + '|' + a;
      if (seen.has(key)) return;
      seen.add(key);
      
      if (q.includes(',') || q.includes('"') || q.includes('\n')) q = '"' + q.replace(/"/g, '""') + '"';
      if (a.includes(',') || a.includes('"') || a.includes('\n')) a = '"' + a.replace(/"/g, '""') + '"';
      
      csvData += `${q},${a}\n`;
    });
    
    fs.writeFileSync('C:/Users/glenn/Documents/NEW PROJECT/Information_Tech_Capstone_Project_QA.csv', csvData);
    console.log('Saved to Information_Tech_Capstone_Project_QA.csv');
  } else {
    // Dump HTML for debugging
    const html = await page.content();
    fs.writeFileSync('C:/Users/glenn/Documents/NEW PROJECT/debug_answerscrib.html', html);
    console.log('Failed to extract patterns. Dumped rendered HTML to debug_answerscrib.html');
  }
  
  await browser.close();
}

scrapeSubject();
