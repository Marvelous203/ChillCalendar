import { fileStore } from './file';
import { supabaseStore } from './supabase';
import type { StoreAdapter } from './types';

export function getStore(): StoreAdapter {
  const hasSupabase =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (process.env.AUTH_MODE !== 'dev' && hasSupabase) {
    return supabaseStore;
  }
  return fileStore;
}
