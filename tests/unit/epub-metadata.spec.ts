import { describe, it, expect } from "vitest";
import { parseOpf, validateOpf, buildFixedOpf, resolveOpfRelativePath } from "@/lib/epub-metadata";

const EPUB3_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:1234</dc:identifier>
    <dc:title>My Novel</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Jane Author</dc:creator>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="cover-img" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>
    <item id="chap1" href="text/chap1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chap1"/>
  </spine>
</package>`;

const EPUB2_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId" opf:scheme="ISBN">978-0-000000-0-0</dc:identifier>
    <dc:title>Legacy Book</dc:title>
    <dc:language>en-US</dc:language>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="cover-img" href="cover.jpg" media-type="image/jpeg"/>
  </manifest>
</package>`;

const BROKEN_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="wrong-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:5678</dc:identifier>
    <dc:title>Broken Book</dc:title>
    <dc:language>not_a_real_tag_!!</dc:language>
  </metadata>
  <manifest></manifest>
</package>`;

// Two dc:identifier elements where the PRIMARY one (the one unique-identifier
// actually points at) is NOT the first in document order — the real-world
// shape (ISBN listed before the UUID) that an earlier version of
// buildFixedOpf silently overwrote the wrong element for.
const MULTI_IDENTIFIER_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="isbn" opf:scheme="ISBN">9781234567897</dc:identifier>
    <dc:identifier id="pub-id">urn:uuid:primary-0001</dc:identifier>
    <dc:title>Multi Identifier Book</dc:title>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest></manifest>
</package>`;

// Single-quoted attributes — a real, legal XML style that an earlier version
// of the unique-identifier/dcterms:modified rewrite regexes silently ignored.
const SINGLE_QUOTED_OPF = `<?xml version='1.0' encoding='UTF-8'?>
<package xmlns='http://www.idpf.org/2007/opf' version='3.0' unique-identifier='wrong-id'>
  <metadata xmlns:dc='http://purl.org/dc/elements/1.1/'>
    <dc:identifier id='pub-id'>urn:uuid:single-quote</dc:identifier>
    <dc:title>Single Quoted Book</dc:title>
    <dc:language>en</dc:language>
    <meta property='dcterms:modified'>2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest></manifest>
</package>`;

// A dcterms:modified meta that refines a different element (e.g. a
// per-resource timestamp) must not be confused with the publication-level
// modified date.
const REFINES_OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:refines-test</dc:identifier>
    <dc:title>Refines Test</dc:title>
    <dc:language>en</dc:language>
    <meta refines="#some-resource" property="dcterms:modified">2020-01-01T00:00:00Z</meta>
  </metadata>
  <manifest></manifest>
</package>`;

describe("parseOpf", () => {
  it("parses a well-formed EPUB 3 package document", () => {
    const meta = parseOpf(EPUB3_OPF);
    expect(meta.version).toBe("3.0");
    expect(meta.titles).toEqual(["My Novel"]);
    expect(meta.languages).toEqual(["en"]);
    expect(meta.creators).toEqual(["Jane Author"]);
    expect(meta.identifiers).toEqual([{ id: "pub-id", scheme: undefined, value: "urn:uuid:1234" }]);
    expect(meta.uniqueIdentifierRef).toBe("pub-id");
    expect(meta.modified).toBe("2024-01-01T00:00:00Z");
    expect(meta.coverItemHref).toBe("images/cover.jpg");
  });

  it("parses a well-formed EPUB 2 package document with a legacy cover meta", () => {
    const meta = parseOpf(EPUB2_OPF);
    expect(meta.version).toBe("2.0");
    expect(meta.identifiers[0]).toEqual({ id: "BookId", scheme: "ISBN", value: "978-0-000000-0-0" });
    expect(meta.coverItemHref).toBe("cover.jpg");
    expect(meta.modified).toBeUndefined();
  });
});

describe("validateOpf", () => {
  it("finds no errors in a well-formed EPUB 3 document", () => {
    const issues = validateOpf(parseOpf(EPUB3_OPF));
    expect(issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("does not require dcterms:modified for EPUB 2", () => {
    const issues = validateOpf(parseOpf(EPUB2_OPF));
    expect(issues.some((i) => i.code === "missing-modified")).toBe(false);
  });

  it("flags a mismatched unique-identifier, bad language shape, and missing dcterms:modified", () => {
    const issues = validateOpf(parseOpf(BROKEN_OPF));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("unique-identifier-mismatch");
    expect(codes).toContain("language-shape");
    expect(codes).toContain("missing-modified");
    expect(codes).toContain("missing-cover");
  });

  it("flags a document missing all three required elements", () => {
    const empty = `<package version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"></metadata></package>`;
    const issues = validateOpf(parseOpf(empty));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("missing-identifier");
    expect(codes).toContain("missing-title");
    expect(codes).toContain("missing-language");
    expect(codes).toContain("missing-unique-identifier-attr");
  });

  it("treats a whitespace-only element as absent, not present", () => {
    const blankTitle = EPUB3_OPF.replace("<dc:title>My Novel</dc:title>", "<dc:title>   </dc:title>");
    const issues = validateOpf(parseOpf(blankTitle));
    expect(issues.map((i) => i.code)).toContain("missing-title");
  });

  it("reports missing-unique-identifier-attr independently of missing-identifier", () => {
    const noAttr = `<package version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="x">1</dc:identifier><dc:title>T</dc:title><dc:language>en</dc:language></metadata></package>`;
    const issues = validateOpf(parseOpf(noAttr));
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("missing-unique-identifier-attr");
    expect(codes).not.toContain("missing-identifier");
  });
});

