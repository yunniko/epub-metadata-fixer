import type { Metadata } from "next";
import Link from "next/link";
import { MetadataFixerForm } from "../_components/metadata-fixer-form";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "EPUB Metadata Fixer",
  description:
    "Upload an .epub, edit its title, author, language, publisher, description, and identifier, and download a corrected copy with a valid unique-identifier reference and dcterms:modified timestamp — no sign-up, nothing leaves your browser.",
};

const FAQ = [
  {
    question: "What exactly does \"Apply fixes\" change in my file?",
    answer:
      "It rewrites only the metadata fields you edited inside content.opf, leaving your manifest, spine, and all book content byte-for-byte untouched. If your file's package unique-identifier didn't correctly point at a dc:identifier element, that's realigned automatically. For EPUB 3 files, the dcterms:modified timestamp is updated to the current time, since the spec requires it to reflect the last real change.",
  },
  {
    question: "Will the downloaded file still open in my e-reader / storefront?",
    answer:
      "The rebuild keeps the EPUB container format's requirement that the \"mimetype\" file be the first entry in the zip and stored uncompressed — a detail some strict readers and validators check. Still, always open the fixed file in an EPUB reader (or run it through EPUBCheck) before submitting it anywhere, the same as you should for any file you edit.",
  },
  {
    question: "Can this add or replace a cover image?",
    answer: "Not yet — this tool only edits text metadata fields. Use the Cover Image Checker to validate a cover before adding it with your EPUB editor of choice.",
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
      <h1 className="text-3xl font-semibold">EPUB Metadata Fixer</h1>
      <p className="mt-3 text-gray-600">
        Upload an .epub, edit its metadata fields, and download a corrected copy.
      </p>
      <div className="mt-6"><MetadataFixerForm /></div>
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
