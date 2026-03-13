"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

let ensureSessionPromise: Promise<string> | null = null;

async function createAnonymousHostedSession() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInAnonymously({
    options: {
      data: {
        display_name: "TryPlayground User",
      },
    },
  });

  if (error || !data.session?.access_token) {
    throw new Error(
      error?.message ??
        "Hosted sign-in is unavailable. Enable anonymous users in Supabase Auth."
    );
  }

  return data.session.access_token;
}

export async function ensureHostedAccessToken() {
  if (ensureSessionPromise) {
    return ensureSessionPromise;
  }

  ensureSessionPromise = (async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    if (session?.access_token) {
      return session.access_token;
    }

    return createAnonymousHostedSession();
  })();

  try {
    return await ensureSessionPromise;
  } finally {
    ensureSessionPromise = null;
  }
}

export async function signOutHostedSession() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}
