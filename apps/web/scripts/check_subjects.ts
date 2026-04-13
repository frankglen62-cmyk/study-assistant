import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://aciihkqecsehqxaikoir.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjaWloa3FlY3NlaHF4YWlrb2lyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzMxMzUxNSwiZXhwIjoyMDg4ODg5NTE1fQ.cl06KpZQ770RhDOmXGOe0OP1aKyBIWhuwoIi3UXZ0fE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .or('name.ilike.%Integrative Programming%,name.ilike.%Web Application Development 2%');
  console.log(JSON.stringify(data, null, 2));
}

main();
