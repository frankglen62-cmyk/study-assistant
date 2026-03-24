const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function scrapeArtAppreciation() {
  let allQa = [];

  for (let i = 1; i <= 4; i++) {
    const url = `https://amauoed.com/courses/ge/art-appreciation-6115-ge?page=${i}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url);
    const html = await res.text();

    const cardRegex = /<div class="card mb-2 bg-secondary">([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;
    while ((match = cardRegex.exec(html)) !== null) {
      const cardHtml = match[1];

      const qMatch = cardHtml.match(/<div class="mb-2">([\s\S]*?)<\/div>/);
      const optionsMatch = cardHtml.match(/<ul>([\s\S]*?)<\/ul>/);

      if (qMatch && optionsMatch) {
        let qText = qMatch[1].replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        
        const ansMatch = optionsMatch[1].match(/<li><strong>([\s\S]*?)<\/strong>\s*<span class="chip bg-success">Correct<\/span><\/li>/);
        if (ansMatch) {
          let aText = ansMatch[1].replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          
          if (!allQa.find(item => item.q === qText && item.a === aText)) {
            allQa.push({ q: qText, a: aText });
          }
        }
      }
    }
  }

  console.log(`Total Unique Q&A Extracted: ${allQa.length}`);
  fs.writeFileSync('scripts/generated/Art_Appreciation_QA.json', JSON.stringify(allQa, null, 2));

  // Now seed to Supabase
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Find or create subject
  let { data: subject, error: subErr } = await supabase.from('subjects').select('id').eq('name', 'Art Appreciation').single();
  
  if (subErr || !subject) {
    console.log('Subject not found, creating Art Appreciation...');
    const { data: newSub, error: createErr } = await supabase.from('subjects').insert({
      name: 'Art Appreciation',
      slug: 'art-appreciation',
      is_active: true
    }).select('id').single();
    
    if (createErr) {
      console.error('Failed to create subject:', createErr);
      throw createErr;
    }
    subject = newSub;
  }

  console.log('Inserting into subject_id:', subject.id);

  const { data: admin } = await supabase.from('profiles').select('id').limit(1).single();
  const adminId = admin ? admin.id : null;

  const payload = allQa.map((item, index) => ({
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
    if (error) {
      console.error('Error inserting chunk:', error);
    } else {
      console.log(`Inserted batch ${i} to ${i + chunk.length}`);
    }
  }

  console.log('All Done!');
}

scrapeArtAppreciation();
