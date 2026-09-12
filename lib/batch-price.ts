// The one paid product in this service. Defined in code (Checkout's inline
// price_data) so no product has to be created in the Stripe dashboard first;
// STRIPE_PRICE_ID, if set, overrides this with a catalog price. Safe to import
// from client components (no secrets).
export const BATCH_PRICE = {
  name: "Batch EPUB Metadata Fixer – lifetime access",
  description:
    "Fix title, author, language, publisher and identifiers across many EPUB files at once and download them as one zip. One-time payment; access is stored in this browser for 12 months, with a restore link for other devices.",
  currency: "usd",
  unitAmount: 500, // minor units → $5.00
  display: "$5",
} as const;
