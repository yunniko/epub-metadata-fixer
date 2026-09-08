import Link from "next/link";

const TOOLS = [
  {
    href: "/metadata-checker",
    title: "EPUB Metadata Checker",
    description: "Upload an .epub and see whether its title, author, language, and identifiers meet the EPUB 2/3 spec's requirements — plus whether it has a cover image declared correctly.",
  },
  {
    href: "/metadata-fixer",
    title: "EPUB Metadata Fixer",
    description: "Upload an .epub, edit its title, author, language, publisher, description, and identifier, and download a corrected copy — nothing is uploaded to a server.",
  },
  {
    href: "/cover-checker",
    title: "EPUB Cover Image Checker",
    description: "Check a cover image's pixel dimensions and aspect ratio against Amazon KDP, Kobo Writing Life, and Apple Books requirements before you upload it.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-semibold">EPUB Metadata Fixer</h1>
      <p className="mt-4 text-gray-600">
        Free tools for self-published authors to check and fix EPUB metadata
        and cover images before submitting to a storefront. Everything runs
        in your browser — no file is ever uploaded anywhere.
      </p>
      <ul className="mt-10 space-y-6">
        {TOOLS.map((tool) => (
          <li key={tool.href} className="rounded-lg border border-gray-200 p-5">
            <Link href={tool.href} className="text-lg font-medium text-blue-700 hover:underline">
              {tool.title}
            </Link>
            <p className="mt-2 text-sm text-gray-600">{tool.description}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
