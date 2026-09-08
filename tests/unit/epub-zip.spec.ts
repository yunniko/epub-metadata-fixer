import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { loadEpub, findOpfPath, readOpf, exportEpub, usesFontObfuscation } from "@/lib/epub-zip";

const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const OPF = `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:1234</dc:identifier>
    <dc:title>Sample</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest></manifest>
</package>`;

async function buildSampleEpub(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", OPF);
  return zip.generateAsync({ type: "uint8array" });
}

// Parses the raw local-file-header of the first entry in a zip byte stream —
// used to independently verify the OCF mimetype rule (first entry, stored,
// no extra field, canonical content at byte offset 30 per the well-known
// EPUB validation trick) without trusting JSZip's own internal bookkeeping.
function firstEntryHeader(bytes: Uint8Array): { name: string; compressionMethod: number; extraFieldLength: number; contentAtOffset30: string } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(view.getUint32(0, true)).toBe(0x04034b50); // local file header signature "PK\x03\x04"
  const compressionMethod = view.getUint16(8, true);
  const nameLength = view.getUint16(26, true);
  const extraFieldLength = view.getUint16(28, true);
  const name = new TextDecoder().decode(bytes.slice(30, 30 + nameLength));
  // "application/epub+zip" is exactly 20 bytes — the canonical EPUB
  // validation trick checks that this string starts right after the
  // filename with zero bytes of extra-field padding in between.
  const contentAtOffset30 = new TextDecoder().decode(bytes.slice(30, 30 + nameLength + extraFieldLength + 20));
  return { name, compressionMethod, extraFieldLength, contentAtOffset30 };
}

describe("epub-zip", () => {
  it("locates the OPF path via container.xml and reads it", async () => {
    const zip = await loadEpub(await buildSampleEpub());
    const opfPath = await findOpfPath(zip);
    expect(opfPath).toBe("OEBPS/content.opf");
    const opfXml = await readOpf(zip, opfPath);
    expect(opfXml).toContain("<dc:title>Sample</dc:title>");
  });

  it("handles single-quoted and percent-encoded full-path attributes in container.xml", async () => {
    const container = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path='OEBPS/my%20book.opf' media-type='application/oebps-package+xml'/>
  </rootfiles>
</container>`;
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", container);
    zip.file("OEBPS/my book.opf", OPF);
    const bytes = await zip.generateAsync({ type: "uint8array" });

    const loaded = await loadEpub(bytes);
    expect(await findOpfPath(loaded)).toBe("OEBPS/my book.opf");
  });

  it("exportEpub keeps mimetype as the first entry, stored uncompressed, with no extra field, canonical content", async () => {
    const zip = await loadEpub(await buildSampleEpub());
    const replacements = new Map([["OEBPS/content.opf", OPF.replace("Sample", "Renamed")]]);
    const output = await exportEpub(zip, replacements);

    const header = firstEntryHeader(output);
    expect(header.name).toBe("mimetype");
    expect(header.compressionMethod).toBe(0); // 0 = stored, no compression
    expect(header.extraFieldLength).toBe(0);
    expect(header.contentAtOffset30).toBe("mimetypeapplication/epub+zip");

    const reloaded = await loadEpub(output);
    const opfPath = await findOpfPath(reloaded);
    const opfXml = await readOpf(reloaded, opfPath);
    expect(opfXml).toContain("Renamed");
  });

  it("exportEpub normalizes a defective original mimetype entry (e.g. trailing newline) to the canonical bytes", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip\n", { compression: "STORE" }); // real-world defect
    zip.file("META-INF/container.xml", CONTAINER_XML);
    zip.file("OEBPS/content.opf", OPF);
    const defectiveBytes = await zip.generateAsync({ type: "uint8array" });

    const loaded = await loadEpub(defectiveBytes);
    const output = await exportEpub(loaded, new Map());
    const mimetypeContent = await (await loadEpub(output)).file("mimetype")!.async("string");
    expect(mimetypeContent).toBe("application/epub+zip");
  });

  describe("usesFontObfuscation", () => {
    it("returns false when there is no META-INF/encryption.xml", async () => {
      const zip = await loadEpub(await buildSampleEpub());
      expect(await usesFontObfuscation(zip)).toBe(false);
    });

    it("returns true when encryption.xml declares the IDPF font-obfuscation algorithm", async () => {
      const zip = new JSZip();
      zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
      zip.file("META-INF/container.xml", CONTAINER_XML);
      zip.file("OEBPS/content.opf", OPF);
      zip.file(
        "META-INF/encryption.xml",
        `<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
          <EncryptedData xmlns="http://www.w3.org/2001/04/xmlenc#">
            <EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/>
          </EncryptedData>
        </encryption>`,
      );
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const loaded = await loadEpub(bytes);
      expect(await usesFontObfuscation(loaded)).toBe(true);
    });
  });
});
