"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { publishableKey, url } = getSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
