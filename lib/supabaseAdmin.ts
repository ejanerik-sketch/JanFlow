import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Optional: check if keys are present
if (!supabaseUrl || !supabaseServiceKey) {
  // We don't throw here to avoid crashing during build if keys are missing in CI
  // But we should log or handle it when used
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
