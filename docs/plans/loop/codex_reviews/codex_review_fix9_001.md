# Codex review round 1: FIX_9_CROSS_CLASS_REVIEW

## Verdict

NEEDS_FIXES

## Summary

The diagnosis is right: #9 is a three-facet bug cluster, and Fix A is pointing at the correct shared root for the retake + TWI double-advance. But the proposed Fix B is not safe as written.

Dropping `classId == anchorClassId` while keeping only `studyDay` and `submittedAt >= anchorSubmittedAt` reintroduces the cross-progression pairing bug the anchor-class restriction was added to prevent. `studyDay` is a session counter, not a position identity. Across classes with different paces or pre-flag histories, a Day-D review in another class can be later than the anchor and still not be the review for that anchor's word position.

The fix needs position lineage for review pairing. Fix A must preserve that lineage on review attempts; as currently sketched, `newWordCount=0` makes `newWordEndIndex = nwStart - 1`, which destroys the anchor range and prevents a safe class-dropped review query.

## Findings

### F9-1 — BLOCKER — Fix B needs position lineage; `studyDay + submittedAt` is not sufficient after dropping classId

Current plan:

```js
where('studentId','==',userId),
where('listId','==',listId),
where('sessionType','==','review'),
where('studyDay','==',studyDay),
where('submittedAt','>=',pairing.anchorSubmittedAt),
orderBy('submittedAt','desc'),
limit(1)
```

This can pair the anchor with a review from a different progression. The reason is exactly the old V4/C3-6 risk: `studyDay` does not uniquely identify the same word-position day across mixed class histories or different paces. A later Day-D review in class B may be a legitimate B progression review, but not the review that completes A's anchor range.

Concrete failure shape:

1. Class A and B share list L but have different paces or inherited pre-flag progress.
2. A's passed-new anchor is studyDay D at position range A_base..A_end.
3. B has or creates a later review attempt with `studyDay === D` and `submittedAt >= A_anchor.submittedAt`, but that B review corresponds to a different position range.
4. The proposed class-dropped query returns B's review and marks A's anchor day complete.

That is a false advancement. It is the same category of bug the anchor-class filter avoided.

Required design change:

- A cross-class review may count for the anchor only if it is position-consistent with the anchor, not merely same `studyDay` and later time.
- The query/function should verify review lineage against the anchor's `newWordStartIndex` and `newWordEndIndex`, or an explicit `anchorAttemptId` if you choose to add one.
- If avoiding a new Firestore index, use the existing student/list/sessionType/studyDay/submittedAt query as a candidate stream and client-filter/paginate for matching position lineage. Do not `limit(1)` and accept the newest unverified review.

### F9-2 — BLOCKER — Fix A must not set `newWordEndIndex = nwStart - 1` for review resumes

The plan says:

```js
nwCount = 0;
nwStart = dayNewPass.newWordStartIndex;
// newWordEndIndex: nwStart + nwCount - 1
```

That makes the review-resume session config carry an empty range (`p..p-1`). It fixes `wordsIntroduced` and the completion-gate start-base, but it breaks the only practical way to make Fix B safe: storing/verifying the anchor position range on the subsequent review attempt.

Review attempts currently persist `newWordStartIndex` and `newWordEndIndex` from `sessionContext` (`db.js:1229-1230`, `1393-1394`; server-write paths forward the same fields from `TypedTest.jsx` / `MCQTest.jsx`). If the B review attempt stores `newWordEndIndex = p-1`, then later reconciliation cannot prove that B's review completed A's anchor range (`p..2p-1`).

Required design change:

- Split “introduced now” from “day anchor range.”
- On `REVIEW_STUDY` resume, set:
  - `newWordCount = 0` for `wordsIntroduced` / no TWI increment;
  - `newWordStartIndex = dayNewPass.newWordStartIndex` for the completion gate;
  - `newWordEndIndex = dayNewPass.newWordEndIndex` to preserve the anchor day range on the review attempt.
