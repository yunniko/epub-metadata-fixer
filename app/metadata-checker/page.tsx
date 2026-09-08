import type { Metadata } from "next";
import Link from "next/link";
import { MetadataCheckerForm } from "../_components/metadata-checker-form";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "EPUB Metadata Checker",
  description:
    "Upload an .epub and check its title, author, language, and identifier metadata against the EPUB 2/3 spec, plus whether its cover image is declared correctly — no sign-up, nothing leaves your browser.",
};

const FAQ = [
  {
    question: "What does this tool actually check?",
    answer:
      "It reads your EPUB's package document (content.opf) and checks the elements the EPUB 2/3 spec requires: dc:identifier, dc:title, dc:language, and — for EPUB 3 files only — a dcterms:modified timestamp. It also checks that the package's unique-identifier attribute correctly points at one of your dc:identifier elements, and whether a cover image is declared and actually present in the file.",
  },
  {
    question: "Is my book file uploaded anywhere?",
    answer:
      "No. The EPUB is read and parsed entirely in your browser using JavaScript — it's never sent to a server. You can check this yourself in your browser's network tab.",
  },
  {
    question: "Why does it flag my language code as a warning instead of an error?",
    answer:
      "The checker verifies your language code has the right shape for a BCP 47 tag (like \"en\" or \"en-US\") but doesn't look it up against the full IANA language subtag registry, so an oddly-shaped-but-technically-valid tag might get flagged, and an invalid-but-shape-correct one might not. Treat it as a heads-up, not a definitive pass/fail.",
  },
];

export default function Page() {
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
      <h1 className="text-3xl font-semibold">EPUB Metadata Checker</h1>
      <p className="mt-3 text-gray-600">
        Upload an .epub file to see whether its metadata meets the EPUB spec&apos;s
        requirements before you submit it to a storefront.
      </p>
      <div className="mt-6"><MetadataCheckerForm /></div>
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