describe("buildFixedOpf", () => {
  it("updates title, language, and identifier text while preserving manifest/spine", () => {
    const fixed = buildFixedOpf(EPUB3_OPF, { title: "New Title", language: "fr", identifierValue: "urn:uuid:new" });
    const meta = parseOpf(fixed);
    expect(meta.titles).toEqual(["New Title"]);
    expect(meta.languages).toEqual(["fr"]);
    expect(meta.identifiers[0].value).toBe("urn:uuid:new");
    expect(meta.identifiers[0].id).toBe("pub-id"); // id attribute preserved
    expect(fixed).toContain('<item id="cover-img" href="images/cover.jpg"');
    expect(fixed).toContain("<itemref idref=\"chap1\"/>");
  });

  it("bumps dcterms:modified for an EPUB 3 document when a fix is applied", () => {
    const fixed = buildFixedOpf(EPUB3_OPF, { title: "New Title" });
    const meta = parseOpf(fixed);
    expect(meta.modified).not.toBe("2024-01-01T00:00:00Z");
    expect(meta.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("does not add dcterms:modified to an EPUB 2 document", () => {
    const fixed = buildFixedOpf(EPUB2_OPF, { title: "New Title" });
    const meta = parseOpf(fixed);
    expect(meta.modified).toBeUndefined();
  });

  it("realigns package unique-identifier when it was pointing at a nonexistent id", () => {
    const fixed = buildFixedOpf(BROKEN_OPF, { title: "Fixed Title" });
    const meta = parseOpf(fixed);
    expect(meta.uniqueIdentifierRef).toBe(meta.identifiers[0].id);
    expect(meta.uniqueIdentifierRef).toBe("pub-id");
  });

  it("escapes XML special characters in provided values", () => {
    const fixed = buildFixedOpf(EPUB3_OPF, { title: "Cats & Dogs <Special Edition>" });
    const meta = parseOpf(fixed);
    expect(meta.titles[0]).toBe("Cats & Dogs <Special Edition>");
    expect(fixed).toContain("Cats &amp; Dogs &lt;Special Edition&gt;");
  });

  it("inserts a dc:creator element when none existed", () => {
    const fixed = buildFixedOpf(EPUB2_OPF, { creator: "New Author" });
    const meta = parseOpf(fixed);
    expect(meta.creators).toEqual(["New Author"]);
  });

  it("updates the PRIMARY dc:identifier (the one unique-identifier points at), not just the first one in document order", () => {
    const fixed = buildFixedOpf(MULTI_IDENTIFIER_OPF, { identifierValue: "urn:uuid:updated" });
    const meta = parseOpf(fixed);
    const isbn = meta.identifiers.find((i) => i.id === "isbn");
    const primary = meta.identifiers.find((i) => i.id === "pub-id");
    expect(isbn?.value).toBe("9781234567897"); // untouched
    expect(primary?.value).toBe("urn:uuid:updated");
    expect(meta.uniqueIdentifierRef).toBe("pub-id");
  });

  it("rewrites unique-identifier and dcterms:modified even when the source OPF uses single-quoted attributes", () => {
    const fixed = buildFixedOpf(SINGLE_QUOTED_OPF, { title: "Retitled" });
    const meta = parseOpf(fixed);
    expect(meta.uniqueIdentifierRef).toBe("pub-id");
    expect(meta.modified).not.toBe("2024-01-01T00:00:00Z");
  });

  it("does not confuse a refines'd dcterms:modified meta with the publication-level one", () => {
    const fixed = buildFixedOpf(REFINES_OPF, { title: "New Title" });
    // The refining meta must survive untouched...
    expect(fixed).toContain('<meta refines="#some-resource" property="dcterms:modified">2020-01-01T00:00:00Z</meta>');
    // ...and a NEW publication-level one must have been inserted instead of
    // the refining one being (mis)treated as already satisfying the requirement.
    const meta = parseOpf(fixed);
    expect(meta.modified).not.toBe("2020-01-01T00:00:00Z");
    expect(meta.modified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("mints a non-colliding id if the document already has an element with id=\"pub-id\"", () => {
    const opfWithExistingPubId = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title id="pub-id">Some Title</dc:title>
  </metadata>
  <manifest></manifest>
</package>`;
    const fixed = buildFixedOpf(opfWithExistingPubId, { identifierValue: "urn:uuid:new" });
    const meta = parseOpf(fixed);
    expect(meta.identifiers[0].id).not.toBe("pub-id");
    expect(meta.uniqueIdentifierRef).toBe(meta.identifiers[0].id);
  });

  it("refuses to edit an OPF that doesn't declare the dc: namespace prefix", () => {
    const noNamespace = `<package version="3.0"><metadata></metadata></package>`;
    expect(() => buildFixedOpf(noNamespace, { title: "X" })).toThrow(/Dublin Core/);
  });

  it("decodes numeric character references without double-escaping them on write-back", () => {
    const withEntity = EPUB3_OPF.replace("My Novel", "Don&#8217;t Stop");
    const meta = parseOpf(withEntity);
    expect(meta.titles[0]).toBe("Don’t Stop");
    const fixed = buildFixedOpf(withEntity, { title: meta.titles[0] });
    expect(parseOpf(fixed).titles[0]).toBe("Don’t Stop");
  });
});

describe("resolveOpfRelativePath", () => {
  it("resolves a href relative to the OPF's own directory", () => {
    expect(resolveOpfRelativePath("OEBPS/content.opf", "images/cover.jpg")).toBe("OEBPS/images/cover.jpg");
  });

  it("handles an OPF at the zip root", () => {
    expect(resolveOpfRelativePath("content.opf", "cover.jpg")).toBe("cover.jpg");
  });

  it("resolves ../ segments", () => {
    expect(resolveOpfRelativePath("OEBPS/text/content.opf", "../images/cover.jpg")).toBe("OEBPS/images/cover.jpg");
  });
});
