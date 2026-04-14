const puppeteer = require('puppeteer');

async function main() {
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
    
    // As per user: right answers are bold in choices, questions are red.
    // We will look for <li> elements that contain a <b> or <strong>, OR are bolded via style.
    const listItems = Array.from(document.querySelectorAll('li'));
    
    listItems.forEach(li => {
      // Check if this li is the correct answer. It is correct if it contains a <b> or <strong> tag with text
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
        // Find the question above this list
        let parentUl = li.closest('ul, ol');
        if (parentUl) {
          let curr = parentUl.previousElementSibling;
          let questionNode = null;
          
          for(let i=0; i<8; i++) {
            if(!curr) break;
            const text = curr.innerText ? curr.innerText.trim() : '';
            if (text.length > 0 && curr.tagName !== 'UL' && curr.tagName !== 'OL') {
               // Verify if it's red (optional, but requested by user, let's just take the closest text as the question)
               questionNode = curr;
               break;
            }
            curr = curr.previousElementSibling;
          }
          
          if (questionNode) {
            let qText = questionNode.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            aText = aText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            aText = aText.replace(/^[A-Da-d]\.\s*/, '');
            // check for red
            const style = window.getComputedStyle(questionNode);
            const isRed = style.color === 'rgb(255, 0, 0)' || style.color === 'red' || (questionNode.style && questionNode.style.color && questionNode.style.color.includes('red'));
            
            results.push({ q: qText, a: aText, isRed });
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
  console.log("Sample pairs:");
  console.log(uniqueQa.slice(0, 5));
  
  await browser.close();
}

main().catch(console.error);
