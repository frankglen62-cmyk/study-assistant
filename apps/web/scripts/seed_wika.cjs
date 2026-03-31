const fs = require('fs');

const html = fs.readFileSync('c:/Users/glenn/Documents/NEW PROJECT/wika_html.txt', 'utf8');

let results = [];
const qBlocks = html.split('itemtype=\"https://schema.org/Question\"');

for (let i = 1; i < qBlocks.length; i++) {
   const block = qBlocks[i];
   let qMatch = block.match(/itemprop=\"name\"[^>]*>([\s\S]*?)<\/p>/);
   if (!qMatch) continue;
   let q = qMatch[1].trim();

   let a = '';
   let answerMatch = block.match(/<li[^>]*class=\"[^\"]*text-success[^\"]*\"[^>]*>([\s\S]*?)<\/li>/);
   if (answerMatch) {
       a = answerMatch[1].replace(/<[^>]+>/g, '').trim();
   } else {
       let bMatch = block.match(/<li[^>]*>.*<b>([\s\S]*?)<\/b>.*<\/li>/);
       if (bMatch) {
           a = bMatch[1].replace(/<[^>]+>/g, '').trim();
       }
   }

   // Manual overrides for the 7 missing ones
   if (q.includes('Sapagkat mabilis malalaman at makapamimili')) {
       a = 'Social dialect';
   } else if (q.includes('Taong gumagamit ng wikang hindi naghahalo')) {
       a = 'Purista';
   } else if (q.includes('Pinauunlad ng agham ang wikang Filipino sa anumang aspekto')) {
       a = 'True';
   } else if (q.includes('Nagkakaroon ng komplikasyon sa wika kapag may teknolohiya')) {
       a = 'True';
   } else if (q.includes('Ano ang nais ipahiwatig ng Saligang batas 1987')) {
       a = 'Ang wikang Filipino ay pinauunlad ng lahat ng umiiral na wika sa bansa';
   } else if (q.includes('Bago dumating ang mga Kastila ay walang kulturang')) {
       a = 'True';
   } else if (q.includes('Anong panlabas na epekto ng cross-culture')) {
       a = 'Ang pagbabagong bihis ng wika gayundin ang lahing nabuo dahil sa nagsamang kultura at wika mula sa magkaibang kultura at magsasama bilang isang kultura.';
   }

   if (a) {
       // handle Answerscrib's "Answer - " prefix if any
       a = a.replace(/^[A-Da-d]\.\s*/, '').trim();
       results.push({ q, a });
   }
}

// deduplicate
const uniqueSet = new Set();
const uniqueItems = [];
for (const item of results) {
    const key = `${item.q}|||${item.a}`.trim().toLowerCase();
    if (!uniqueSet.has(key)) {
        uniqueSet.add(key);
        uniqueItems.push(item);
    }
}

console.log('Total Output QAs:', uniqueItems.length);

fs.writeFileSync('scripts/generated/wika-lipunan-at-kultura_QA.json', JSON.stringify(uniqueItems, null, 2));

console.log('JSON file successfully generated! Now proceeding to seed database...');

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
   console.log('Missing Supabase variables');
   process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
   const slug = 'wika-lipunan-at-kultura';
   const name = 'Wika Lipunan at Kultura';
   
   let { data: subject, error: sErr } = await supabase.from('subjects').select('*').eq('slug', slug).single();
   if (!subject) {
       console.log('Subject not found, creating...');
       const { data: newSub, error: crErr } = await supabase.from('subjects').insert({name, slug, is_active: true}).select('*').single();
       if (crErr) throw crErr;
       subject = newSub;
   }

   console.log('Cleaning old QAs...');
   await supabase.from('subject_qa_pairs').delete().eq('subject_id', subject.id);

   console.log('Inserting', uniqueItems.length, 'pairs...');
   const chunks = [];
   for (let i = 0; i < uniqueItems.length; i += 100) {
       chunks.push(uniqueItems.slice(i, i + 100));
   }

   const { data: admin } = await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).single();
   const adminId = admin ? admin.id : null;
   if (!adminId) throw new Error('No admin user found to set created_by');

   let count = 0;
   for (let chunk of chunks) {
       const mapped = chunk.map((c, i) => ({
           subject_id: subject.id,
           question_text: c.q,
           answer_text: c.a,
           sort_order: count + i,
           created_by: adminId
       }));
       const { error: insErr } = await supabase.from('subject_qa_pairs').insert(mapped);
       if (insErr) {
           console.error('Insert error', insErr);
       }
       count += chunk.length;
   }

   console.log('Success! Wika Lipunan seeded.');
})();
