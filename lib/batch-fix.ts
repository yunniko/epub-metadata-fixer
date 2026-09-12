// Batch metadata fixing: the same per-file surgery the single-file fixer
// does (lib/epub-metadata.ts buildFixedOpf + lib/epub-zip.ts exportEpub),
// applied to many EPUBs at once with one set of shared fields (author,
// publisher, language, description) and optional per-file overrides
// (typically title and identifier, which differ per book). Pure, client-side,
// unit-tested; the UI in app/_components/batch-fixer-form.tsx only wires it
// up. Font-obfuscated files keep their identifier untouched for the same
// reason the single-file fixer disables that field (changing it breaks the
// embedded fonts).
import JSZip from "jszip";
import { loadEpub, findOpfPath, readOpf, exportEpub, usesFontObfuscation } from "./epub-zip";
import { parseOpf, buildFixedOpf, type OpfFixes, type ParsedOpf } from "./epub-metadata";

export interface BatchInputFile {
  name: string;
  bytes: Uint8Array;
}

export interface InspectedFile extends BatchInputFile {
  opfPath: string;
  opfXml: string;
  meta: ParsedOpf;
  hasFontObfuscation: boolean;
  error?: string;
}

export interface BatchFixResult {
  name: string;
  outputName: string;
  bytes?: Uint8Array;
  error?: string;
}

// Shared fields apply to every file; a per-file override wins for that file.
// Empty-string values are treated as "leave this field alone" so a blank
// shared Publisher does not wipe every book's publisher.
export function mergeFixes(shared: OpfFixes, override: OpfFixes | undefined, hasFontObfuscation: boolean): OpfFixes {
  const merged: OpfFixes = {};
  const keys = new Set<keyof OpfFixes>([...(Object.keys(shared) as (keyof OpfFixes)[]), ...(Object.keys(override ?? {}) as (keyof OpfFixes)[])]);
  for (const key of keys) {
    const value = override?.[key] !== undefined && override[key] !== "" ? override[key] : shared[key];
    if (value !== undefined && value !== "") merged[key] = value;
  }
  if (hasFontObfuscation) delete merged.identifierValue;
  return merged;
}

export async function inspectEpub(file: BatchInputFile): Promise<InspectedFile> {
  try {
    const zip = await loadEpub(file.bytes);
    const opfPath = await findOpfPath(zip);
    const opfXml = await readOpf(zip, opfPath);
    const meta = parseOpf(opfXml);
    const hasFontObfuscation = await usesFontObfuscation(zip);
    return { ...file, opfPath, opfXml, meta, hasFontObfuscation };
  } catch (err) {
    return {
      ...file,
      opfPath: "",
      opfXml: "",
      meta: { version: "", identifiers: [], titles: [], languages: [], creators: [], manifestItems: [] },
      hasFontObfuscation: false,
      error: err instanceof Error ? err.message : "Couldn't read this file as an EPUB.",
    };
  }
}

export function outputNameFor(inputName: string): string {
  return inputName.replace(/\.epub$/i, "") + "-fixed.epub";
}

export async function applyBatchFixes(
  files: InspectedFile[],
  shared: OpfFixes,
  overrides: Record<string, OpfFixes> = {},
): Promise<BatchFixResult[]> {
  const results: BatchFixResult[] = [];
  for (const file of files) {
    const outputName = outputNameFor(file.name);
    if (file.error) {
      results.push({ name: file.name, outputName, error: file.error });
      continue;
    }
    try {
      const fixes = mergeFixes(shared, overrides[file.name], file.hasFontObfuscation);
      const fixedOpfXml = buildFixedOpf(file.opfXml, fixes);
      const zip = await loadEpub(file.bytes);
      const bytes = await exportEpub(zip, new Map([[file.opfPath, fixedOpfXml]]));
      results.push({ name: file.name, outputName, bytes });
    } catch (err) {
      results.push({ name: file.name, outputName, error: err instanceof Error ? err.message : "Couldn't apply fixes." });
    }
  }
  return results;
}

// One zip with every successfully fixed EPUB (each EPUB is itself a zip,
// stored here uncompressed since deflating a deflated file gains nothing).
export async function bundleResults(results: BatchFixResult[]): Promise<Uint8Array> {
  const bundle = new JSZip();
  for (const r of results) {
    if (r.bytes) bundle.file(r.outputName, r.bytes, { compression: "STORE" });
  }
  return bundle.generateAsync({ type: "uint8array" });
}
