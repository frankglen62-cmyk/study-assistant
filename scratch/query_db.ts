import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

const envPath = new URL('../apps/web/.env.local', import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, code')
    .or('name.ilike.%Application Development and Emerging Technology%,name.ilike.%UGRD-IT6315%,name.ilike.%DATABASE%');

  if (error) {
    console.error('Error fetching subjects:', error);
  } else {
    console.log('Subjects found:', JSON.stringify(data, null, 2));
  }
}

main();
