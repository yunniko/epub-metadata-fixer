// Renders a JSON-LD <script> tag from a structured-data object. Safe against
// injection: JSON.stringify never produces "</script>" unescaped sequences
// that could break out of the tag, but we still escape "<" defensively since
// this content may include user-influenced strings in some services.
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
