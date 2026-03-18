const puppeteer = require('puppeteer');

const urls = [
  'https://amauoed.com/courses/nsci/calculus-based-physics-1-6100-nsci',
  'https://amauoed.com/courses/nsci/calculus-based-physics-1-6100-nsci?page=2',
  'https://amauoed.com/courses/nsci/calculus-based-physics-1-6100-nsci?page=3'
];

async function checkCounts() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  for (let i = 0; i < urls.length; i++) {
    await page.goto(urls[i], { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    const counts = await page.evaluate(() => {
      const cards = document.querySelectorAll('.card.mb-2.bg-secondary .card-body');
      let withCorrect = 0;
      let withoutCorrect = 0;
      
      cards.forEach(card => {
        const correctChip = card.querySelector('.chip.bg-success');
        if (correctChip && correctChip.innerText.trim().toLowerCase() === 'correct') {
          withCorrect++;
        } else {
          withoutCorrect++;
        }
      });
      return { total: cards.length, withCorrect, withoutCorrect };
    });
    
    console.log(`Page ${i + 1}: Total Cards=${counts.total}, With Correct=${counts.withCorrect}, Without Correct=${counts.withoutCorrect}`);
  }
  
  await browser.close();
}

checkCounts().catch(console.error);
