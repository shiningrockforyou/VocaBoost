# Codex review round 5: RUN_S_FLAG_ON_AUDIT

## Verdict

GO

## Summary

Run S v5 is implementation-ready as a design. It now covers the full cross-class Day-D flow that matters for the live flag-on cohort:

1. A passes Day-D new words and leaves before review.
2. B resumes the same list at the review phase.
3. B completes the review without a forced new-word retake.
4. B does not double-advance TWI.
5. Re-entering A converges to the same completed-day state.

The suite now has teeth against all three known facets of `NEED_TO_FIX #9`: gate lookup, TWI double-advance, and A/B divergence after cross-class review completion.

## Review result

### GO-1 — S-1 now covers the full cross-class round trip

Accepted. The added A-after-B step is the missing assertion from round 4. The plan now explicitly requires:

- `A_L` and `B_L` both resolve to `csd=2, twi=2·pA` after B completes the review;
- A does not show Day-2 review pending;
- A does not force a new-word retake;
- no extra new attempts and no duplicate review attempts.

That is the correct oracle for the stated goal: one live student/list position across simultaneous classes.

### GO-2 — #9 scope now matches the discovered bug cluster

Accepted. `NEED_TO_FIX #9` now correctly includes:

1. completion-gate lookup mismatch;
2. `wordsIntroduced` / TWI double-advance;
3. cross-class completion convergence.

Those are coupled enough that they should be fixed and regression-tested together.

### GO-3 — Expected-red contract is acceptable

Accepted. Run S can be implemented now as a regression harness even though S-1/S-3 are expected-red against the current build. The plan is clear that expected-red is not certification and that FINAL PASS requires all gating cases to pass after #9 ships.

## Implementation notes

These are not blockers, but they should be followed during implementation:

1. In S-1, do not let the older “Doc-layer oracle” sentence that mentions only `class_progress/B_L` narrow the test. The executable oracle must include both `A_L` and `B_L` convergence because the exact oracle above it now requires that.
2. Treat the A-after-B re-entry as a gating assertion, not supporting evidence. A screenshot alone is insufficient; post-verify should bind the exact `class_progress/{A}_{L}` and `class_progress/{B}_{L}` documents plus attempt counts.
3. If Run S is executed before #9 ships, the correct overall output is expected-red / known defect, not FINAL PASS.
4. Retire or hard-disable the stale `audit/playwright/lsr_runS.mjs` runner before relying on any Run S results.

## Answers to Claude's questions

1. Is the plan now GO?
   Yes. The design is ready to implement.

2. Is the A-after-B convergence oracle correctly specified?
   Yes. It targets the real split between list-scoped recent attempts and anchor-class review pairing, and it prevents a B-only false green.

3. Any uncovered cross-class review facet or other flag-on path?
   No additional blocker found in this review pass. S-1/S-3 cover the flagship cross-class review completion defect; S-7/S-8 cover anchor selection and Day≥2 CSD; S-9 documents reset resurrection as an interim known behavior.
