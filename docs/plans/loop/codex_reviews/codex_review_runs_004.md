# Codex review round 4: RUN_S_FLAG_ON_AUDIT

## Verdict

NEEDS_FIXES

## Summary

v4 correctly fixes the round-3 blocker. S-1/S-3 now assert that B's review completion advances CSD without double-advancing TWI, and the expected-red result contract is clear.

One remaining coverage gap matters for the actual CS behavior: after a student completes the Day-D review in class B, Run S must re-enter class A and prove the original class is not left with stale Day-D progress/phase. Without that, the suite can green while the student still sees inconsistent behavior depending on which class they open next.

## Findings

### RS4-1 — HIGH — S-1 must assert post-B-review convergence when re-entering A

S-1 currently proves the B-side outcome after the cross-class review completion:

- before B review completion: `B_L csd=1, twi=2pA`;
- after B review completion: `B_L csd=2, twi=2pA`;
- zero B `new` attempts and one B `review` completion.

That is necessary, but not sufficient for the stated Run S purpose: student-owned/list-scoped progress across simultaneous classes.

The current code has two relevant behaviors:

- `getRecentAttemptsForClassList` is list-scoped under the flag (`db.js:3119-3128`), so phase detection can see attempts from both classes.
- `getReviewForDay`, however, pairs reviews to the anchor's class (`db.js:3407-3416`), and `progressService` derives anchor-day CSD from that paired review (`progressService.js:160-178`).

That means this sequence is not automatically covered by the B-only oracle:

1. A owns the passed Day-2 new anchor.
2. B completes the Day-2 review.
3. A is opened again.

A broken or partial implementation can leave `class_progress/A_L` at `csd=1,twi=2pA` while B is `csd=2,twi=2pA`, or show an inconsistent UI because list-scoped phase detection sees B's review while A's stored progress still says Day 2 is pending. That is exactly the kind of erratic same-student/same-list behavior Run S is meant to catch.

Required plan change:

- Extend S-1 after successful B review completion:
  1. switch back to A using visible UI only;
  2. enter/reload the same list;
  3. assert A does not show Day-D review pending or force another review/new-word retake;
  4. assert the authoritative doc-layer state expected by the product goal.

For a true student-living progress model, the expected state should be explicit and should converge across both visible classes:

- `A_L currentStudyDay == 2` and `B_L currentStudyDay == 2`;
- both keep `totalWordsIntroduced == 2pA`;
- no additional `new` attempts and no duplicate review attempts.

If the intended interim design is instead “B advances locally, A only sees the B review through list-scoped attempt history but its class_progress doc remains at csd=1,” then the plan must state that as a known limitation. But that would not certify the stronger goal of one live student/list position across simultaneous classes.

### RS4-2 — MEDIUM — #9 fix scope should mention cross-class completion convergence, not only B-side completion

`NEED_TO_FIX #9` now correctly covers two coupled failures:

1. completion-gate lookup mismatch;
2. TWI double-advance from `sessionConfig.newWordCount`.

Add a third explicit acceptance point: after a cross-class review completion, subsequent entry from either class on that list must resolve to the same completed-day state. Otherwise the fix can make B look correct while A remains stale and user-visible behavior stays class-dependent.

This can be phrased as an oracle requirement even if the eventual code fix implements it through the current class_progress docs rather than a true list_progress doc.

## Resolved from round 3

- RS3-1 is resolved: the TWI-invariance assertion is now explicit in S-1/S-3.
- RS3-2 is resolved: expected-red is clearly not certification, and FINAL PASS requires all gating cases to pass after #9 ships.
- The v4 S-1/S-3 expected-red posture is correct.

## Answers to Claude's questions

1. Is the plan now GO?
   Not yet. Add the post-B-review re-entry-to-A assertion. This is the remaining same-student/same-list class-switching path that can still false-green.

2. Is TWI-invariance plus the three-state verdict contract sufficient to prevent partial-fix false-green?
   It prevents the specific partial-fix from round 3. It does not prevent a partial fix that only makes B correct while A remains stale.

3. Any other flag-ON path where shipped behavior diverges from §5.1 that S-1..S-9 do not cover?
   Yes: cross-class review completion followed by opening the original anchor class. Because anchor review pairing is class-scoped while recent-attempt phase detection is list-scoped, A-after-B is a distinct state that needs an oracle.
