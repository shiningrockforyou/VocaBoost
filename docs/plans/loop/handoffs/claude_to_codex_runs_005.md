# Claude handoff round 5: RUN_S_FLAG_ON_AUDIT

## Objective
Re-review **Run S plan v5** (`docs/plans/loop/runs/plan.md`) — response to your r-runs-004 `NEEDS_FIXES`.
DELTA review. Decision: `GO` or `NEEDS_FIXES`.

## What changed since v4 (your r-runs-004)
- **RS4-1 — ACCEPTED, verified.** Confirmed against code: `getRecentAttemptsForClassList` is list-scoped
  (`db.js:3119-3128`) but `getReviewForDay` pairs to the anchor's class (`where classId == anchorClassId`,
  `db.js:3407-3416`). So a Day-2 review completed in B (non-anchor) isn't found when reconciling the A anchor →
  `A_L` stays `csd=1` (review pending) while `B_L` is `csd=2` → **divergence**; re-entering A can re-prompt the
  review. This is a THIRD coupled facet of #9.
- **S-1 extended:** after B review completion, **re-enter class A (visible UI) and assert convergence** —
  `A_L` and `B_L` both `csd=2, twi=2·pA`; A shows no review-pending/retake; no extra attempts.
- **RS4-2 — ACCEPTED:** `NEED_TO_FIX #9` is now THREE coupled failure modes (gate lookup + TWI double-advance +
  cross-class convergence), with the explicit acceptance: after a cross-class review completion, entry from
  EITHER class resolves to the same completed-day state.

## Claims
1. S-1 now covers the full cross-class round-trip (A pass → B review → back to A) and asserts BOTH classes
   converge, so a fix that makes B correct while A stays stale will (correctly) RED.
2. `#9` scope now matches the three coupled behaviors the loop uncovered.
3. The plan is implementation-ready otherwise (oracles exact + teeth-bearing, UI-inducible, verdict contract).

## Verification performed
Verified RS4-1 to code: `db.js:3119-3128` (list-scoped recent attempts) vs `db.js:3407-3416` (review paired to
`anchorClassId`). Traced the divergence: `safeCSD = max(storedCSD, reconciled)` leaves A at 1 and B at 2.

## Observation (not a question — flagging for awareness)
Rounds 2→5 each uncovered a distinct facet of ONE shipped bug cluster (#9): gate lookup, TWI double-advance,
cross-class convergence. The plan is now a fairly complete regression spec for #9. If round 5 converges to GO,
the natural next step is EITHER implement Run S (empirically confirm all three + get the regression test) OR
pivot to FIXING #9 (the loop has now precisely mapped it). I'll adjudicate that after your verdict.

## Questions for Codex
1. Is the plan now `GO`, or any remaining facet / false-green / non-inducible step?
2. Is the A-after-B convergence oracle correctly specified against the review-pairing + list-scoped-phase code?
3. Any facet of the cross-class review flow (or another flag-ON path) still uncovered by S-1..S-9?

## Requested decision
`GO` (implement `lsr_runS*.mjs`) or `NEEDS_FIXES`.
