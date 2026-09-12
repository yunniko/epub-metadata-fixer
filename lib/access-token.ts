// Signed, expiring access token for the paid Batch Fixer. Server-only
// (node:crypto). The token is stored in an HttpOnly cookie after a verified
// Stripe Checkout payment (app/api/verify) and checked by the batch-fixer
// page on every render. Format: "<expiresAtMs>.<hmac-sha256 hex>". There is
// no user database — possession of a valid token IS the entitlement, which
// is why the secret must never ship to the client and why tokens expire.
// See docs/decisions/D007-stripe-checkout-cookie-entitlement.md.
import { createHmac, timingSafeEqual } from "node:crypto";

export const ACCESS_COOKIE_NAME = "epub_batch_access";
export const ACCESS_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createAccessToken(secret: string, now: number = Date.now()): string {
  if (!secret) throw new Error("access token secret is not configured");
  const expiresAt = now + ACCESS_TOKEN_TTL_MS;
  return `${expiresAt}.${sign(secret, String(expiresAt))}`;
}

export function verifyAccessToken(secret: string, token: string | undefined, now: number = Date.now()): boolean {
  if (!secret || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresPart = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  if (!/^\d{1,16}$/.test(expiresPart) || !/^[0-9a-f]{64}$/.test(sigPart)) return false;
  if (Number(expiresPart) <= now) return false;
  const expected = Buffer.from(sign(secret, expiresPart), "hex");
  const given = Buffer.from(sigPart, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
