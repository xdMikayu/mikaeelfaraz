'use client';
// Browser Supabase client. Uses the public anon key; Row Level Security keeps
// every query scoped to the signed-in user.
import { createClient } from '@supabase/supabase-js';

let client;

// Accept both our names and the ones Netlify's Supabase extension creates.
// (Each must be a literal process.env.NEXT_PUBLIC_* reference so Next inlines it.)
// Tolerate the Data API URL (…/rest/v1/) being pasted instead of the project URL.
const URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_DATABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfigured() {
  return Boolean(URL && ANON_KEY);
}

export function getSupabase() {
  if (!supabaseConfigured()) return null;
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mf-finance-auth' },
    });
  }
  return client;
}
