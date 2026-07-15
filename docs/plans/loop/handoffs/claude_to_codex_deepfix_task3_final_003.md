# Claude → Codex: DEEPFIX Task 3 — FINAL review round 3 (delta)

> **TASK = DEEPFIX_TASK3_FINAL, round 3.** Round 2 = NEEDS_FIXES (FINAL2-1: the F-4 evidence gate was
> SERVER-only — the client treated a refused completion as success). Folded + orchestrator H1-verified.
> **Re-review ONLY the FINAL2-1 delta.** Everything else you already cleared in round 2 (F-1..F-13). Write
> `/out/reviews/codex_deepfix_task3_final_003.md`, VERDICT (+ CONVERGED-OK if clean), flip → claude.

## The fix — client no_evidence handling wired end-to-end (4 files, flag-ON only, byte-equiv off)
- `src/services/studyService.js`: `recordSessionCompletionViaServer` now has an explicit `if (data.status ===
  'no_evidence')` branch BEFORE the completed path → returns `{sessionId:null, progress:null,
  completionNotApplied:true, reason:'no_evidence'}`, writes NO `users/{uid}/sessions` record; plus a FAIL-CLOSED
  guard (`status != null && status !== 'completed'` → same blocking sentinel). Docstring (:910-925) updated.
- `completeSessionFromTest` propagates `completionNotApplied` BEFORE `graduateSegmentWords` (mirrors the
  `dayGuardRejected` block) → no graduation, no success.
- `TypedTest.jsx` + `MCQTest.jsx`: on `completionNotApplied` → same blocking UX as `requiresSessionRebuild`
  (setGradingError/setSubmitError + early return, never a results screen).
- `DailySessionFlow.jsx` (`completeSession`, after :1529): `if (result?.completionNotApplied)` → block before
  `graduateSegmentWords` + `PHASES.COMPLETE`, setError + early-return (closes the parallel session-flow instance).

## Orchestrator pre-checks (H1)
- DSF guard is before graduate/complete; M-STATIC baseline CLEAN (tree intact); FINAL2-1 touches ONLY the 4 client
  files. Byte-equivalence: `completionNotApplied` is produced only on the `SERVER_PROGRESS_WRITE` path (dormant) →
  flag-off ⇒ all new guards unreachable ⇒ legacy client flow byte-identical. eslint delta 0 per file; patch
  round-trip cmp-clean.
- **Flagged separate (NOT fixed, out of deepfix byte-equiv scope):** DSF `completeSession` also ignores
  `dayGuardRejected` (set live under `LIST_SCOPED_RECON` in prod) — a PRE-EXISTING false-success on a rare
  stale/duplicate completion. Documented in FINAL_FOLD_A_notes.md for a dedicated non-byte-equiv fix (David's call).

## Re-review
Does the client now BLOCK an evidence-free (`no_evidence`) completion on every path (completeSessionFromTest →
Typed/MCQ, and DSF completeSession) — no graduation, no success screen — while still allowing every LEGITIMATE
completion (`completed` status)? Is the fail-closed unknown-status handling correct? Flag-off byte-equivalent?
Convergence = 0 blockers/0 high → **FINAL REVIEW CONVERGED → implementation signed off** (pending Task-6 run).
