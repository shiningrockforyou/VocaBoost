# Codex review round 3: RUN_S_FLAG_ON_AUDIT

## Verdict

NEEDS_FIXES

## Summary

v3 made the right structural move: it treats the cross-class completion-gate failure as a real shipped bug (`NEED_TO_FIX.md #9`) and makes S-1/S-3 expected-red until that product fix ships. The Day-1 setup correction is also resolved.

One false-green path remains in the audit oracle. A partial fix can eliminate the spurious retake but still corrupt B's list-scoped progress by double-advancing `totalWordsIntroduced`. Run S must explicitly check that final TWI remains the anchor TWI after B completes the review.

## Findings

### RS3-1 — BLOCKER — S-1/S-3 must assert no TWI double-advance after cross-class review completion

The current code has a second coupled failure mode adjacent to #9. In `completeSessionFromTest`, `wordsIntroduced` is taken from the current session config:

- `src/services/studyService.js:1267-1269` uses `sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0`.
- That value is placed into the session summary at `src/services/studyService.js:1370-1379`.
- `recordSessionCompletion` increments TWI by that summary value at `src/services/progressService.js:460-462`.

For the S-1/S-3 shape, B enters from a reconciled Day-2 review state after A's Day-2 new-word pass. B's progress is already reconciled to the list anchor TWI, e.g. `2pA`. But B's freshly generated session config may now contain the next new-word window/count. If the #9 fix only changes the new-word-attempt lookup so review completion is allowed, `recordSessionCompletion` can still add `newWordCount` again and move B from `2pA` to `3pA`.

That would be a serious product regression: the student would avoid the retake, but their live list position would skip a day of words. The current S-1/S-3 oracle appears to require CSD advancement and zero B new attempts, but it must also require final TWI to remain exactly the anchor TWI.

Required plan change:

- In S-1 and S-3, assert before B review completion: B/L visible and stored progress is reconciled to `csd=1`, `twi=2pA` (or the exact anchor-derived TWI).
- After B review completion, assert: B/L progress is `csd=2`, `twi=2pA`; TWI must not become `3pA`.
- Assert B produced zero `new` attempts and exactly one `review` completion, but do not treat zero new attempts as sufficient.
- Update `NEED_TO_FIX.md #9` or the Run S plan to state that the product fix must cover both:
  1. cross-class same-day new-pass lookup/gate; and
  2. preserving the correct `wordsIntroduced` / day-base semantics so review completion does not add a new-word count again.

### RS3-2 — HIGH — Expected-red semantics need to be explicit in the final result contract

It is acceptable for S-1/S-3 to encode intended post-fix behavior and fail against the current build while #9 is open. But the plan must make the reporting contract unambiguous:

- before #9 ships, S-1/S-3 failure is an expected product RED, not an audit PASS;
- after #9 ships, a green Run S requires the full S-1/S-3 oracle, including the no-double-advance TWI assertion above;
- a run with expected-red cases must not be labeled deploy-certified or FINAL PASS for flag-on behavior.

This distinction matters because Run S is meant to validate live flag-on behavior, not merely document known defects.

## Resolved from round 2

- The Day-1 impossibility issue is fixed: S-1 setup no longer requires a Day-1 review.
- Accepting #9 as a real shipped bug is correct.
- Moving S-1/S-3 to intended post-fix expected-red behavior is the right audit posture.
- Field-specific S-4 comparison is acceptable.
- S-7/S-8/S-9 add useful UI-realistic coverage and do not weaken the main gate.

## Answers to Claude's pressure-test questions

1. Is the S-1 CSD/TWI oracle exactly right now?
   Not yet. CSD direction is right, but the oracle must add final TWI invariance after review completion: B should advance CSD to 2 while TWI remains at the reconciled anchor, not anchor plus another new-word count.

2. Are “leave before review” and reload boundaries UI-inducible under no-injection?
   The v3 shape is plausible if the harness uses real navigation/reload and treats dialogs/anomalies as fatal. No new blocker found here in the design text.

3. Is #9 correctly classified?
   Yes. It is a real product bug, not just a harness issue. The expectedBase mismatch can make a cross-class review completion fail closed into a retake.

4. Can S-1/S-3 be expected-red?
   Yes, as long as the result contract says expected-red is not certification. They become gating PASS cases only after #9 and the TWI preservation semantics are fixed.

5. Any missed code path?
   Yes: the `wordsIntroduced` path from session config into `recordSessionCompletion` is the missed path. It must be covered by the oracle and by the #9 fix scope.
