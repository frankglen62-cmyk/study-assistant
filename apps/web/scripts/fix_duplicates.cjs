const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const slugs = [
    'technopreneurship',
    'unified-functional-testing',
    'data-communications-and-networking-4',
    'purposive-communication-1',
    'purposive-communication-2',
    'rhythmic-activities',
    'art-appreciation',
    'application-life-cycle-management',
    'cloud-computing-and-the-internet-of-things',
    'database-management-system-2',
    'ethics',
    'discrete-mathematics'
  ];

  for (const slug of slugs) {
    const { data: subject } = await supabase.from('subjects').select('id, name').eq('slug', slug).single();
    if (!subject) continue;

    console.log(`Checking ${subject.name}...`);
    
    // Fetch all pairs (using paginated fetch if > 1000, but we max out around 600)
    const { data: pairs, error } = await supabase
      .from('subject_qa_pairs')
      .select('id, question_text, answer_text')
      .eq('subject_id', subject.id);
      
    if (error) {
      console.error(`Error fetching pairs for ${subject.name}:`, error);
      continue;
    }
    
    if (!pairs) continue;

    const seen = new Set();
    const toDelete = [];

    for (const p of pairs) {
      const key = p.question_text + '|' + p.answer_text;
      if (seen.has(key)) {
        toDelete.push(p.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length > 0) {
      console.log(`Found ${toDelete.length} duplicates in ${subject.name}. Deleting...`);
      const chunkSize = 100;
      for (let i = 0; i < toDelete.length; i += chunkSize) {
        const chunk = toDelete.slice(i, i + chunkSize);
        await supabase.from('subject_qa_pairs').delete().in('id', chunk);
      }
      console.log(`Successfully deleted ${toDelete.length} duplicates for ${subject.name}. Now contains ${seen.size} rows.`);
    } else {
      console.log(`${subject.name} has no duplicates. Total rows: ${seen.size}`);
    }
  }
}

main().catch(console.error);
