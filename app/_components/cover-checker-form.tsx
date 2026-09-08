"use client";

import { useState } from "react";
import { getImageDimensions } from "@/lib/image-dimensions";
import { checkAllPlatforms, type PlatformCheckResult } from "@/lib/cover-requirements";

interface Result {
  fileName: string;
  width: number;
  height: number;
  checks: PlatformCheckResult[];
}

export function CoverCheckerForm() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dims = getImageDimensions(bytes);
    if (!dims) {
      setError("Couldn't read this file as a PNG or JPEG — those are the two formats this tool can check.");
      return;
    }
    setResult({
      fileName: file.name,
      width: dims.width,
      height: dims.height,
      checks: checkAllPlatforms({ ...dims, fileSizeBytes: bytes.length }),
    });
  }

  return (
    <div className="space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-gray-700">Choose a cover image (PNG or JPEG)</span>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        <span className="mt-1 block text-xs text-gray-500">Processed entirely in your browser — the file is never uploaded anywhere.</span>
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {result && (
        <div className="space-y-3" data-testid="cover-report">
          <h2 className="text-lg font-semibold">
            {result.fileName}: {result.width}×{result.height}px
          </h2>
          <ul className="space-y-2">
            {result.checks.map((check) => (
              <li key={check.platform} className={`rounded-md border p-3 text-sm ${check.pass ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-800"}`}>
                <div className="font-medium">{check.platform}: {check.pass ? "Meets requirements" : "Does not meet requirements"}</div>
                {check.reasons.map((reason) => <div key={reason}>{reason}</div>)}
                {check.warnings.map((warning) => <div key={warning} className="text-amber-800">{warning}</div>)}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">{result.checks[0]?.sourceNote}</p>
        </div>
      )}
    </div>
  );
}
