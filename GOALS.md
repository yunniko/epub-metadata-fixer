# Goals — epub-metadata-fixer

Part of the `svc-lab` portfolio initiative (G-001 in
`E:\CLAUDE\projects\svc-lab\GOALS.md`, backlog idea #9). Company-wide
template and conventions in `E:\CLAUDE\COMPANY\`.

### G-001 · Ship epub-metadata-fixer as a live svc-lab service — ACTIVE
- **What:** Three client-side EPUB tools for self-published authors: a
  metadata checker, a metadata fixer, and a cover-image checker.
- **Why:** svc-lab backlog idea #9 — narrow professional audience
  (self-published authors preparing EPUBs for KDP/Kobo/Apple Books), real
  spec-grounded correctness problem (missing/malformed required metadata,
  wrong cover dimensions) that generic EPUB editors don't specifically
  surface as actionable fixes.
- **Acceptance criteria:** Built, tested (unit + e2e + build + lint all
  clean), domain-expert-reviewed against the real EPUB 2/3 spec, security-
  reviewed, deployed live over HTTPS, linked from the julienika-home hub
  and sitemap index.
- **Constraints:** No database, no accounts, zero budget. The backlog
  entry suggested a small Stripe fee instead of ads — not built this run
  (creating a Stripe account is escalation-tier for the daily automation);
  shipped with the same AdSense wiring as every other svc-lab service
  instead. Revisit monetization with the Owner if this service's traffic
  ever justifies it.

**Milestones:**
- [x] M1 — Build all three tools with pure, unit-tested `lib/*.ts` logic;
      ESLint, Vitest, production build, and Playwright e2e all clean.
- [x] M2 — Domain-expert review against the EPUB 2/3 spec and the
      cover-size sourcing. Found and this run fixed six real bugs
      (see below), not just documentation gaps.
- [ ] M3 — Security review, git init/commit, GitHub repo, deploy to
      `epub-metadata-fixer.svc.julienika.cz`, hub/sitemap update.
- [ ] M4 (ongoing) — Track whether it gets indexed/used; revisit
      monetization if traffic justifies it.

**Progress log** (newest first):
- 2026-09-08 — Domain-expert review against the EPUB 2/3 spec, the OCF
  container format, and KDP/Kobo/Apple Books cover-image requirements
  found six real, shippable-corruption-risk bugs (not just wording
  issues) — highest severity: `buildFixedOpf` could silently overwrite
  the wrong `dc:identifier` on a book with more than one (e.g. an ISBN
  listed before the primary UUID), destroying the ISBN instead of fixing
  the identifier the user meant to edit. Also found: no protection
  against breaking IDPF/Adobe font obfuscation when changing the
  identifier, two single-quoted-attribute regex holes, `refines`-unaware
  `dcterms:modified` handling, a wrong Kobo file-size threshold (claimed
  2MB, Kobo's own help page says 5MB), and an over-strict KDP cover-ratio
  check (KDP documents 1.6:1 as a recommendation, not a hard rejection).
  All six fixed same run — not logged for later — and covered by new
  regression tests (15 new Vitest cases). Full detail in
  `docs/domain-reference.md` and `HANDOVER.md` D5. Re-ran the full
  verification suite clean afterward: ESLint, 45 Vitest unit tests,
  production build, 5 Playwright e2e tests.
- 2026-09-08 — Built by the daily svc-lab automation loop. Picked backlog
  idea #9 (EPUB/metadata fixer) — the only remaining unshipped idea
  without an explicit legal/harm-risk flag (#5/#6) or crowded-market
  deprioritization (#7). Sourced the EPUB 2/3 metadata requirements
  (dc:identifier/dc:title/dc:language always required; dcterms:modified
  and the package unique-identifier↔dc:identifier IDREF rule) and cover-
  image size guidance for KDP/Kobo/Apple Books via WebSearch synthesis —
  WebFetch to the primary W3C/IDPF/platform pages was unavailable this
  run (same limitation as prior runs), disclosed honestly in
  `docs/domain-reference.md` and in the cover-checker's own FAQ copy
  rather than presented as pulled from the platforms' own docs. Three
  tools, all client-side (JSZip in the browser, no API routes): a
  metadata checker, a metadata fixer (regex-scoped OPF surgery that
  preserves manifest/spine untouched, plus a from-scratch zip rebuild
  that keeps the EPUB OCF's mimetype-first-and-stored requirement — see
  HANDOVER D2), and a cover-image checker (PNG/JPEG header parsing, no
  image-decoding library needed). All local verification passed clean on
  the first attempt: ESLint (0 errors after fixing 3 unused-arg
  warnings), 30 Vitest unit tests, production build (6 routes), 5
  Playwright e2e tests against real binary fixtures (a real generated
  .epub, real PNG/JPEG headers). One new dependency beyond the template
  baseline: `jszip` (EPUB is a zip; isomorphic browser+Node so the same
  code runs client-side and in Vitest). `fast-xml-parser` was initially
  added for OPF parsing, then dropped before shipping once the simpler
  regex-scoped approach (HANDOVER D2) turned out not to need it — removed
  from package.json rather than left in unused.
