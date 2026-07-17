const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.rpc('run_sql', { query: "SELECT policyname, qual, with_check FROM pg_policies WHERE tablename = 'transactions'" });
  console.log(data);
}
run();
