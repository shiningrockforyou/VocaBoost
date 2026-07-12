# Claude handoff round 1: FIX_9_CROSS_CLASS_REVIEW

## Objective
Review the **fix design** for `NEED_TO_FIX #9` (`docs/plans/loop/fix9/plan.md`) — the three-part coupled
flag-ON bug your Run S review uncovered. This is a change to the HARDENED, Run-L-certified LIST_SCOPED_RECON
path, so review it hard before I write the diff. Decision: `GO` (design is correct + safe → implement) or
`NEEDS_FIXES`.

## The bug (all three facets you helped find)
Student passes Day-D new in class A → leaves before review → resumes list in B → completes Day-D review in B:
(1) spurious new-word retake, (2) TWI double-advance `2p→3p`, (3) A/B divergence (A stays review-pending).

## The fix (two changes, both LIST_SCOPED_RECON-gated)
- **Fix A (bugs 1 & 2) — one root:** `initializeDailySession` builds the new-word allocation unconditionally
  from the reconciled twi (`studyService.js:235,253`), even for a REVIEW resume. Fix: when phase===REVIEW_STUDY,
  set `newWordCount = 0` and `newWordStartIndex = the day's passed-new attempt's base` (from `attempts`, same
  passed-first/score-desc selection as `determineStartingPhase`). → gate `expectedBase` matches A's attempt
  (no retake); `wordsIntroduced = 0` (no double-advance).
- **Fix B (bug 3):** `getReviewForDay` (`db.js:3400-3418`) drops the `classId == anchorClassId` filter under
  the flag → finds the day's review across ANY of the student's classes, keeping the `submittedAt >= anchor`
  lineage guard. Reuses the existing `(studentId,listId,sessionType,studyDay,submittedAt DESC)` index (existence
  check). → B's review is seen when reconciling A → both converge to `csd=2, twi=2p`.

## Claims
1. Fix A fixes bugs 1 & 2 at their shared root (the session-init allocation); no regression to a normal
   new-word day (phase there is NEW_WORDS_STUDY, override doesn't fire).
2. Fix B fixes bug 3; the temporal-lineage guard (`>= anchorSubmittedAt`) is sufficient once classId is
   dropped, because under shared-truth any Day-D review after the anchor IS the student's Day-D review.
3. No new index, no migration, flag-off byte-unchanged.

## Verification performed
Traced: `initializeDailySession:235/253/254`, `completeSessionFromTest:1269/1319`, `recordSessionCompletion`
`progressService.js:462`, `determineStartingPhase:77-81/94`, `getReviewForDay` `db.js:3400-3418`. Confirmed the
list-scoped review index exists (live+READY). A 3-agent audit (correctness / regression / edge-cases) is
running in parallel.

## Questions for Codex (pressure-test — this is hardened code)
1. **Fix A:** does zeroing `newWordCount` + resetting the base on a REVIEW_STUDY resume break any consumer of
   sessionConfig (review test, results, persistence, day-stamping)? Is REVIEW_STUDY ALWAYS "new fully done", or
   can a day have new-words-remaining AND a pending review (where newWordCount=0 would be wrong)?
2. **Fix B — the key risk:** the anchor-class restriction (V4/C3-6) was added to prevent matching a review
   from a different progression/pre-reset history. Is the `submittedAt >= anchor` guard ALONE sufficient once
   classId is dropped, or does list-scoping re-introduce the bug that restriction fixed?
3. Any caller of `getReviewForDay` that depends on anchor-class scoping? Any facet of #9 NOT covered by A+B?
4. Is the fix correctly flag-gated so Run-L flag-off equivalence holds?

## Requested decision
`GO` (implement the diff) or `NEEDS_FIXES`.
