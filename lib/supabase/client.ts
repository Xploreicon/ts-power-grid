"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

function buildClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env vars missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * True module-level singleton — every call returns the same instance so
 * hooks/components share one auth state machine and one Navigator Lock,
 * preventing "lock stolen" errors from concurrent getUser() calls.
 */
export function createClient(): SupabaseClient {
  if (!cached) cached = buildClient();
  return cached;
}

/** Legacy alias, preserved for marketing lead form. */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? (cached ??= buildClient()) : null;
