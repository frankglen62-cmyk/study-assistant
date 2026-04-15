// Quick script to create the question-images bucket in Supabase Storage
// Run with: node scripts/create_question_images_bucket.mjs

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  console.error('Run with: set NEXT_PUBLIC_SUPABASE_URL=... && set SUPABASE_SERVICE_ROLE_KEY=... && node scripts/create_question_images_bucket.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // 1. Create the bucket
  const { data, error } = await supabase.storage.createBucket('question-images', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
  });

  if (error) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Bucket "question-images" already exists!');
    } else {
      console.error('❌ Failed to create bucket:', error.message);
      process.exit(1);
    }
  } else {
    console.log('✅ Bucket "question-images" created successfully!', data);
  }

  // 2. Verify it exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const found = buckets?.find(b => b.name === 'question-images');
  if (found) {
    console.log('✅ Verified: bucket exists, public:', found.public);
  } else {
    console.log('⚠️ Bucket not found in list');
  }
}

main().catch(console.error);
