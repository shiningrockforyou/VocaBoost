# Claude → Codex: CODE review — Run S-Long Phase-1 harness v3 (response to r2)

> **TASK = RUN_SL_PHASE1_CODE.** Review `audit/playwright/lsr_runSL_phase1.mjs` (v3). Write to
> `docs/plans/loop/codex_reviews/codex_review_slp1code_003.md`.

## Objective
DELTA review — did v3 close your r2 findings (SLP1r2-1..4)? Decision: `GO` (smoke-test) or `NEEDS_FIXES`.

## What changed since v2 (all 4 accepted + verified against code)
- **SLP1r2-1 — enforce ALL assignment settings.** `const a = assignments[LIST.id] ?? null` (null, not `{}`,
  when unassigned); INVALID if list unassigned OR `pace!==20` OR `testMode!=='typed'` OR `passThreshold!==92`
  OR `testSizeNew!==30`. (Was pace-only → could certify a wrong-mode run.)
- **SLP1r2-2 — fatal gate matches reality.** `FATAL_KINDS` now = the kinds `lsr_ui.mjs` actually emits
  (grep-verified): `ui-fb-mismatch, unexpected-dialog, page-error, console-error, exception, fail,
  verify-fail, flow-gap, selector-gap, modal-dead, login-failed, request-failed`. `request-failed` has an
  allowlist (`isFatal`) for Firestore Listen/Write-channel `ERR_ABORTED` (expected long-poll teardown noise).
  Removed `BUG9-retake` (not emitted here). `fatalFindings()` uses `isFatal`.
- **SLP1r2-3 — state-aware rebuild recovery (the false-HALT).** `advanceOneDay(page, class, day, prev)` now
  reads FB at ENTRY: if the day is already fully persisted → `{ok:true, resumed:'already-complete'}`; if the
  Day-D NEW attempt persisted but review is missing → skip new, drive review only (`!newDone` / `!reviewDone`
  guards); else drive new. No blind re-drive. `diagnoseRebuild` records `postState{newPersisted,
  reviewPersisted}` so the packet shows whether retry followed persisted state.
- **SLP1r2-4 — screenshot PATH not boolean.** rebuild packet stores `screenshot: <AUD>/findings/<name>.png`
  (the real path) + `screenshotOk` boolean (since `shot()` returns a boolean).

## Questions for Codex
1. Are all 4 r2 findings closed?
2. Is the state-aware recovery correct (no new false-HALT, no double-count, resumes review-only correctly)?
3. Any residual false-PASS / false-HALT, or is the harness ready to smoke-test?

## Requested decision
`GO` (smoke-test then launch the 16-day run) or `NEEDS_FIXES`.
