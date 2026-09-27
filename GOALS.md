# Goals — epub-metadata-fixer

> **SUSPENDED (Owner, 2026-09-27)** — part of the svc-lab family, suspended because it did not work out as expected.
> No new work; security upkeep only while anything of it is live. Treat its code, formulas and
> decisions as a **lower-reliability reference**: they may or may not still work, so re-verify before
> reusing anything. Rules: `E:\CLAUDE\COMPANY\GOALS.md` → "Suspended projects".

Part of the `svc-lab` portfolio initiative (G-001 in
`E:\CLAUDE\projects\svc-lab\GOALS.md`, backlog idea #9). Company-wide
template and conventions in `E:\CLAUDE\COMPANY\`.

### G-001 · Ship epub-metadata-fixer as a live svc-lab service — SUSPENDED
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
- [x] M3 — Security review (manual equivalent, see HANDOVER D6), GitHub
      repo created and pushed, deployed to
      `epub-metadata-fixer.svc.julienika.cz`, hub page and sitemap index
      updated and redeployed. ✔ 2026-09-08, completed by an interactive
      session resuming from the prior run's session-budget stop.
- [ ] M4 (ongoing) — Track whether it gets indexed/used; revisit
      monetization if traffic justifies it.
- [x] M5 — Paid batch mode (Stripe Checkout, $5 one-time, signed-cookie
      entitlement, D007). Built, tested, deployed in Stripe **test mode**
      2026-09-12; live keys are an Owner decision.

**Progress log** (newest first):
- 2026-09-12 — Owner delegated the monetization decisions and gave Stripe
  access (interactive session). Built the **Batch EPUB Metadata Fixer**
  (`/batch-fixer`): shared fields across many files, per-file title/
  identifier table, one zip download; `lib/batch-fix.ts` reuses the
  single-file surgery. Paid via Stripe Checkout ($5 one-time, inline
  price so no dashboard product is needed), entitlement = 12-month
  HMAC-signed HttpOnly cookie set by `/api/verify` after a server-side
  session check; the success URL doubles as a restore link. New
  dependency: `stripe` 22.6.2 (server-only). Verified: ESLint clean,
  production build clean (3 dynamic routes + 7 static), Vitest 55/55
  (10 new), Playwright 9/9 (4 new: paywall, 503 without keys, forged
  cookie rejected, two-file batch → zip). Manual security checklist:
  no secrets staged, only two server routes (no client input is trusted —
  the session id is regex-validated and re-fetched from Stripe), JSON-LD
  via the shared helper, files still never leave the browser. The harness
  blocked writing the key into the host env file and creating products
  via the Stripe dashboard/API, so the page is deployed in the honest
  "purchases temporarily unavailable" state until the Owner adds the two
  env values (see README → Configuration) and redeploys. Test-mode keys
  first; **PENDING APPROVAL: switching to live keys — logged 2026-09-12** —
  real charges need the Owner's trade-licence/VAT position settled and
  a live restricted key created in the dashboard (Owner-only).
- 2026-09-08 — Deployed by an interactive session, resuming from the
  automation run's session-budget stopping point. Re-verified the full
  suite independently before shipping (ESLint, 45 Vitest tests, clean
  build, 5 Playwright tests — all clean), spot-checked the regression
  test covering the highest-severity domain-expert finding (ISBN listed
  before the primary UUID), then: `init-repo.ps1` (public repo,
  `yunniko/epub-metadata-fixer`), confirmed port 30110 free live,
  `deploy-service.ps1` (clean on the first attempt), updated
  `julienika-home`'s hub page and sitemap index and redeployed it. Live
  at https://epub-metadata-fixer.svc.julienika.cz — verified all three
  tool routes plus sitemap.xml/ads.txt over HTTPS, a real browser
  screenshot of the homepage, and confirmed every other container on the
  host kept its prior uptime.
- 2026-09-08 — **BLOCKED (session budget, not a technical blocker):** built,
  fully tested (ESLint/Vitest/build/Playwright all clean), domain-expert
  reviewed with fixes applied and verified, `git init`/committed locally
  (2 commits). Ran out of this run's session budget before reaching
  `init-repo.ps1`/`deploy-service.ps1` — stopped here deliberately rather
  than risk starting the GitHub-push-and-live-deploy pipeline and running
  out mid-way. **Nothing has left the workspace yet**: no GitHub repo
  created, no VPS deploy attempted, hub page not yet updated. Also could
  not run `/security-review` automatically (see HANDOVER D6 — the skill's
  `origin/HEAD` precondition fails before a remote exists; did a manual
  equivalent instead, no findings). Next run (or an interactive session)
  should resume from here: pick port 30110 (next free per
  `INFRASTRUCTURE_DEPLOY.md` as of 2026-09-08), run `init-repo.ps1` then
  `deploy-service.ps1`, then the SEO review and hub/sitemap update per the
  runbook's step 6, then mark M3 done and add the COMPANY-doc
  reconciliation note.
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
