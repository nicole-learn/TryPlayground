import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export function getRequestBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization")?.trim() ?? "";
  if (!authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const accessToken = authorizationHeader.slice("bearer ".length).trim();
  return accessToken || null;
}

export function createSupabaseUserServerClient(accessToken: string) {
  const { publishableKey, url } = getSupabaseEnv();

  return createClient<Database>(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function requireSupabaseUser(request: Request) {
  const accessToken = getRequestBearerToken(request);
  if (!accessToken) {
    throw new Error("Missing hosted session.");
  }

  const supabase = createSupabaseUserServerClient(accessToken);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Hosted session is invalid or expired.");
  }

  return {
    accessToken,
    supabase,
    user: data.user satisfies User,
  };
}
