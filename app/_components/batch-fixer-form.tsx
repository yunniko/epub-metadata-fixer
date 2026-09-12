"use client";

import { useState } from "react";
import { DownloadBlobButton } from "./download-blob-button";
import { inspectEpub, applyBatchFixes, bundleResults, type InspectedFile, type BatchFixResult } from "@/lib/batch-fix";
import type { OpfFixes } from "@/lib/epub-metadata";

type PerFile = Pick<OpfFixes, "title" | "identifierValue">;

export function BatchFixerForm() {
  const [files, setFiles] = useState<InspectedFile[]>([]);
  const [shared, setShared] = useState<OpfFixes>({});
  const [perFile, setPerFile] = useState<Record<string, PerFile>>({});
  const [results, setResults] = useState<BatchFixResult[] | null>(null);
  const [zipBytes, setZipBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);
    setResults(null);
    setZipBytes(null);
    setBusy(true);
    try {
      const inspected: InspectedFile[] = [];
      const initial: Record<string, PerFile> = {};
      for (const file of Array.from(list)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const info = await inspectEpub({ name: file.name, bytes });
        inspected.push(info);
        initial[file.name] = {
          title: info.meta.titles[0] ?? "",
          identifierValue: info.meta.identifiers[0]?.value ?? "",
        };
      }
      setFiles(inspected);
      setPerFile(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read these files.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    setBusy(true);
    setError(null);
    try {
      const out = await applyBatchFixes(files, shared, perFile);
      setResults(out);
      setZipBytes(out.some((r) => r.bytes) ? await bundleResults(out) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't apply these fixes.");
    } finally {
      setBusy(false);
    }
  }

  function updateShared(name: keyof OpfFixes, value: string) {
    setShared((prev) => ({ ...prev, [name]: value }));
    setResults(null);
    setZipBytes(null);
  }

  function updatePerFile(fileName: string, name: keyof PerFile, value: string) {
    setPerFile((prev) => ({ ...prev, [fileName]: { ...prev[fileName], [name]: value } }));
    setResults(null);
    setZipBytes(null);
  }

  const readable = files.filter((f) => !f.error);
  const fixedCount = results?.filter((r) => r.bytes).length ?? 0;

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">Choose .epub files (select several at once)</span>
        <input
          type="file"
          multiple
          accept=".epub,application/epub+zip"
          onChange={(event) => handleFiles(event.target.files)}
          className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        <span className="mt-1 block text-xs text-gray-500">
          Processed entirely in your browser — the files are never uploaded anywhere.
        </span>
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}

      {files.length > 0 && (
        <>
          <fieldset className="space-y-3 rounded-md border border-gray-200 p-4">
            <legend className="px-1 text-sm font-semibold">Shared fields (applied to every file; leave blank to keep a file&apos;s own value)</legend>
            {(
              [
                ["creator", "Author"],
                ["publisher", "Publisher"],
                ["language", "Language (BCP 47 code, e.g. en or en-US)"],
                ["description", "Description"],
              ] as [keyof OpfFixes, string][]
            ).map(([name, label]) => (
              <label key={name} className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
                <input
                  type="text"
                  value={shared[name] ?? ""}
                  onChange={(e) => updateShared(name, e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </fieldset>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="batch-table">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-3">File</th>
                  <th className="py-2 pr-3">Title</th>
                  <th className="py-2 pr-3">Identifier</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.name} className="border-t border-gray-200 align-top">
                    <td className="py-2 pr-3">
                      <span className="font-medium">{f.name}</span>
                      {f.error && <span className="mt-1 block text-xs text-red-700">{f.error}</span>}
                      {f.hasFontObfuscation && (
                        <span className="mt-1 block text-xs text-amber-800">Font obfuscation: identifier kept unchanged.</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        aria-label={`Title for ${f.name}`}
                        value={perFile[f.name]?.title ?? ""}
                        disabled={!!f.error}
                        onChange={(e) => updatePerFile(f.name, "title", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 disabled:bg-gray-100"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        aria-label={`Identifier for ${f.name}`}
                        value={perFile[f.name]?.identifierValue ?? ""}
                        disabled={!!f.error || f.hasFontObfuscation}
                        onChange={(e) => updatePerFile(f.name, "identifierValue", e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 disabled:bg-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleApply}
              disabled={busy || readable.length === 0}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:bg-gray-300"
            >
              {busy ? "Working…" : `Apply fixes to ${readable.length} file${readable.length === 1 ? "" : "s"}`}
            </button>
            <DownloadBlobButton bytes={zipBytes} filename="fixed-epubs.zip" mimeType="application/zip" label="Download all as .zip" />
          </div>

          {results && (
            <div className="text-sm" data-testid="batch-summary">
              <p className={fixedCount === results.length ? "text-green-700" : "text-amber-800"}>
                {fixedCount} of {results.length} files fixed.
              </p>
              <ul className="mt-2 space-y-1">
                {results.map((r) => (
                  <li key={r.name}>
                    {r.bytes ? (
                      <span>✓ {r.outputName}</span>
                    ) : (
                      <span className="text-red-700">✗ {r.name}: {r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
