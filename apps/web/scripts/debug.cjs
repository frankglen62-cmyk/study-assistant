const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  console.log('Testing Computer Fundamentals...');
  await page.goto('https://www.answerscrib.com/subject/computer-fundamentals', {waitUntil: 'networkidle2'});

  for(let i=0; i<15; i++) {
     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
     await new Promise(r => setTimeout(r, 1000));
  }
  let txts = await page.evaluate(() => Array.from(document.querySelectorAll('.text-success')).map(e => e.innerText));
  console.log('Count:', txts.length);

  const loadMoreBtn = await page.evaluate(() => {
     let b = Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.toLowerCase().includes('load more'));
     return !!b;
  });
  console.log('Has Load More button:', loadMoreBtn);

  console.log('Testing Web App Dev search...');
  await page.goto('https://www.answerscrib.com/search/search-all?q=WEB+APPLICATION+DEVELOPMENT+2+', {waitUntil: 'networkidle2'});
  
  const searchResults = await page.evaluate(() => {
     return Array.from(document.querySelectorAll('.card, .search-result')).map(c => c.innerText.substring(0, 50));
  });
  console.log('Search Results:', searchResults.length, searchResults.slice(0, 3));
  
  await browser.close();
})();
