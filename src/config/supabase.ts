import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isProduction = Boolean(import.meta.env.PROD);

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder-hyd-logix') &&
  !supabaseAnonKey.includes('placeholder-anon-key')
);

export const configError: string | null = (!isSupabaseConfigured && isProduction)
  ? 'FATAL CONFIGURATION ERROR: Live Supabase credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing in this production deployment. Mock authentication is strictly disabled in production mode.'
  : null;

if (!isSupabaseConfigured) {
  if (isProduction) {
    console.error(configError);
  } else {
    console.warn(
      '[HYD-LOGIX] Dev Mode: Live Supabase credentials not found. ' +
      'Using development fallback preview mode. Set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.'
    );
  }
}

// Fallback safe URL only for dev compiler/preview initialization
const safeUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-hyd-logix.supabase.co';
const safeKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
