// Regenerates the binary test fixtures under tests/e2e/fixtures/. These
// can't be hand-written like text fixtures (a real zip, real image headers),
// so this script is the source of truth for them — re-run it if a fixture
// needs to change rather than hand-editing the binary files.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

const FIXTURES_DIR = path.join(import.meta.dirname, "..", "tests", "e2e", "fixtures");

const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const OPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:sample-fixture-0001</dc:identifier>
    <dc:title>Sample Fixture Book</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Test Author</dc:creator>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="chap1" href="chap1.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-img" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
  </manifest>
  <spine>
    <itemref idref="chap1"/>
  </spine>
</package>`;

const CHAPTER_XHTML = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Sample chapter text.</p></body></html>`;

function buildJpeg(width, height) {
  const bytes = new Uint8Array(2 + 2 + 2 + 9);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xc0;
  const view = new DataView(bytes.buffer);
  view.setUint16(4, 11, false);
  bytes[6] = 8;
  view.setUint16(7, height, false);
  view.setUint16(9, width, false);
  bytes[11] = 1;
  bytes[12] = 1;
  bytes[13] = 0x11;
  bytes[14] = 0;
  return bytes;
}

function buildPng(width, height) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  bytes[24] = 8;
  bytes[25] = 2;
  return bytes;
}

async function main() {
  await mkdir(FIXTURES_DIR, { recursive: true });

  const coverBytes = buildJpeg(1600, 2560);
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", OPF);
  zip.file("OEBPS/chap1.xhtml", CHAPTER_XHTML);
  zip.file("OEBPS/cover.jpg", coverBytes);
  const epubBytes = await zip.generateAsync({ type: "uint8array" });
  await writeFile(path.join(FIXTURES_DIR, "sample.epub"), epubBytes);

  await writeFile(path.join(FIXTURES_DIR, "cover-valid.jpg"), buildJpeg(1600, 2560));
  await writeFile(path.join(FIXTURES_DIR, "cover-small.png"), buildPng(400, 600));

  console.log("Fixtures written to", FIXTURES_DIR);
}

main();
