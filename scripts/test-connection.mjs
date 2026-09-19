import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ychtpkpfukatrminfarn.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_3GCZ0UqoVt-bCJzYU6fAIQ_ckZAKZGm';
const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Testing Supabase Connection...');

// 1. Test with anon key
const anonClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
const { data: anonData, error: anonError } = await anonClient.from('profiles').select('*').limit(1);

console.log('Anon client query to "profiles":', {
  error: anonError?.message || null,
  code: anonError?.code || null,
  data: anonData,
});

// 2. Test with secret key
const adminClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: adminData, error: adminError } = await adminClient.from('profiles').select('*').limit(1);

console.log('Admin client query to "profiles":', {
  error: adminError?.message || null,
  code: adminError?.code || null,
  data: adminData,
});
