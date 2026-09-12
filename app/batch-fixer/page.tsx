import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BatchFixerForm } from "../_components/batch-fixer-form";
import { JsonLd } from "@/lib/json-ld";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access-token";
import { isBatchPurchaseConfigured, isStripeTestMode } from "@/lib/stripe";
import { BATCH_PRICE } from "@/lib/batch-price";

// The access check reads a cookie on every request, so this page can never
// be statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Batch EPUB Metadata Fixer",
  description:
    "Fix title, author, language, publisher, description and identifiers across many .epub files at once and download them as one zip. One-time $5, processed entirely in your browser — nothing is uploaded.",
};

const FAQ = [
  {
    question: "What do I get for the one-time payment?",
    answer:
      "The batch mode: load any number of .epub files, set the fields they share (author, publisher, language, description) once, adjust title and identifier per file, and download every corrected file in a single zip. The single-file fixer, checker and cover checker stay free.",
  },
  {
    question: "Is it a subscription?",
    answer:
      "No. It is a single payment through Stripe. After paying, access is stored in this browser for 12 months as a cookie, and the receipt page gives you a restore link you can open in another browser or after clearing cookies. There is no account and no password.",
  },
  {
    question: "Are my books uploaded to a server?",
    answer:
      "No. Payment goes through Stripe's hosted checkout page; your EPUB files are read and rewritten entirely in your browser, exactly like the free single-file tools. This site never receives the files.",
  },
  {
    question: "What does the batch fixer change inside each file?",
    answer:
      "Only the metadata fields you set, inside each book's package document (content.opf). Manifest, spine and content stay byte-for-byte untouched; the unique-identifier reference and, for EPUB 3, the dcterms:modified timestamp are realigned. Files that use font obfuscation keep their identifier unchanged so embedded fonts don't break.",
  },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const unlocked = verifyAccessToken(process.env.ACCESS_TOKEN_SECRET ?? "", cookieStore.get(ACCESS_COOKIE_NAME)?.value);
  const configured = isBatchPurchaseConfigured();
  const testMode = isStripeTestMode();
  const restoreId = first(params.restore);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const restoreLink = restoreId && /^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(restoreId) ? `${appUrl}/api/verify?session_id=${restoreId}` : null;
  const error = first(params.error);
  const cancelled = first(params.cancelled) === "1";

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }}
      />
      <nav className="mb-6 text-sm"><Link href="/">← All tools</Link></nav>
      <h1 className="text-3xl font-semibold">Batch EPUB Metadata Fixer</h1>
      <p className="mt-3 text-gray-600">
        Fix the metadata of a whole back-catalogue at once: shared fields set once, per-file title and identifier, one zip
        download. Everything runs in your browser.
      </p>

      {error === "unpaid" && (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          That checkout wasn&apos;t completed, so nothing was unlocked. You haven&apos;t been charged.
        </p>
      )}
      {error === "invalid" && (
        <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          That restore link isn&apos;t valid. Use the exact link from your receipt page.
        </p>
      )}
      {cancelled && (
        <p className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          Checkout cancelled — nothing was charged.
        </p>
      )}

      {unlocked ? (
        <section className="mt-6 space-y-6" data-testid="batch-unlocked">
          {restoreLink && (
            <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900" data-testid="restore-link">
              <p className="font-medium">Payment confirmed — batch mode is unlocked in this browser for 12 months.</p>
              <p className="mt-2">
                Bookmark this restore link to unlock another browser or device later:{" "}
                <a href={restoreLink} className="break-all underline">{restoreLink}</a>
              </p>
            </div>
          )}
          <BatchFixerForm />
        </section>
      ) : (
        <section className="mt-6 rounded-lg border border-gray-200 p-5" data-testid="batch-paywall">
          <h2 className="text-xl font-semibold">Unlock batch mode — {BATCH_PRICE.display}, one time</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>Load any number of .epub files at once.</li>
            <li>Set author, publisher, language and description once for all of them.</li>
            <li>Edit title and identifier per file in a table.</li>
            <li>Download every corrected file as one zip.</li>
            <li>No account, no subscription; 12 months of access in this browser plus a restore link.</li>
          </ul>
          {configured ? (
            <form method="post" action="/api/checkout" className="mt-5">
              <button
                type="submit"
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Buy lifetime access – {BATCH_PRICE.display}
              </button>
              <p className="mt-2 text-xs text-gray-500">You&apos;ll be taken to Stripe&apos;s secure checkout page.</p>
              {testMode && (
                <p className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  Test mode: no real charge is made. Stripe&apos;s test card 4242 4242 4242 4242 with any future date and any
                  CVC completes the checkout.
                </p>
              )}
            </form>
          ) : (
            <p className="mt-5 text-sm text-gray-600" data-testid="purchase-unavailable">
              Purchases are temporarily unavailable. The free single-file fixer still works.
            </p>
          )}
          <p className="mt-4 text-xs text-gray-500">
            Already bought it? Open the restore link from your receipt page in this browser.
          </p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <dl className="mt-3 space-y-4">
          {FAQ.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-gray-900">{item.question}</dt>
              <dd className="mt-1 text-gray-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
