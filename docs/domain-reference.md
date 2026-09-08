# Domain reference — EPUB spec & cover-image requirements

Compiled from a `domain-expert` subagent review run 2026-09-08 against two
domains: (1) EPUB 2/3 package-document metadata + OCF container rules, and
(2) Amazon KDP / Kobo Writing Life / Apple Books cover-image requirements.
WebFetch was unavailable for both the review and this project's own
research, so everything below is WebSearch-retrieved snippet text plus
recalled spec knowledge — see the per-claim source notes. This is
secondary-source aggregation, not a read of the primary specs/help pages;
re-verify against the primary sources if a future session has WebFetch
access.

## A. EPUB package-document metadata

| Fact | Confidence |
|---|---|
| EPUB 3 (3.0/3.0.1/3.2/3.3) requires ≥1 each of `dc:identifier`, `dc:title`, `dc:language` | High — corroborated across W3C EPUB 3.3, EPUB Packages 3.2, EPUB Publications 3.0.1 search snippets |
| `<package unique-identifier>` is required and MUST be an IDREF to a `dc:identifier`'s `id` | High — same sources |
| EPUB 2 (OPF 2.0.1) requires the same trio + same unique-identifier IDREF rule | Medium — recalled, not separately re-cited this run |
| EPUB 3 requires exactly one publication-level `dcterms:modified`, format `CCYY-MM-DDThh:mm:ssZ`; additional `dcterms:modified` metas are legal only with a `refines` attribute (a different subject, not the publication timestamp) | High |
| `dcterms:modified` is EPUB-3-only | Medium — implied by spec texts, not separately cited |
| Changing the `dc:identifier` referenced by `unique-identifier` breaks IDPF/Adobe font obfuscation, which derives its key from that string | High — corroborated across an obfuscation-tool README and two independent write-ups |

## B. EPUB OCF ZIP container

| Fact | Confidence |
|---|---|
| "mimetype" must be the physically first zip entry, containing exactly `application/epub+zip` (US-ASCII, no BOM/padding/whitespace) | High — OCF 3.0.1/3.1 spec snippets + MobileRead wiki |
| mimetype must not be compressed or encrypted, and must have no extra field | High — same sources |
| Consequence: bytes 30 onward in a conformant EPUB read `mimetypeapplication/epub+zip` | High — a named, citable validation trick |

## C. Cover images

| Platform | Threshold | Confidence |
|---|---|---|
| Amazon KDP | Min 625px shortest side / 1000px longest side; max 10,000px; JPEG/TIFF (for the *standalone* cover upload); RGB required; under 50MB | Medium-high — multiple independent round-ups, all citing KDP's own help page (not fetched directly) |
| Amazon KDP | 1.6:1 ratio / 1600×2560px recommended | Medium — KDP's own wording is "ideal"/"recommended", not a stated hard-rejection rule |
| Kobo Writing Life | Portrait orientation required; 5MB file-size cap | High — Kobo's own Help Centre article ("Cover Image Tips") |
| Kobo Writing Life | Minimum pixel dimension | **Unresolved** — third-party sources disagree (1400px vs 2400px); Kobo's own help text states no specific number. Not asserted as a hard requirement in this project. |
| Apple Books | ≥1400px on the shorter side | Medium-high — Apple's own Book Cover Art guide, reached via search snippet |

## Findings against this project's code, and what was fixed

The domain-expert review found real, shippable-corruption-risk bugs, not
just documentation gaps. All were fixed same-run, verified by new
regression tests in `tests/unit/`:

1. **Multi-identifier overwrite bug (highest severity).** `buildFixedOpf`
   always targeted the *first* `dc:identifier` in document order,
   regardless of which one `unique-identifier` actually pointed at. For a
   book with an ISBN identifier listed before its primary UUID identifier
   (a common real-world layout), editing the identifier silently destroyed
   the ISBN instead of updating the primary one. **Fixed**: now resolves
   the specific element whose `id` matches the primary identifier before
   editing. See `tests/unit/epub-metadata.spec.ts`'s "updates the PRIMARY
   dc:identifier" test.
2. **Font obfuscation risk, previously unhandled.** Changing the
   identifier on a book with IDPF/Adobe font obfuscation breaks embedded
   fonts invisibly. **Fixed**: `lib/epub-zip.ts`'s `usesFontObfuscation()`
   detects `META-INF/encryption.xml` declaring either obfuscation
   algorithm; the fixer UI disables the identifier field and shows an
   explicit warning when detected.
3. **Single-quoted-attribute regex holes.** The `unique-identifier` and
   `dcterms:modified` rewrites only matched double-quoted attributes,
   silently no-op'ing (or duplicating an element) on legally single-quoted
   OPFs. **Fixed**: rewrites now handle both quote styles.
4. **`refines`-unaware `dcterms:modified` handling.** A refining
   `dcterms:modified` meta (legal, refines a different element) could be
   mistaken for the publication-level one, both when reading (suppressing
   a real missing-modified error) and when writing (corrupting the
   refining element). **Fixed**: both parse and rewrite now explicitly
   exclude metas carrying `refines`.
5. **Kobo's file-size threshold was flatly wrong** (2MB vs. Kobo's own
   documented 5MB) and the 1400px minimum was an unverified, contradicted
   figure. **Fixed**: cap corrected to 5MB per Kobo's own help page;
   portrait-orientation is now the hard check (also Kobo-documented); the
   pixel-count claim was downgraded to an unlabeled-as-fact soft
   recommendation rather than removed entirely, since some resolution
   guidance is still useful even without a confirmed exact number.
6. **KDP's 1.6:1 ratio was enforced as a hard failure**; KDP's own wording
   only calls it "ideal"/"recommended". **Fixed**: `PlatformCheckResult`
   now separates `reasons` (hard failures, gate `pass`) from `warnings`
   (recommendations); the ratio check moved to `warnings`.
7. Minor correctness fixes also applied: numeric XML character references
   (`&#8217;`) are now decoded/re-encoded correctly instead of
   double-escaping on write-back; a duplicate `id="pub-id"` collision is
   now avoided by minting a fresh id when one already exists; empty/
   whitespace-only required elements are now treated as absent, not
   present; `missing-unique-identifier-attr` is now reported independently
   of whether any identifiers exist; the OCF `container.xml` parser now
   accepts single-quoted and percent-encoded `full-path` attributes; the
   zip rebuild now always writes the canonical mimetype bytes rather than
   preserving a possibly-defective original (e.g. a trailing newline).

**Known, deliberately-not-fixed gaps** (logged honestly rather than
silently shipped as if absent):
- Only the first `dc:creator`/`dc:title` is editable; a `file-as`/sort-name
  attribute paired with either isn't kept in sync with an edit.
- Colour space (RGB vs. CMYK) isn't checked for KDP/Apple covers — both
  reject CMYK, and this tool can't currently detect it.
- No real-world EPUB (from Calibre/Sigil/Vellum/InDesign) has been tested
  through this tool yet, only synthetic fixtures.
