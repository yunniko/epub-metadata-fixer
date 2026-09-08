import type { Metadata } from "next";
import Link from "next/link";
import { CoverCheckerForm } from "../_components/cover-checker-form";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "EPUB Cover Image Checker",
  description:
    "Check a book cover image's pixel dimensions and aspect ratio against Amazon KDP, Kobo Writing Life, and Apple Books requirements before you upload it — no sign-up, nothing leaves your browser.",
};

const FAQ = [
  {
    question: "Where do these size requirements come from?",
    answer:
      "They're aggregated from multiple independent publishing-service guides that cross-corroborate on the same figures, not pulled directly from Amazon/Kobo/Apple's own help pages (this tool couldn't fetch those directly). Requirements can change — if in doubt, check the platform's current official page before final submission.",
  },
  {
    question: "Why does Amazon KDP reject my PNG cover?",
    answer: "KDP requires JPEG or TIFF for ebook covers; PNG is not accepted at upload even if the dimensions are otherwise fine.",
  },
  {
    question: "My cover passes Kobo and Apple but fails KDP — why?",
    answer:
      "KDP enforces a minimum height:width ratio of 1.6:1 (a noticeably \"taller\" cover), while Kobo and Apple Books only require a minimum pixel count on the shorter side without strictly enforcing a ratio. A cover sized for a squarer 2:3 look can fail KDP's ratio check even at high resolution.",
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
      <h1 className="text-3xl font-semibold">EPUB Cover Image Checker</h1>
      <p className="mt-3 text-gray-600">
        Upload a cover image to check it against Amazon KDP, Kobo Writing Life, and Apple Books requirements.
      </p>
      <div className="mt-6"><CoverCheckerForm /></div>
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
