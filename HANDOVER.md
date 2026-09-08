# Handover — epub-metadata-fixer

Read this before touching the project. Goal in `GOALS.md` (G-001). Parent
initiative and shared conventions in `E:\CLAUDE\projects\svc-lab\`;
company-wide standards in `E:\CLAUDE\COMPANY\`.

## Current state

Built and locally verified 2026-09-08 by the daily svc-lab automation
loop: three client-side tools (metadata checker, metadata fixer, cover
image checker) over EPUB files. No database, no accounts, no server-side
processing at all — everything runs in the browser via JSZip.

## How things fit together

- `lib/image-dimensions.ts` — reads PNG/JPEG pixel dimensions straight
  from file headers (no image-decoding library).
- `lib/cover-requirements.ts` — per-platform (KDP/Kobo/Apple Books)
  dimension/ratio/format checks against those dimensions.
- `lib/epub-zip.ts` — JSZip wrapper: locate the OPF via container.xml,
  read/write entries, and `exportEpub()` which rebuilds the whole archive
  byte-correctly (see D2).
- `lib/epub-metadata.ts` — parses, validates, and edits the OPF's
  Dublin Core metadata via targeted regex surgery (see D2).
- Each `app/<tool>/page.tsx` is a server component carrying SEO metadata,
  FAQ copy, and JSON-LD; the actual interactive tool is a `"use client"`
  component in `app/_components/`.

## Decision record

**D1 — EPUB 2/3 metadata requirements sourced via WebSearch synthesis, not
direct WebFetch to the W3C/IDPF spec pages.** WebFetch was denied outright
this run (same limitation flagged in prior svc-lab runs, e.g.
resin-mix-ratio-calculator's HANDOVER — see `svc-lab/HANDOVER.md`/
`automation/HANDOVER.md`'s open question on this). The required-elements
facts (dc:identifier/dc:title/dc:language always required; dcterms:modified
required only in EPUB 3; package unique-identifier must IDREF a
dc:identifier) came from WebSearch results quoting the W3C EPUB 3.3 spec
and IDPF OPF 2.0.1 spec text directly, cross-checked against a second
independent secondary source for each claim. See
`docs/domain-reference.md` for the full source list and the domain-expert
review that checked this file's actual code against them.

**D2 — `buildFixedOpf()` does targeted regex-scoped string surgery, not a
full parse-and-reserialize round trip through a generic XML library; and
`exportEpub()` rebuilds the zip explicitly rather than mutating and
re-generating in place.** Both are the same underlying concern: an
uploaded EPUB's manifest/spine/other content is something this tool
doesn't fully understand and must not risk corrupting.
  - For the OPF: a generic XML parse-then-build round trip (originally
    planned with `fast-xml-parser`, see D4) risks reformatting or
    reordering elements this tool never touches. Scoped regex replacement
    of just the known dc:*/meta elements, verified by round-tripping
    through `parseOpf()` again in tests, is safer to reason about and
    keeps every other byte of the file untouched.
  - For the zip: the EPUB OCF (Open Container Format) requires the
    "mimetype" entry be the physically first file in the archive, stored
    with no compression, and no extra field — some strict readers and
    EPUBCheck enforce this. JSZip's default `generateAsync()` doesn't
    document a guarantee about preserving either the ordering or the
    original per-entry compression method once any entry has been
    touched, so `exportEpub()` builds a brand-new `JSZip` instance
    explicitly: mimetype first (forced `compression: "STORE"`), then
    every other original entry copied over in its original order.
    Verified in `tests/unit/epub-zip.spec.ts` by parsing the raw output
    bytes' first local-file-header directly (signature, compression
    method, filename) rather than trusting JSZip's own internal
    bookkeeping.

**D3 — Cover-image size requirements for KDP/Kobo/Apple Books are
aggregated from multiple independent publishing-service guides, not the
platforms' own primary documentation.** Same WebFetch unavailability as
D1. The figures (KDP: ≥625×1000px, ≥1.6:1 height:width, JPEG/TIFF only,
≤10000×10000px, ≤50MB; Kobo: ≥1400px shorter side, ≤2MB guidance; Apple
Books: ≥1400px shorter side) corroborated across multiple independent
write-ups with no contradictions found, and have reportedly been stable
for years — but this is still secondary-source aggregation, disclosed
honestly in each `PlatformCheckResult.sourceNote` shown in the UI itself,
not just in this doc. Re-verify against each platform's current help page
if a future session has WebFetch access and wants to firm this up.

**D5 — Domain-expert review (2026-09-08) found and this run fixed six real
bugs before shipping, not just documentation gaps.** See
`docs/domain-reference.md` for the full source list and finding-by-finding
detail. Highest severity: `buildFixedOpf` was editing the *first*
`dc:identifier` in document order regardless of which one
`unique-identifier` actually pointed at — for a book with an ISBN
identifier listed before its primary UUID, editing the identifier field
silently destroyed the ISBN and left the real identifier unchanged. Also
fixed: no guard against font-obfuscation breakage (fonts encrypted with a
key derived from the identifier — changing it invisibly breaks embedded
fonts; the fixer UI now detects `META-INF/encryption.xml` and disables the
identifier field with an explicit warning), single-quoted-attribute regex
holes in two rewrites, `refines`-unaware `dcterms:modified` handling, a
wrong Kobo file-size threshold (2MB claimed vs. Kobo's own documented
5MB), and an over-strict KDP ratio check (KDP documents 1.6:1 as a
recommendation, not a hard-rejection rule — `PlatformCheckResult` now
separates `reasons` (hard, gate `pass`) from `warnings` (soft)). All
fixed and covered by new regression tests in `tests/unit/`, not just
logged for later.

**D4 — `fast-xml-parser` was added to `package.json` while the OPF-editing
approach was still undecided, then removed before shipping once D2's
regex-surgery approach turned out not to need a generic XML library at
all.** Caught during this run's own review of its dependency list —
removed rather than shipped unused (STANDARDS.md: no dead
dependencies/files accumulating).

## Owner action list

1. AdSense approval status for this domain is unconfirmed, same as every
   other svc-lab service — ask the Owner to check the AdSense dashboard.
2. The backlog entry for this idea suggested "small Stripe fee instead of
   ads" as the monetization angle (narrow professional audience, unlike
   the broad-appeal calculators). Not acted on this run — creating a
   Stripe account is escalation-tier and out of scope for the unattended
   daily loop. Shipped with the portfolio's standard AdSense wiring
   instead; worth an Owner decision later if this service's traffic
   suggests a paid tier would do better than ads.

## Next steps and open questions

- `COMPANY`-doc reconciliation needed (this automation run doesn't edit
  `COMPANY\**` by design): add `epub-metadata-fixer` to
  `COMPANY\INFRASTRUCTURE_DEPLOY.md`'s Company-projects table and port
  registry (app port `127.0.0.1:30110`, no DB, domain
  `epub-metadata-fixer.svc.julienika.cz`).
- The metadata fixer only edits text fields (title/author/language/
  identifier/publisher/description) — it doesn't add or replace a cover
  image. Could be a real next feature if the checker/fixer split proves
  popular, but genuinely optional for a first ship.
- No real-world EPUB file (from an actual e-reader/generator like Calibre,
  Sigil, or Vellum) has been tested through this tool yet — only the
  synthetic fixture generated by `scripts/generate-test-fixtures.mjs` and
  the domain-expert review's code-level check against the spec. If a real
  user reports a parsing failure, a likely first cause is a metadata
  namespace prefix other than the near-universal `dc:`/`opf:` (see
  `lib/epub-metadata.ts`'s header comment) or a `<meta>`/`<item>` written
  as a non-self-closing tag in a way the regexes don't expect.
