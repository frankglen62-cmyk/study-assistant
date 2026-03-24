const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const targetSlug = 'cloud-computing-and-the-internet-of-things';
  const filePath = path.join(__dirname, 'generated', `${targetSlug}_QA.json`);

  console.log(`Processing ${targetSlug}...`);

  const { data: subject, error: subErr } = await supabase
    .from('subjects')
    .select('id')
    .eq('slug', targetSlug)
    .single();

  const { data: adminUser, error: adminErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'super_admin')
    .limit(1)
    .single();

  if (adminErr || !adminUser) {
    console.error('Super admin not found!', adminErr);
    process.exit(1);
  }

  const subjectId = subject.id;
  const adminId = adminUser.id;

  console.log(`Deleting existing QA pairs for subject_id: ${subjectId}`);
  const { error: delErr } = await supabase
    .from('subject_qa_pairs')
    .delete()
    .eq('subject_id', subjectId);

  if (delErr) {
    console.error('Error deleting!', delErr);
    process.exit(1);
  }
  console.log('Successfully deleted existing pairs.');

  if (!fs.existsSync(filePath)) {
    console.error('JSON file missing!', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const allQa = JSON.parse(raw);

  const payload = allQa
    .filter(item => item.q && item.a)
    .filter((item, index, self) => index === self.findIndex((t) => t.q === item.q && t.a === item.a))
    .map((item, index) => ({
      subject_id: subjectId,
      question_text: item.q,
      answer_text: item.a,
      sort_order: index + 1,
      is_active: true,
      created_by: adminId
    }));

  console.log(`Inserting exactly ${payload.length} distinct pairs...`);

  const BATCH_SIZE = 100;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const chunk = payload.slice(i, i + BATCH_SIZE);
    const { error: insErr } = await supabase.from('subject_qa_pairs').insert(chunk);
    if (insErr) {
      console.error('Insert error at chunk', i, insErr);
      process.exit(1);
    }
    console.log(`[${targetSlug}] Inserted batch ${i} to ${i + chunk.length}`);
  }

  console.log(`Finished resetting ${targetSlug} to exactly ${payload.length} items.`);
}

run().catch(console.error);
