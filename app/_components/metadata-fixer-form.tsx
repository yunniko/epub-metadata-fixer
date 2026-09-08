"use client";

import { useState } from "react";
import { EpubFileInput } from "./epub-file-input";
import { DownloadBlobButton } from "./download-blob-button";
import { loadEpub, findOpfPath, readOpf, exportEpub, usesFontObfuscation } from "@/lib/epub-zip";
import { parseOpf, buildFixedOpf, type OpfFixes } from "@/lib/epub-metadata";

interface LoadedEpub {
  fileName: string;
  bytes: Uint8Array;
  opfPath: string;
  opfXml: string;
  hasFontObfuscation: boolean;
}

export function MetadataFixerForm() {
  const [loaded, setLoaded] = useState<LoadedEpub | null>(null);
  const [fields, setFields] = useState<OpfFixes>({});
  const [error, setError] = useState<string | null>(null);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setOutputBytes(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const zip = await loadEpub(bytes);
      const opfPath = await findOpfPath(zip);
      const opfXml = await readOpf(zip, opfPath);
      const meta = parseOpf(opfXml);
      const hasFontObfuscation = await usesFontObfuscation(zip);
      setLoaded({ fileName: file.name, bytes, opfPath, opfXml, hasFontObfuscation });
      setFields({
        title: meta.titles[0] ?? "",
        creator: meta.creators[0] ?? "",
        language: meta.languages[0] ?? "",
        identifierValue: meta.identifiers[0]?.value ?? "",
        publisher: meta.publisher ?? "",
        description: meta.description ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read this file as an EPUB.");
      setLoaded(null);
    }
  }

  async function handleApply() {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    try {
      const effectiveFields = loaded.hasFontObfuscation ? { ...fields, identifierValue: undefined } : fields;
      const fixedOpfXml = buildFixedOpf(loaded.opfXml, effectiveFields);
      const zip = await loadEpub(loaded.bytes);
      const output = await exportEpub(zip, new Map([[loaded.opfPath, fixedOpfXml]]));
      setOutputBytes(output);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply these fixes.");
    } finally {
      setBusy(false);
    }
  }

  function updateField(name: keyof OpfFixes, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
    setOutputBytes(null);
  }

  return (
    <div className="space-y-6">
      <EpubFileInput onFile={handleFile} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      {loaded && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Editing {loaded.fileName}</h2>
          {loaded.hasFontObfuscation && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              This EPUB uses font obfuscation (embedded fonts encrypted with a key derived from its identifier). Changing
              the identifier breaks those fonts unless you re-obfuscate afterward with a dedicated EPUB tool — the
              identifier field is disabled here to avoid silently corrupting your fonts.
            </p>
          )}
          {(
            [
              ["title", "Title"],
              ["creator", "Author"],
              ["language", "Language (BCP 47 code, e.g. en or en-US)"],
              ["identifierValue", "Identifier (e.g. ISBN or UUID)"],
              ["publisher", "Publisher"],
              ["description", "Description"],
            ] as [keyof OpfFixes, string][]
          ).map(([name, label]) => {
            const disabled = name === "identifierValue" && loaded.hasFontObfuscation;
            return (
              <label key={name} className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
                {name === "description" ? (
                  <textarea
                    value={fields[name] ?? ""}
                    onChange={(e) => updateField(name, e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={fields[name] ?? ""}
                    onChange={(e) => updateField(name, e.target.value)}
                    disabled={disabled}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
                  />
                )}
              </label>
            );
          })}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={busy}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
            >
              {busy ? "Applying…" : "Apply fixes"}
            </button>
            <DownloadBlobButton
              bytes={outputBytes}
              filename={loaded.fileName.replace(/\.epub$/i, "") + "-fixed.epub"}
              mimeType="application/epub+zip"
              label="Download fixed .epub"
            />
          </div>
          {outputBytes && (
            <p className="text-sm text-green-700">
              Fixed file ready. The package&apos;s unique-identifier reference and, for EPUB 3 files, the dcterms:modified
              timestamp were realigned automatically.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
