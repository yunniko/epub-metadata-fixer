# D002 · OPF edits are scoped regex surgery; the EPUB zip is rebuilt explicitly with mimetype first
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: An uploaded EPUB's manifest/spine is content this tool doesn't fully understand and must not corrupt. OCF requires `mimetype` as the physically first, uncompressed entry; JSZip's default `generateAsync` guarantees neither ordering nor per-entry compression once an entry is touched.
Decision: `buildFixedOpf()` replaces only the known dc:*/meta elements (verified by re-parsing); `exportEpub()` builds a new JSZip with mimetype first (`STORE`) then every original entry in order, verified by parsing the raw local-file header in tests.
Rejected: a generic XML parse-and-reserialize round trip (D004); mutating the zip in place.
Consequence: Don't replace either with a simpler-looking call without real-world EPUB tests.
Evidence: `lib/epub-metadata.ts`; `lib/epub-zip.ts`; `tests/unit/epub-zip.spec.ts`.
