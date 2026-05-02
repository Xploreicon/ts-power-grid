"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const lockChains = new Map<string, Promise<unknown>>();
async function processLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const prev = lockChains.get(name) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  lockChains.set(
    name,
    next.catch(() => undefined),
  );
  return next;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null = null;

function buildClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase env vars missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: { lock: processLock },
  });
}

/**
 * Module-level singleton. Pairs with the in-memory `processLock` above to
 * avoid Supabase's default Navigator Lock, which surfaces "lock stolen"
 * unhandled rejections in dev when an auth call exceeds the 10s acquire
 * timeout (slow network, HMR mid-request, or a second tab stealing).
 */
export function createClient(): SupabaseClient {
  if (!cached) cached = buildClient();
  return cached;
}

/** Legacy alias, preserved for marketing lead form. */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? (cached ??= buildClient()) : null;
