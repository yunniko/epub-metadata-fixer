import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { mergeFixes, inspectEpub, applyBatchFixes, bundleResults, outputNameFor } from "@/lib/batch-fix";
import { loadEpub, findOpfPath, readOpf } from "@/lib/epub-zip";
import { parseOpf } from "@/lib/epub-metadata";

const CONTAINER_XML = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

function opf(title: string, id: string): string {
  return `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${id}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:language>en</dc:language>
    <dc:creator>Old Author</dc:creator>
    <meta property="dcterms:modified">2020-01-01T00:00:00Z</meta>
  </metadata>
  <manifest></manifest>
</package>`;
}

async function epub(title: string, id: string): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", opf(title, id));
  return zip.generateAsync({ type: "uint8array" });
}

async function metaOf(bytes: Uint8Array) {
  const zip = await loadEpub(bytes);
  const path = await findOpfPath(zip);
  return parseOpf(await readOpf(zip, path));
}

describe("mergeFixes", () => {
  it("applies shared fields, lets a per-file override win, and ignores blanks", () => {
    const merged = mergeFixes({ creator: "New Author", publisher: "" }, { title: "Book One", creator: "" }, false);
    expect(merged).toEqual({ creator: "New Author", title: "Book One" });
  });

  it("drops the identifier for font-obfuscated files", () => {
    const merged = mergeFixes({}, { identifierValue: "urn:isbn:9780000000000" }, true);
    expect(merged).toEqual({});
  });
});

describe("applyBatchFixes", () => {
  it("fixes several files with shared and per-file fields and bundles them into one zip", async () => {
    const a = await inspectEpub({ name: "a.epub", bytes: await epub("A", "urn:uuid:a") });
    const b = await inspectEpub({ name: "b.epub", bytes: await epub("B", "urn:uuid:b") });
    expect(a.error).toBeUndefined();
    expect(a.meta.titles[0]).toBe("A");

    const results = await applyBatchFixes([a, b], { creator: "Shared Author" }, { "b.epub": { title: "B Renamed" } });
    expect(results.map((r) => r.outputName)).toEqual(["a-fixed.epub", "b-fixed.epub"]);
    expect(results.every((r) => r.bytes && !r.error)).toBe(true);

    const metaA = await metaOf(results[0].bytes!);
    const metaB = await metaOf(results[1].bytes!);
    expect(metaA.creators[0]).toBe("Shared Author");
    expect(metaA.titles[0]).toBe("A");
    expect(metaB.creators[0]).toBe("Shared Author");
    expect(metaB.titles[0]).toBe("B Renamed");
    expect(metaB.identifiers[0].value).toBe("urn:uuid:b");

    const bundle = await JSZip.loadAsync(await bundleResults(results));
    expect(Object.keys(bundle.files).sort()).toEqual(["a-fixed.epub", "b-fixed.epub"]);
    const inner = await loadEpub(await bundle.file("b-fixed.epub")!.async("uint8array"));
    expect(await findOpfPath(inner)).toBe("OEBPS/content.opf");
  });

  it("reports an unreadable file as an error and still fixes the others", async () => {
    const good = await inspectEpub({ name: "good.epub", bytes: await epub("Good", "urn:uuid:g") });
    const bad = await inspectEpub({ name: "bad.epub", bytes: new TextEncoder().encode("not a zip") });
    expect(bad.error).toBeTruthy();

    const results = await applyBatchFixes([good, bad], { publisher: "P" });
    expect(results[0].bytes).toBeTruthy();
    expect(results[1].bytes).toBeUndefined();
    expect(results[1].error).toBeTruthy();

    const bundle = await JSZip.loadAsync(await bundleResults(results));
    expect(Object.keys(bundle.files)).toEqual(["good-fixed.epub"]);
  });

  it("names outputs case-insensitively on the extension", () => {
    expect(outputNameFor("Book.EPUB")).toBe("Book-fixed.epub");
    expect(outputNameFor("noext")).toBe("noext-fixed.epub");
  });
});
