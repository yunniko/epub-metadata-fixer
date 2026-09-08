import JSZip from "jszip";

// EPUB's container format (OCF, Open Container Format — part of the EPUB 3
// spec's "Open Container Format" section, inherited from EPUB 2) requires
// the "mimetype" entry to be: (1) the physically first file in the zip,
// (2) stored with no compression, (3) have no extra field, and (4) contain
// exactly the ASCII bytes "application/epub+zip" with no BOM, leading
// whitespace, or trailing newline. Readers that enforce this strictly
// (notably some older/strict e-readers and EPUBCheck) reject a file that
// gets this wrong — a real-world defect this common enough that this
// rebuild always writes the canonical bytes rather than preserving
// whatever the original mimetype entry happened to contain. Verified in
// tests/unit/epub-zip.spec.ts by parsing the raw output's first local-file
// header directly (per the canonical "offset 30 == 'application/epub+zip'"
// invariant), not by trusting JSZip's own internal bookkeeping.
export class EpubStructureError extends Error {}

const CANONICAL_MIMETYPE = new TextEncoder().encode("application/epub+zip");

export async function loadEpub(bytes: Uint8Array | ArrayBuffer): Promise<JSZip> {
  return JSZip.loadAsync(bytes);
}

function attrValue(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ?? attrs.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1] : undefined;
}

export async function findOpfPath(zip: JSZip): Promise<string> {
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    throw new EpubStructureError("Missing META-INF/container.xml — this file isn't a valid EPUB container.");
  }
  const xml = await containerFile.async("string");
  const rootfileMatch = xml.match(/<rootfile\b([^>]*)\/?>/i);
  const fullPath = rootfileMatch && attrValue(rootfileMatch[1], "full-path");
  if (!fullPath) {
    throw new EpubStructureError("META-INF/container.xml has no <rootfile full-path=...> pointing at the package document.");
  }
  // full-path is a percent-encoded relative path per the OCF spec.
  try {
    return decodeURIComponent(fullPath);
  } catch {
    return fullPath;
  }
}

export async function readOpf(zip: JSZip, opfPath: string): Promise<string> {
  const opfFile = zip.file(opfPath);
  if (!opfFile) {
    throw new EpubStructureError(`Package document "${opfPath}" (referenced by container.xml) is missing from the EPUB.`);
  }
  return opfFile.async("string");
}

export async function fileExists(zip: JSZip, path: string): Promise<boolean> {
  return zip.file(path) !== null;
}

export async function readFileBytes(zip: JSZip, path: string): Promise<Uint8Array | null> {
  const file = zip.file(path);
  if (!file) return null;
  return file.async("uint8array");
}

// Font obfuscation (IDPF's own algorithm, and Adobe's ADEPT variant) derives
// its XOR/RC4 key from the dc:identifier that the package's unique-identifier
// points at. Changing that identifier after the fact breaks embedded fonts
// without touching the manifest at all — a real, invisible-until-opened
// corruption risk flagged by domain-expert review. This only detects the
// presence of an encryption descriptor; it deliberately does not try to
// re-derive/re-obfuscate anything (out of scope for a metadata tool).
const FONT_OBFUSCATION_ALGORITHMS = [
  "http://www.idpf.org/2008/embedding", // IDPF/EPUB font obfuscation
  "http://ns.adobe.com/pdf/enc#RC", // Adobe ADEPT font obfuscation
];

export async function usesFontObfuscation(zip: JSZip): Promise<boolean> {
  const encryptionFile = zip.file("META-INF/encryption.xml");
  if (!encryptionFile) return false;
  const xml = await encryptionFile.async("string");
  return FONT_OBFUSCATION_ALGORITHMS.some((algorithm) => xml.includes(algorithm));
}

// Rebuilds the EPUB as a byte-correct OCF zip: mimetype first, stored
// uncompressed with canonical content, every other original entry copied
// over in its original order with its content optionally replaced by
// `replacements`.
export async function exportEpub(zip: JSZip, replacements: Map<string, string>): Promise<Uint8Array> {
  const output = new JSZip();
  output.file("mimetype", CANONICAL_MIMETYPE, { compression: "STORE" });

  const entries: { path: string; dir: boolean }[] = [];
  zip.forEach((relativePath, entry) => {
    if (relativePath === "mimetype") return;
    entries.push({ path: relativePath, dir: entry.dir });
  });

  for (const { path, dir } of entries) {
    if (dir) continue;
    const replacement = replacements.get(path);
    if (replacement !== undefined) {
      output.file(path, replacement, { compression: "DEFLATE" });
    } else {
      const original = zip.file(path);
      const content = original ? await original.async("uint8array") : new Uint8Array();
      output.file(path, content, { compression: "DEFLATE" });
    }
  }

  return output.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
}
