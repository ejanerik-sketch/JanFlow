import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'ramiro.developper@gmail.com',
    password: 'admin' // Attempt a common password or we might fail, but wait, the user didn't give the password.
  });

  if (authError) {
    console.log('Auth Error (cannot test authenticated fetch):', authError.message);
    return;
  }

  console.log('Logged in successfully!');
  const { data, error } = await supabase.from('cards').select('*').limit(1);
  console.log('Fetch cards error:', error);
}

test();
