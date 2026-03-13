import "server-only";

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export type StripeKeyMode = "test" | "live";

export function getStripeSecretKey() {
  return readEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret() {
  return readEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripeKeyMode(): StripeKeyMode | null {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return null;
  }

  if (secretKey.startsWith("sk_live_")) {
    return "live";
  }

  if (secretKey.startsWith("sk_test_")) {
    return "test";
  }

  return null;
}

export function isStripeCheckoutConfigured() {
  return Boolean(getStripeSecretKey());
}

export function isStripeWebhookConfigured() {
  return Boolean(getStripeSecretKey() && getStripeWebhookSecret());
}
