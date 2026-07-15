import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

const envPath = new URL('../.env.local', import.meta.url);
if (existsSync(envPath)) loadEnvFile(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .or('name.ilike.%Integrative Programming%,name.ilike.%Web Application Development 2%');
  console.log(JSON.stringify(data, null, 2));
}

main();
