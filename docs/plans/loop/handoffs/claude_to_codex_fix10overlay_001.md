# Claude → Codex: HARNESS review — #10 regression overlay (task FIX10_OVERLAY_CODE, round 1)

> **Task FIX10_OVERLAY_CODE, slug `fix10`, round 1.** Review the AUDIT HARNESS
> **`audit/playwright/lsr_fix10_overlay.mjs`** against the plan §8 spec (`docs/plans/loop/fix10/plan.md`)
> and the real app data model it asserts on. This is TEST-HARNESS code (validates the already-converged
> #10 fix; it does not touch app `src/`). Write your review to
> `docs/plans/loop/codex_reviews/codex_review_fix10overlay_001.md`, end with the machine `VERDICT` line
> (+ `CONVERGED-OK` if 0 blocker/high), flip `turnOwner → claude`. A 3-agent fable audit runs IN PARALLEL.

## What it is
A Playwright overlay that PROVES/GUARDS the #10 fix. #10 = flag-ON self-race where the session-final
completion's pre-completion snapshot (`getOrCreateClassProgress`) reconciled+wrote an advanced CSD, so the
following `completeSessionFromTest` was stale-blocked by the day-guard → "session refreshed" rebuild. The
CRUX: the BROKEN build ALSO ends a day at CSD+1/TWI+pace (reconciliation writes the same finals) — so the
oracle must DISCRIMINATE on `recentSessions` / the `sessions` doc / `session_states` phase / the logs.

## Design (plan §8, implemented)
- **4-cell matrix** = {Day-1 new-final, Day-2+ review-final} × {typed→`TypedTest.jsx`, mcq→`MCQTest.jsx`}.
  Each cell = its own PRISTINE student (2 share the typed class, 2 the mcq class; all reads are
  per-(user,class,list)). Day-2 cells drive Day-1 + Day-2-new as UNMEASURED setup, then MEASURE the
  review-final completion.
- **6 discriminating asserts** per cell (`measureCompletion`): d1 UI no-rebuild+results; d2 recentSessions
  +1 entry with day===N; d3 exactly one new `users/{uid}/sessions` doc (dayNumber===N); d4 session_states
  phase==='complete'; d5 ZERO new `day_guard_rejected_session_cleared`; d6 ZERO new `csd_twi_reconciled` in
  the TIGHT window.
- **Tight window boundary (your R2 advisory):** `before` is captured AFTER the session-entry reach
  (`driveReviewToTest`/`driveNewWordsToTest`) and BEFORE the submit; `after` at `settle`. So the legitimate
  session-entry reconcile is EXCLUDED and only the broken build's completion-block reconcile is INCLUDED.
- **Modes:** `FIX10_EXPECT=green` (post-fix, all cells green) | `red` (PRE-fix, #10 signature N≥2).
- **Reused Phase-1 guards:** BUILD_ID required, per-class EXACT assignment verify, per-cell pristine
  baseline, fatal-findings gate (`isFatal`/`FATAL_KINDS`), fail-closed request-failure allowlist, settle.
- **Negative control** (genuine different-day stale still blocked → RECOVERABLE rebuild): GATED
  (`FIX10_NEGCTL`) + explicitly NOT-implemented (two-context UI stale replay pending; a Firebase-seeded
  variant needs owner sign-off per the read-only rule). Surfaced, not silently missing.

## App data model I verified it against (please re-check)
- `recordSessionCompletion` (`studyService.js:578-678`): SUCCESS → recentSessions append
  (`progressService.js:454-475`) + ONE `users/{uid}/sessions` doc (`:659-672`, has classId/listId/dayNumber)
  + session_states phase COMPLETE. REJECT path (`:624-655`) → none of those + `day_guard_rejected_session_cleared`.
- `csd_twi_reconciled` logged only in `getOrCreateClassProgress` (`progressService.js:248-271`).
- session_states doc `users/{uid}/session_states/{classId}_{listId}`, COMPLETE=`'complete'`
  (`sessionService.js:26-32`, `getSessionDocId`). recentSessions entry has `.day`
  (`createSessionSummary`, `studyTypes.js:266`).

## Please verify (trace to real file:line)
1. **Oracle correctness** — do the 6 discriminators evaluate TRUE for a fixed completion and FALSE for the
   broken one (both Day-1 and Day-2+)? Is `green`/`redSignature` right?
2. **Window boundary** — is opening `before` after the reach the correct tight boundary (excludes
   session-entry reconcile, includes the completion-block one)? Any reconcile source inside the window on a
   CORRECT build that would false-trip d6?
3. **Fail-closed** — can it false-GREEN (a broken build) or false-RED (a fixed build)? `logCount` null
   handling; verdict gating on unmeasured cells; the fatal-findings gate; the "+1" exactness under any
   retry.
4. **Coverage** — all 4 code paths genuinely exercised; Day-2 measured completion is the review-final;
   negative-control gap acceptably surfaced.
5. Anything the 3 agents or I missed; any data-model claim now false.

## Requested decision
`GO` / `CONVERGED-OK` (harness sound + fail-closed) or `NEEDS_FIXES`. Nits/medium don't block.
