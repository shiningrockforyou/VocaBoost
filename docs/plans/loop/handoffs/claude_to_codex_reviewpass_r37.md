# WSL → Codex round 37: resolve the #9-resume exemption (adversarial)

Narrow follow-up on the Review-Pass-Threshold plan (`D3.5_WORKITEM_review_pass_threshold.md` §6, §8-D). David pushed
back on one of your r36 recommendations and I agree with him — pressure-test us.

## The disagreement
In r36 you recommended exempting `reviewOnlyReasons.reviewStudyResume` (#9-resume) days from the review-pass gate
("if the product decision is that #9-resume should finish on review completion without being trapped").

**David's instinct + my analysis: do NOT exempt resume days.** Reasoning:
1. Each exemption is an extra branch = more breakage surface + a silent "teacher thinks gated, actually isn't" hole.
2. **Resume is not a dead-end like list-end.** The list-end exemption is *load-bearing* — at list-end there are no new
   words left, so gating the final review could freeze a weak student forever with the list unable to complete. A
   resume day still has review content to master and a clear forward path ("pass the review"), so "retake until pass"
   is normal behavior, not a trap.
3. Applying the gate wherever a real review test exists is the simplest, most faithful rule for "score X% to move on."

## Your job (try to BREAK "don't exempt resume days")
Give a **concrete** scenario where NOT exempting a #9-resume day either (a) traps a student with no forward path, or
(b) corrupts progress/state (e.g. a cross-class LIST_SCOPED_RECON resume where the new-word anchor lives in class A but
the review + threshold live in class B — does the retake loop record/resolve correctly? does `resolveListProgress`
or the throttle mishandle a held resume day?), or (c) interacts badly with NEED_TO_FIX #11 (the "review never recorded
→ intervention never drops → permanent stuck" hazard the reviewOnlyDay short-circuit was built to avoid).

Trace `studyService.js` #9-resume (`startPhase===REVIEW_STUDY`, `getNewWordAttemptForDay` cross-class) +
`foundation.js` `reviewStudyResume` handling. If you find a real break → exemption justified, specify it. If you
can't → concede "don't exempt" and note only the empty/all-mastered no-score case still needs a no-op.

## Hand back
Write `docs/plans/loop/codex_reviews/codex_reviewpass_r37.md`. Set baton `turnOwner=claude round=37
taskId=REVIEW_PASS_THRESHOLD codexStatus=review-written codexDecision=DONE updatedBy=codex revision=145
codexReviewRepoPath=docs/plans/loop/codex_reviews/codex_reviewpass_r37.md`.

(Grader Item B is implemented — prompt hardened + `scripts/grader-regression.mjs` fixture; deploy gated on the fixture
passing. No Codex action needed there unless you spot a fixture gap.)
