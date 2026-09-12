# D005 · Domain review found and fixed six real bugs before shipping
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Mandatory domain gate.
Decision: Fixed: `buildFixedOpf` edited the first `dc:identifier` in document order instead of the one `unique-identifier` points at (could destroy an ISBN); no guard for font obfuscation keyed on the identifier (fixer now detects an `encryption.xml` under META-INF and disables that field with a warning); single-quoted-attribute regex holes; `refines`-unaware `dcterms:modified`; Kobo size 2 MB → 5 MB; KDP ratio demoted from hard fail to `warnings`. All covered by regression tests.
Rejected: logging for later.
Consequence: `PlatformCheckResult` separates `reasons` (gate `pass`) from `warnings`.
Evidence: `docs/domain-reference.md`; `tests/unit/`.
