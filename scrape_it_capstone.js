const fs = require('fs');

function extractQaPairs() {
  const html = fs.readFileSync('C:/Users/glenn/Documents/NEW PROJECT/temp_answerscrib.html', 'utf8');
  let csvData = 'Question,Answer\n';
  let count = 0;

  // Split by <hr> tags or typical container limits on answerscrib
  const blocks = html.split('<hr');

  for (let block of blocks) {
    if (!block.includes('text-green-')) continue;

    // The question is usually in a paragraph inside this block
    const questionMatch = block.match(/<p>([\s\S]*?)<\/p>/i);
    // The answer is marked with text-green-something
    const answerMatch = block.match(/class=\"[^\"]*text-green-[^\"]*\"[^>]*>([\s\S]*?)<\/(li|span|p|div|strong)>/i) || 
                       block.match(/class='[^']*text-green-[^']*'[^>]*>([\s\S]*?)<\/(li|span|p|div|strong)>/i);

    if (questionMatch && answerMatch) {
      let q = questionMatch[1].replace(/<[^>]*>?/gm, '').trim();
      let a = answerMatch[1].replace(/<[^>]*>?/gm, '').trim();

      // Clean HTML entities manually
      const unescapeHtml = (text) => {
        return text.replace(/&nbsp;/g, ' ')
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&#39;/g, "'")
                   .replace(/&quot;/g, '"');
      };

      q = unescapeHtml(q);
      a = unescapeHtml(a);

      // Escape CSV syntax
      if (q.includes(',') || q.includes('"') || q.includes('\n')) {
        q = '"' + q.replace(/"/g, '""') + '"';
      }
      if (a.includes(',') || a.includes('"') || a.includes('\n')) {
        a = '"' + a.replace(/"/g, '""') + '"';
      }

      // Sometimes Q&A blocks have blank matches if the regex caught a layout spacer
      if (q.length > 0 && a.length > 0) {
        csvData += `${q},${a}\n`;
        count++;
      }
    }
  }

  console.log(`Successfully parsed ${count} Q&A pairs.`);
  fs.writeFileSync('C:/Users/glenn/Documents/NEW PROJECT/Information_Tech_Capstone_Project_QA.csv', csvData);
}

extractQaPairs();