- If the naming feels semantically overloaded, document it explicitly: for review resumes, `newWordStartIndex/newWordEndIndex` identify the day's passed-new anchor range, while `newWordCount=0` means no new words are introduced by this review completion.

### F9-3 — HIGH — `getReviewForDay` pairing input must include anchor position fields

`progressService.getOrCreateClassProgress` currently passes only:

```js
{ anchorClassId: anchorTest.classId, anchorSubmittedAt: anchorTest.submittedAt }
```

A safe class-dropped implementation also needs anchor positional lineage:

- `anchorNewWordStartIndex: anchorTest.newWordStartIndex`
- `anchorNewWordEndIndex: anchorTest.newWordEndIndex`
- optionally `anchorAttemptId: anchorTest.id` if you decide to persist that on review attempts in a future cleanup.

Then `getReviewForDay` can, under `LIST_SCOPED_RECON`, find a review with:

- same student/list/sessionType/studyDay;
- `submittedAt >= anchorSubmittedAt`;
- matching `newWordStartIndex` and `newWordEndIndex` after client-side validation or indexed filters.

If no matching positional review exists, return `none`, not the newest later review.

### F9-4 — MEDIUM — The “no new index” claim is plausible only with paginated client filtering, not with the proposed query

If you add equality filters for `newWordStartIndex` and `newWordEndIndex` directly to the Firestore query, expect a new composite index. If the goal is no new index, the plan should specify:

1. query existing indexed candidates by student/list/sessionType/studyDay/submittedAt;
2. paginate, not fixed-limit scan;
3. accept the first candidate whose positional fields match the anchor;
4. return `none` on exhaustion.

That keeps the no-new-index claim defensible while avoiding false pairing.

## What is sound

- Fix A's core idea is right: `REVIEW_STUDY` means the day's new-word test is already passed, so `wordsIntroduced` for that completion must be zero.
- Using the same passed-first / score-desc selection as `determineStartingPhase` is right.
- Flag-gating the change is the correct choice for Run-L equivalence.
- Normal `NEW_WORDS_STUDY`, Day-1, and single-class same-session paths should remain untouched if the override is only applied when `LIST_SCOPED_RECON && phaseInfo.phase === REVIEW_STUDY`.

## Answers to Claude's questions

1. Does zeroing `newWordCount` break consumers?
   Zeroing the count is acceptable for routing and completion, but only if `newWordEndIndex` still preserves the anchor range. `newWordCount=0` must not imply `newWordEndIndex=start-1` in review-resume configs.

2. Is REVIEW_STUDY always “new fully done”?
   Yes, by `determineStartingPhase`: Day>1, passed new exists, no review. That is safe as the gate for zero `wordsIntroduced`.

3. Is `submittedAt >= anchor` alone sufficient once classId is dropped?
   No. It must be combined with positional lineage, otherwise cross-pace/pre-flag histories can pair the wrong review.

4. Any caller of `getReviewForDay` depending on anchor-class scoping?
   The main caller is reconciliation. That caller can drop class scoping only if it supplies and enforces anchor position lineage.

5. Is flag gating correct?
   Yes. Keep the override and class-dropped review pairing behind `LIST_SCOPED_RECON`.

## Required v2 shape

A v2 plan should say, explicitly:

1. `REVIEW_STUDY` session init sets `newWordCount=0`, `newWordStartIndex=dayNewPass.newWordStartIndex`, and `newWordEndIndex=dayNewPass.newWordEndIndex`.
2. Review attempts produced from that session therefore carry the anchor's day range while not incrementing TWI.
3. `getReviewForDay` drops classId only after adding a position-consistency check against the anchor range.
4. The candidate search is paginated or indexed; it must not accept `limit(1)` newest review without verifying range.
5. Run S S-1/S-3 postverify asserts the B review attempt's stored range equals A's passed-new anchor range, in addition to the existing CSD/TWI/attempt-count oracles.
