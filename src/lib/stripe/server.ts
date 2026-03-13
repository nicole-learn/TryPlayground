import "server-only";

import Stripe from "stripe";
import { getStripeSecretKey } from "./env";

export const STRIPE_API_VERSION = "2026-01-28.clover" as Stripe.LatestApiVersion;

let stripeClient: Stripe | null | undefined;

export function getStripeServerClient() {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });

  return stripeClient;
}
