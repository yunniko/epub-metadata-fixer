// GET /api/verify?session_id=cs_… — Stripe's success_url. Retrieves the
// Checkout session server-side with the secret key (never trusting the
// redirect alone), and if it is paid sets the signed access cookie and sends
// the browser to the unlocked Batch Fixer. The same URL doubles as the
// customer's "restore link" for another browser: retrieving a paid session
// stays valid indefinitely, so re-visiting it re-issues the cookie.
import { NextResponse } from "next/server";
import { getBatchPurchaseConfig, getStripe } from "@/lib/stripe";
import { ACCESS_COOKIE_NAME, ACCESS_TOKEN_TTL_MS, createAccessToken } from "@/lib/access-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,}$/;

export async function GET(request: Request) {
  const config = getBatchPurchaseConfig();
  const appUrl = config?.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!config || !SESSION_ID.test(sessionId)) {
    return NextResponse.redirect(`${appUrl}/batch-fixer?error=invalid`, 303);
  }
  let paid = false;
  try {
    const session = await getStripe(config).checkout.sessions.retrieve(sessionId);
    paid = session.payment_status === "paid";
  } catch {
    paid = false;
  }
  if (!paid) {
    return NextResponse.redirect(`${appUrl}/batch-fixer?error=unpaid`, 303);
  }
  const response = NextResponse.redirect(`${appUrl}/batch-fixer?unlocked=1&restore=${sessionId}`, 303);
  response.cookies.set(ACCESS_COOKIE_NAME, createAccessToken(config.accessTokenSecret), {
    httpOnly: true,
    secure: appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
  });
  return response;
}
