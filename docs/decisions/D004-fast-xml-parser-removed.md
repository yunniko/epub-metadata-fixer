# D004 · `fast-xml-parser` added during design, removed before shipping
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: D002's regex approach made a generic XML library unnecessary.
Decision: Removed the unused dependency (no dead dependencies).
Rejected: shipping it unused.
Consequence: —
Evidence: `package.json`.
