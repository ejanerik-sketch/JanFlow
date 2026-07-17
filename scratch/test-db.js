import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles test:', error || 'Success');

  const { data: cData, error: cError } = await supabase.from('transactions').select('*').limit(1);
  console.log('Transactions test:', cError || 'Success');
}

run();
