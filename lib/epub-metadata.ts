// Parses and validates the package document (OPF) metadata against the
// real EPUB spec requirements — not a guess at "sensible fields":
//
//   EPUB 3 (W3C EPUB 3.3, "Publication Resources — the package document"):
//     the package's metadata MUST include at least one each of dc:identifier,
//     dc:title, dc:language, plus exactly one publication-level dcterms:modified
//     <meta> property (additional dcterms:modified metas are legal only when
//     they carry a "refines" attribute pointing at a different element — those
//     are not the publication timestamp and must not be confused with it); the
//     package element's unique-identifier attribute MUST be an IDREF to one
//     of the dc:identifier elements.
//   EPUB 2 (IDPF OPF 2.0.1): the same dc:identifier / dc:title / dc:language
//     trio is required (no dcterms:modified — that's EPUB-3-only), with the
//     same unique-identifier IDREF rule inherited by EPUB 3 from EPUB 2.
//
// Sourced via WebSearch synthesis of the W3C/IDPF spec text and
// spec-quoting secondary write-ups (direct WebFetch to w3.org/idpf.org was
// unavailable this run) — see docs/domain-reference.md for the full source
// list and the domain-expert review that checked this file against them.
//
// buildFixedOpf() intentionally does NOT do a full parse-and-reserialize
// round trip through a generic XML library: this file's manifest/spine
// content (hrefs, self-closing tags, whitespace) belongs to the original
// EPUB and must survive byte-for-byte wherever we aren't deliberately
// changing something. Instead it does targeted, regex-scoped surgery on
// just the identified metadata/package-attribute spans, which is safer to
// reason about and to unit-test than trusting a generic serializer not to
// reformat unrelated parts of the file. This assumes conventionally
// well-formed OPF with the Dublin Core namespace bound to the literal "dc:"
// prefix — true for every mainstream EPUB generator (Calibre, Sigil, Vellum,
// InDesign) but not namespace-aware in the general XML sense.
//
// KNOWN LIMITATION (domain-expert review, 2026-09-08): only the first
// dc:creator and the first dc:title are ever edited. A document with
// multiple authors/titles keeps the others untouched but doesn't let the
// user edit them individually, and editing dc:creator/dc:title doesn't
// update a paired opf:file-as attribute or a refines="#id" file-as meta,
// so the book's sort name can end up stale after an edit. Not fixed this
// ship — flagged honestly rather than silently mishandled.

