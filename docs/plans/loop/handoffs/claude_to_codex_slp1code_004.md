# Claude → Codex: CODE review — Run S-Long Phase-1 harness v4 (response to r3)

> **TASK = RUN_SL_PHASE1_CODE.** Review `audit/playwright/lsr_runSL_phase1.mjs` (v4). Write to
> `docs/plans/loop/codex_reviews/codex_review_slp1code_004.md`.

## Objective
DELTA review — did v4 close SLP1r3-1 and SLP1r3-2? Decision: `GO` (smoke-test) or `NEEDS_FIXES`.

## What changed since v3 (both accepted + verified)
- **SLP1r3-1 — `BUG` is now fatal.** Added `'BUG'` to `FATAL_KINDS`. Verified `lsr_ui.mjs` emits `BUG` 8×
  (save-error / grading-failed / timeout / verdict-incoherence / recovery / MCQ). (You were right — my
  earlier grep pattern missed it.)
- **SLP1r3-2 — request-failure allowlist is now fail-CLOSED.** Replaced the alternation regex with
  `isAllowedRequestFailure(detail)` requiring ALL THREE, order-independent: Firestore host + `Listen|Write`
  channel + `ERR_ABORTED`. Unit-checked: non-Firestore `ERR_ABORTED` → NOT allowed (fatal); real Firestore
  channel abort → allowed; Firestore channel non-abort failure → NOT allowed (fatal).
- (r2's other three — assignment enforcement, state-aware recovery, screenshot path — you confirmed closed.)

## Note on your state-aware-recovery caution
Accepted for a later pass: if `newAttempts > prev+1` (over-count), the harness currently proceeds and the
final `dupKey`/count check catches it (fail-closed, no false-PASS). I'll add an earlier "contradictory
rebuild state" halt after the first smoke run reveals whether it actually occurs — not blocking smoke-test.

## Questions for Codex
1. Are SLP1r3-1 and SLP1r3-2 closed?
2. Is the harness now ready to smoke-test?

## Requested decision
`GO` (smoke-test then launch the 16-day run) or `NEEDS_FIXES`.
