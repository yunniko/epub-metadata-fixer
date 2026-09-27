# Handover — epub-metadata-fixer
Last verified: 2026-09-12 at e4bc48b

> **SUSPENDED (Owner, 2026-09-27)** — part of the svc-lab family, suspended because it did not work out as expected.
> No new work; security upkeep only while anything of it is live. Treat its code, formulas and
> decisions as a **lower-reliability reference**: they may or may not still work, so re-verify before
> reusing anything. Rules: `E:\CLAUDE\COMPANY\GOALS.md` → "Suspended projects".

svc-lab service #7. Goal: `GOALS.md` G-001. Shared conventions: `E:\CLAUDE\projects\svc-lab\`;
charter: `E:\CLAUDE\COMPANY\`.

## Current state

- **Live** at https://epub-metadata-fixer.svc.julienika.cz (port 30110). **Production runs branch
  `hotfix/next-16.3.6-on-live` (`c768e62`), not master**: commit 4eb7ef7 plus the 2026-09-27
  security bump. All routes 200 in a browser on 2026-09-27.
- Three free client-side tools over EPUB files (metadata checker, metadata fixer, cover-image
  checker) via JSZip; no database. Files never reach a server.
- **Paid batch mode** (`/batch-fixer`, D007) exists on master only and was **never deployed**
  (the live `/batch-fixer` is 404, checked 2026-09-27; an earlier line here said otherwise).
  Stripe Checkout, $5 one-time, signed-cookie entitlement; it needs the Owner's Stripe values in
  the host env file and approval to launch (`PENDING APPROVAL` in `GOALS.md`).
- Verification on 2026-09-12: ESLint clean, `npm run build` clean, Vitest 55/55, Playwright 9/9.
- Domain-expert review fixed six real bugs before shipping (D005).

## How things fit together

- `lib/image-dimensions.ts`: PNG/JPEG dimensions from file headers.
- `lib/cover-requirements.ts`: per-platform checks; `reasons` gate `pass`, `warnings` don't.
- `lib/epub-zip.ts`: the only JSZip touchpoint; `exportEpub()` rebuilds the archive with
  `mimetype` first and stored (D002).
- `lib/epub-metadata.ts`: parse/validate/edit Dublin Core via scoped regex surgery (D002).
- `app/<tool>/page.tsx` server components carry SEO/FAQ/JSON-LD; interactive tools in
  `app/_components/`. Fixtures come from `npm run generate-fixtures`.

## Rules in force

- Never replace `exportEpub()` with an in-place `zip.file(); generateAsync()`, and never swap the
  regex surgery for a generic XML round trip without real-world EPUB tests (D002).
- Identifier edits must target the `unique-identifier` target and stay disabled when
  the EPUB contains an `encryption.xml` under META-INF (D005).
- `npm ci --legacy-peer-deps`; run unit, e2e and `npm run build` before calling work done.

## Next steps and open questions

- No real-world EPUB (Calibre, Sigil, Vellum) has been run through the tool; likely first
  failure causes are a non-`dc:`/`opf:` namespace prefix or a non-self-closing `<meta>`/`<item>`.
- Cover image add/replace is a plausible next feature, optional.
- Owner decision pending: the backlog suggested a small Stripe fee instead of ads for this narrow
  professional audience; shipped with standard AdSense wiring (Stripe account = escalation).
- AdSense per-domain approval unconfirmed (portfolio-wide).

## Deploy log

| Date | Commit | What changed | Verified how |
|---|---|---|---|
| 2026-09-08 | e4bc48b | First deploy (port 30110) after an interactive session re-verified the automation's build | Full suite re-run; routes curl 200 |
| 2026-09-27 | c768e62 | Security: next 16.3.1 → 16.3.6 on branch `hotfix/next-16.3.6-on-live` (built on 4eb7ef7, so master's undeployed batch mode stays out) | lint, unit 45/45, e2e 5/5, build; container reports 16.3.6; 4 routes 200, `/batch-fixer` 404; other containers untouched |

## Decisions

`docs/decisions/README.md` (D001–D006).