export interface OpfIdentifier {
  id?: string;
  scheme?: string;
  value: string;
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface ParsedOpf {
  version: string;
  uniqueIdentifierRef?: string;
  identifiers: OpfIdentifier[];
  titles: string[];
  languages: string[];
  creators: string[];
  publisher?: string;
  description?: string;
  modified?: string;
  manifestItems: ManifestItem[];
  coverItemHref?: string;
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
}

function matchAll(xml: string, tagName: string): { attrs: string; text: string; index: number; fullMatch: string }[] {
  const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const results: { attrs: string; text: string; index: number; fullMatch: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push({ attrs: m[1], text: decodeXmlText(m[2]), index: m.index, fullMatch: m[0] });
  }
  return results;
}

function attrValue(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ?? attrs.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? decodeXmlText(m[1]) : undefined;
}

// Replaces an attribute's value regardless of whether the source uses double
// or single quotes (a real gap found by domain-expert review: an earlier
// version only handled double quotes here, silently no-op'ing on files that
// use single-quoted attributes).
function replaceAttrValue(openTag: string, name: string, newValue: string): string {
  const re = new RegExp(`(\\b${name}\\s*=\\s*)(?:"[^"]*"|'[^']*')`, "i");
  if (re.test(openTag)) {
    return openTag.replace(re, (_m, prefix) => `${prefix}"${escapeXmlAttr(newValue)}"`);
  }
  return openTag.replace(/>$/, ` ${name}="${escapeXmlAttr(newValue)}">`);
}

function decodeXmlText(text: string): string {
  return text
    .trim()
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function escapeXmlText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeXmlAttr(text: string): string {
  return escapeXmlText(text).replace(/"/g, "&quot;");
}

// Manifest hrefs in the OPF are relative to the OPF file's own directory,
// not the zip root (OCF/OPF spec) — a cover declared as href="images/cover.jpg"
// in "OEBPS/content.opf" actually lives at "OEBPS/images/cover.jpg" in the zip.
export function resolveOpfRelativePath(opfPath: string, href: string): string {
  if (/^[a-z]+:\/\//i.test(href)) return href;
  const baseDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const combined = baseDir ? `${baseDir}/${href}` : href;
  const resolved: string[] = [];
  for (const part of combined.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

// Finds <meta property="dcterms:modified"> elements, excluding any that
// carry a "refines" attribute (those refine a different element — e.g. a
// per-resource timestamp — and are NOT the publication-level modified date
// even though they share the same property value; conflating the two was a
// real bug an earlier version had).
function findPublicationModifiedMetas(xml: string): { attrs: string; text: string; index: number; fullMatch: string }[] {
  const re = /<meta\b([^>]*)>([\s\S]*?)<\/meta>/gi;
  const results: { attrs: string; text: string; index: number; fullMatch: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1];
    if (attrValue(attrs, "property")?.toLowerCase() !== "dcterms:modified") continue;
    if (attrValue(attrs, "refines") !== undefined) continue;
    results.push({ attrs, text: decodeXmlText(m[2]), index: m.index, fullMatch: m[0] });
  }
  return results;
}

export function parseOpf(opfXml: string): ParsedOpf {
  const packageMatch = opfXml.match(/<package\b([^>]*)>/i);
  const packageAttrs = packageMatch?.[1] ?? "";
  const version = attrValue(packageAttrs, "version") ?? "2.0";
  const uniqueIdentifierRef = attrValue(packageAttrs, "unique-identifier");

  const identifiers: OpfIdentifier[] = matchAll(opfXml, "dc:identifier").map(({ attrs, text }) => ({
    id: attrValue(attrs, "id"),
    scheme: attrValue(attrs, "opf:scheme"),
    value: text,
  }));
  const titles = matchAll(opfXml, "dc:title").map((t) => t.text);
  const languages = matchAll(opfXml, "dc:language").map((t) => t.text);
  const creators = matchAll(opfXml, "dc:creator").map((t) => t.text);
  const publisher = matchAll(opfXml, "dc:publisher")[0]?.text;
  const description = matchAll(opfXml, "dc:description")[0]?.text;

  const modified = findPublicationModifiedMetas(opfXml)[0]?.text;

  const coverMetaContent = new Map<string, string>();
  for (const m of opfXml.matchAll(/<meta\b([^>]*?)(?:\/>|>([\s\S]*?)<\/meta>)/gi)) {
    const attrs = m[1];
    const name = attrValue(attrs, "name");
    if (name?.toLowerCase() === "cover") {
      const content = attrValue(attrs, "content");
      if (content) coverMetaContent.set("cover", content);
    }
  }

  const manifestItems: ManifestItem[] = [...opfXml.matchAll(/<item\b([^>]*)\/?>/gi)]
    .map((m) => m[1])
    .filter((attrs) => attrValue(attrs, "href") !== undefined)
    .map((attrs) => ({
      id: attrValue(attrs, "id") ?? "",
      href: attrValue(attrs, "href") ?? "",
      mediaType: attrValue(attrs, "media-type") ?? "",
      properties: attrValue(attrs, "properties"),
    }));

  let coverItemHref: string | undefined;
  const coverByProperty = manifestItems.find((item) => item.properties?.split(/\s+/).includes("cover-image"));
  if (coverByProperty) {
    coverItemHref = coverByProperty.href;
  } else {
    const legacyCoverId = coverMetaContent.get("cover");
    if (legacyCoverId) {
      coverItemHref = manifestItems.find((item) => item.id === legacyCoverId)?.href;
    }
  }

  return {
    version,
    uniqueIdentifierRef,
    identifiers,
    titles,
    languages,
    creators,
    publisher,
    description,
    modified,
    manifestItems,
    coverItemHref,
  };
}

const BCP47_SHAPE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
const DCTERMS_MODIFIED_SHAPE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function hasText(value: string | undefined): boolean {
  return !!value && value.trim().length > 0;
}

export function validateOpf(meta: ParsedOpf): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isEpub3 = meta.version.trim().startsWith("3");
  const nonEmptyIdentifiers = meta.identifiers.filter((id) => hasText(id.value));
  const nonEmptyTitles = meta.titles.filter(hasText);
  const nonEmptyLanguages = meta.languages.filter(hasText);

  if (nonEmptyIdentifiers.length === 0) {
    issues.push({ severity: "error", code: "missing-identifier", message: "No non-empty dc:identifier element found — every EPUB must have at least one (required by both EPUB 2 and EPUB 3)." });
  }
  if (nonEmptyTitles.length === 0) {
    issues.push({ severity: "error", code: "missing-title", message: "No non-empty dc:title element found — required by both EPUB 2 and EPUB 3." });
  }
  if (nonEmptyLanguages.length === 0) {
    issues.push({ severity: "error", code: "missing-language", message: "No non-empty dc:language element found — required by both EPUB 2 and EPUB 3." });
  } else {
    for (const lang of nonEmptyLanguages) {
      if (!BCP47_SHAPE.test(lang.trim())) {
        issues.push({
          severity: "warning",
          code: "language-shape",
          message: `dc:language value "${lang}" doesn't have the shape of a BCP 47 language tag (e.g. "en", "en-US"). This is a structural check only, not a lookup against the full IANA subtag registry, so it can both miss real errors and flag rare-but-valid tags.`,
        });
      }
    }
  }

  if (!meta.uniqueIdentifierRef) {
    issues.push({ severity: "error", code: "missing-unique-identifier-attr", message: "The <package> element has no unique-identifier attribute — it must reference the id of the primary dc:identifier." });
  } else if (!meta.identifiers.some((id) => id.id === meta.uniqueIdentifierRef)) {
    issues.push({
      severity: "error",
      code: "unique-identifier-mismatch",
      message: `The package's unique-identifier="${meta.uniqueIdentifierRef}" doesn't match the id of any dc:identifier element.`,
    });
  }

  if (isEpub3) {
    if (!hasText(meta.modified)) {
      issues.push({ severity: "error", code: "missing-modified", message: "No publication-level dcterms:modified <meta> found — required in EPUB 3 (not required in EPUB 2)." });
    } else if (!DCTERMS_MODIFIED_SHAPE.test(meta.modified!.trim())) {
      issues.push({ severity: "error", code: "modified-format", message: `dcterms:modified value "${meta.modified}" isn't in the required CCYY-MM-DDThh:mm:ssZ format — EPUBCheck treats this as an error, not a warning.` });
    }
  }

  if (meta.creators.filter(hasText).length === 0) {
    issues.push({ severity: "warning", code: "missing-creator", message: "No dc:creator (author) element found. Not required by the spec, but every major storefront expects one." });
  }

  if (!meta.coverItemHref) {
    issues.push({ severity: "warning", code: "missing-cover", message: "No cover image declared in the manifest (neither an item with properties=\"cover-image\" nor a legacy <meta name=\"cover\"> reference)." });
  }

  return issues;
}

export interface OpfFixes {
  title?: string;
  creator?: string;
  language?: string;
  identifierValue?: string;
  publisher?: string;
  description?: string;
}

function replaceOrInsertSimple(xml: string, tagName: string, newText: string | undefined, metadataOpenTagEnd: number): string {
  if (newText === undefined) return xml;
  const re = new RegExp(`(<${tagName}\\b[^>]*>)([\\s\\S]*?)(<\\/${tagName}>)`, "i");
  if (re.test(xml)) {
    return xml.replace(re, (_m, open, _old, close) => `${open}${escapeXmlText(newText)}${close}`);
  }
  const insertion = `<${tagName}>${escapeXmlText(newText)}</${tagName}>`;
  return xml.slice(0, metadataOpenTagEnd) + insertion + xml.slice(metadataOpenTagEnd);
}

function generateUnusedId(xml: string, preferred: string): string {
  if (!new RegExp(`\\bid\\s*=\\s*["']${preferred}["']`).test(xml)) return preferred;
  let n = 2;
  while (new RegExp(`\\bid\\s*=\\s*["']${preferred}-${n}["']`).test(xml)) n += 1;
  return `${preferred}-${n}`;
}

// Applies `fixes` to an existing OPF document and returns the corrected XML
// string. Always re-derives package/unique-identifier consistency and (for
// EPUB 3 packages) bumps dcterms:modified, since the spec requires it to
// reflect the true last-modified time of the rendition whenever content
// changes — not something a user would think to edit by hand.
export function buildFixedOpf(opfXml: string, fixes: OpfFixes): string {
  let xml = opfXml;
  const before = parseOpf(xml);

  if (!/xmlns:dc\s*=/.test(xml)) {
    throw new Error("This package document doesn't declare the Dublin Core namespace under the standard \"dc:\" prefix, which this tool relies on — it can't safely add metadata elements to it.");
  }

  const metadataOpenMatch = xml.match(/<metadata\b[^>]*>/i);
  if (!metadataOpenMatch || metadataOpenMatch.index === undefined) {
    throw new Error("No <metadata> element found in the package document — this file doesn't look like a valid OPF.");
  }
  const metadataOpenTagEnd = metadataOpenMatch.index + metadataOpenMatch[0].length;

  xml = replaceOrInsertSimple(xml, "dc:title", fixes.title, metadataOpenTagEnd);
  xml = replaceOrInsertSimple(xml, "dc:creator", fixes.creator, metadataOpenTagEnd);
  xml = replaceOrInsertSimple(xml, "dc:language", fixes.language, metadataOpenTagEnd);
  xml = replaceOrInsertSimple(xml, "dc:publisher", fixes.publisher, metadataOpenTagEnd);
  xml = replaceOrInsertSimple(xml, "dc:description", fixes.description, metadataOpenTagEnd);

  let primaryId = before.uniqueIdentifierRef && before.identifiers.some((i) => i.id === before.uniqueIdentifierRef)
    ? before.uniqueIdentifierRef
    : before.identifiers[0]?.id;

  if (fixes.identifierValue !== undefined) {
    // Re-scan `xml` (not `before`) since earlier replacements may have
    // shifted offsets — this must target the SAME identifier element that
    // unique-identifier resolves to, not just "the first one in the file",
    // otherwise a book with e.g. an ISBN dc:identifier before its primary
    // UUID dc:identifier gets the wrong one silently overwritten.
    const identifierMatches = matchAll(xml, "dc:identifier");
    let target = primaryId ? identifierMatches.find((m) => attrValue(m.attrs, "id") === primaryId) : undefined;
    if (!target && identifierMatches.length > 0) target = identifierMatches[0];

    if (target) {
      const needsId = !target.attrs.includes(" id=");
      primaryId = needsId ? (primaryId ?? generateUnusedId(xml, "pub-id")) : (attrValue(target.attrs, "id") ?? primaryId);
      const attrsWithId = needsId ? ` id="${primaryId}"${target.attrs}` : target.attrs;
      const replacement = `<dc:identifier${attrsWithId}>${escapeXmlText(fixes.identifierValue)}</dc:identifier>`;
      xml = xml.slice(0, target.index) + replacement + xml.slice(target.index + target.fullMatch.length);
    } else {
      primaryId = primaryId ?? generateUnusedId(xml, "pub-id");
      const insertion = `<dc:identifier id="${primaryId}">${escapeXmlText(fixes.identifierValue)}</dc:identifier>`;
      xml = xml.slice(0, metadataOpenTagEnd) + insertion + xml.slice(metadataOpenTagEnd);
    }
  }

  if (primaryId) {
    const packageMatch = xml.match(/<package\b[^>]*>/i);
    if (packageMatch) {
      const newOpenTag = replaceAttrValue(packageMatch[0], "unique-identifier", primaryId);
      xml = xml.slice(0, packageMatch.index!) + newOpenTag + xml.slice(packageMatch.index! + packageMatch[0].length);
    }
  }

  const isEpub3 = before.version.trim().startsWith("3");
  const anyFixApplied = Object.values(fixes).some((v) => v !== undefined);
  if (isEpub3 && anyFixApplied) {
    const modifiedValue = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const existing = findPublicationModifiedMetas(xml)[0];
    if (existing) {
      const replacement = `<meta${existing.attrs}>${modifiedValue}</meta>`;
      xml = xml.slice(0, existing.index) + replacement + xml.slice(existing.index + existing.fullMatch.length);
    } else {
      const insertion = `<meta property="dcterms:modified">${modifiedValue}</meta>`;
      xml = xml.slice(0, metadataOpenTagEnd) + insertion + xml.slice(metadataOpenTagEnd);
    }
  }

  return xml;
}
