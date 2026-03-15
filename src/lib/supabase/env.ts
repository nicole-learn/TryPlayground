const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const FAL_KEY = process.env.FAL_KEY;
const FAL_WEBHOOK_SECRET = process.env.FAL_WEBHOOK_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export function getSupabaseEnv() {
  if (!SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.");
  }

  return {
    url: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getSupabaseAdminEnv() {
  if (!SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  if (!SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is not configured.");
  }

  return {
    url: SUPABASE_URL,
    secretKey: SUPABASE_SECRET_KEY,
  };
}

export function getFalServerEnv() {
  if (!FAL_KEY) {
    throw new Error("FAL_KEY is not configured.");
  }

  return {
    falKey: FAL_KEY,
    webhookSecret: FAL_WEBHOOK_SECRET?.trim() || null,
  };
}

export function getTextProviderServerEnv() {
  return {
    openaiApiKey: OPENAI_API_KEY?.trim() || "",
    anthropicApiKey: ANTHROPIC_API_KEY?.trim() || "",
    geminiApiKey: GEMINI_API_KEY?.trim() || "",
  };
}
