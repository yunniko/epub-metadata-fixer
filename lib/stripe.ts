// Server-only Stripe wiring for the paid Batch Fixer. Nothing here is
// imported by client components. Configuration comes from the host .env
// (see docker-compose.yml): STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
// ACCESS_TOKEN_SECRET. When any is missing the purchase flow is reported as
// unavailable rather than failing at request time, so a misconfigured
// deploy degrades to "not for sale right now" instead of a 500.
// See docs/decisions/D007-stripe-checkout-cookie-entitlement.md.
import Stripe from "stripe";

export interface BatchPurchaseConfig {
  secretKey: string;
  priceId: string;
  accessTokenSecret: string;
  appUrl: string;
}

export function getBatchPurchaseConfig(): BatchPurchaseConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  if (!secretKey || !priceId || !accessTokenSecret) return null;
  return { secretKey, priceId, accessTokenSecret, appUrl };
}

export function isBatchPurchaseConfigured(): boolean {
  return getBatchPurchaseConfig() !== null;
}

export function isStripeTestMode(): boolean {
  return (process.env.STRIPE_SECRET_KEY ?? "").includes("_test_");
}

let client: Stripe | null = null;
export function getStripe(config: BatchPurchaseConfig): Stripe {
  if (!client) client = new Stripe(config.secretKey);
  return client;
}
