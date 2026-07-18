const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) return console.error('Error listing users', listError);
  
  const neila = users.users.find(u => u.email === 'neilalima@hotmail.com');
  if (neila) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(neila.id);
    if (deleteError) console.error('Error deleting user', deleteError);
    else console.log('Neila deleted from auth.users (cascades to profiles).');
  } else {
    console.log('Neila not found in auth.users.');
  }
}
run();
