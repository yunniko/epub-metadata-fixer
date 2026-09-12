# D006 · /security-review cannot run before the first push; manual equivalent done
Date: 2026-09-08 · Goal: G-001 · Status: active
Context: The skill diffs against `origin/HEAD`, absent before `init-repo.ps1` creates the remote.
Decision: Manual review (grep for eval/child_process/exec/new Function/dangerouslySetInnerHTML/process.env): fully client-side, only the shared `lib/json-ld.tsx` uses `dangerouslySetInnerHTML` (escaped), env reads are public config, user EPUB text renders through JSX. No findings.
Rejected: treating "skill didn't run" as "passed"; pushing first.
Consequence: Tooling gap flagged: the skill should tolerate a remote-less repo, or the runbook should add the remote before the review.
Evidence: `svc-lab/HANDOVER.md`.
