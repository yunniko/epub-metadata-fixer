"use client";

import { useState } from "react";
import { EpubFileInput } from "./epub-file-input";
import { loadEpub, findOpfPath, readOpf, readFileBytes } from "@/lib/epub-zip";
import { parseOpf, validateOpf, resolveOpfRelativePath, type ParsedOpf, type ValidationIssue } from "@/lib/epub-metadata";
import { getImageDimensions } from "@/lib/image-dimensions";
import { checkAllPlatforms, type PlatformCheckResult } from "@/lib/cover-requirements";

interface Report {
  fileName: string;
  meta: ParsedOpf;
  issues: ValidationIssue[];
  coverChecks: PlatformCheckResult[] | null;
  coverDimensions: { width: number; height: number } | null;
  coverError: string | null;
}

export function MetadataCheckerForm() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const zip = await loadEpub(bytes);
      const opfPath = await findOpfPath(zip);
      const opfXml = await readOpf(zip, opfPath);
      const meta = parseOpf(opfXml);
      const issues = validateOpf(meta);

      let coverChecks: PlatformCheckResult[] | null = null;
      let coverDimensions: { width: number; height: number } | null = null;
      let coverError: string | null = null;
      if (meta.coverItemHref) {
        const coverPath = resolveOpfRelativePath(opfPath, meta.coverItemHref);
        const coverBytes = await readFileBytes(zip, coverPath);
        if (!coverBytes) {
          coverError = `Cover image "${coverPath}" is declared in the manifest but that file isn't actually in the EPUB.`;
        } else {
          const dims = getImageDimensions(coverBytes);
          if (!dims) {
            coverError = `Couldn't read "${coverPath}" as a PNG or JPEG — this tool can only check those two formats.`;
          } else {
            coverDimensions = { width: dims.width, height: dims.height };
            coverChecks = checkAllPlatforms({ ...dims, fileSizeBytes: coverBytes.length });
          }
        }
      }

      setReport({ fileName: file.name, meta, issues, coverChecks, coverDimensions, coverError });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read this file as an EPUB.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <EpubFileInput onFile={handleFile} />
      {loading && <p className="text-sm text-gray-500">Checking…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {report && (
        <div className="space-y-6" data-testid="checker-report">
          <div>
            <h2 className="text-lg font-semibold">Results for {report.fileName}</h2>
            <p className="text-sm text-gray-600">EPUB version {report.meta.version}</p>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Title</dt><dd>{report.meta.titles.join(", ") || "—"}</dd></div>
            <div><dt className="text-gray-500">Author</dt><dd>{report.meta.creators.join(", ") || "—"}</dd></div>
            <div><dt className="text-gray-500">Language</dt><dd>{report.meta.languages.join(", ") || "—"}</dd></div>
            <div><dt className="text-gray-500">Identifier</dt><dd>{report.meta.identifiers.map((i) => i.value).join(", ") || "—"}</dd></div>
            <div><dt className="text-gray-500">Publisher</dt><dd>{report.meta.publisher || "—"}</dd></div>
            <div><dt className="text-gray-500">Last modified</dt><dd>{report.meta.modified || "—"}</dd></div>
          </dl>

          <div>
            <h3 className="font-medium">Spec compliance</h3>
            {report.issues.length === 0 ? (
              <p className="mt-2 text-sm text-green-700">No issues found — this EPUB&apos;s metadata meets the spec&apos;s requirements.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.issues.map((issue) => (
                  <li key={issue.code} className={`rounded-md border p-3 text-sm ${issue.severity === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                    <span className="font-medium uppercase">{issue.severity}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {report.coverError && <p className="text-sm text-amber-800">{report.coverError}</p>}
          {report.coverChecks && report.coverDimensions && (
            <div>
              <h3 className="font-medium">
                Cover image ({report.coverDimensions.width}×{report.coverDimensions.height}px)
              </h3>
              <ul className="mt-2 space-y-2">
                {report.coverChecks.map((check) => (
                  <li key={check.platform} className={`rounded-md border p-3 text-sm ${check.pass ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"}`}>
                    <div className="font-medium">{check.platform}: {check.pass ? "Meets requirements" : "Does not meet requirements"}</div>
                    {check.reasons.map((reason) => <div key={reason}>{reason}</div>)}
                    {check.warnings.map((warning) => <div key={warning} className="text-amber-800">{warning}</div>)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-500">{report.coverChecks[0]?.sourceNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
