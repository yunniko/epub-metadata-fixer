# D003 · Cover-image requirements aggregated from secondary guides, disclosed in the UI
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: Same WebFetch limitation; platform help pages not directly readable.
Decision: KDP ≥625×1000 px, ≥1.6:1 (recommendation, not hard fail — D005), JPEG/TIFF, ≤10000 px, ≤50 MB; Kobo ≥1400 px short side, ≤5 MB (corrected by D005); Apple Books ≥1400 px. Each `PlatformCheckResult.sourceNote` states this is secondary-source aggregation.
Rejected: presenting the figures as primary.
Consequence: Re-verify against each platform's current help page when WebFetch works.
Evidence: `lib/cover-requirements.ts`.
