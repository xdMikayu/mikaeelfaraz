'use client';
// Browser Supabase client. Uses the public anon key; Row Level Security keeps
// every query scoped to the signed-in user.
import { createClient } from '@supabase/supabase-js';

let client;

export function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase() {
  if (!supabaseConfigured()) return null;
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mf-finance-auth' },
    });
  }
  return client;
}
