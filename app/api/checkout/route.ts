// POST /api/checkout — starts a Stripe Checkout session for the Batch Fixer
// and redirects the browser to Stripe's hosted payment page. No request body
// is read, so there is nothing to validate from the client; the price is
// server-defined (lib/batch-price.ts or STRIPE_PRICE_ID).
import { NextResponse } from "next/server";
import { getBatchPurchaseConfig, getStripe } from "@/lib/stripe";
import { BATCH_PRICE } from "@/lib/batch-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const config = getBatchPurchaseConfig();
  if (!config) {
    return NextResponse.json({ error: "Purchases are not available right now." }, { status: 503 });
  }
  const stripe = getStripe(config);
  const priceId = process.env.STRIPE_PRICE_ID;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      priceId
        ? { price: priceId, quantity: 1 }
        : {
            quantity: 1,
            price_data: {
              currency: BATCH_PRICE.currency,
              unit_amount: BATCH_PRICE.unitAmount,
              product_data: { name: BATCH_PRICE.name, description: BATCH_PRICE.description },
            },
          },
    ],
    success_url: `${config.appUrl}/api/verify?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.appUrl}/batch-fixer?cancelled=1`,
  });
  if (!session.url) {
    return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
  }
  return NextResponse.redirect(session.url, 303);
}
