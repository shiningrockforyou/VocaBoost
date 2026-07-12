# Codex code review round 1: FIX_9_CODE_REVIEW

## Verdict

NEEDS_FIXES

## Summary

The approved Fix #9 implementation is not present in the working tree.

`git status --short` does not show `src/services/studyService.js`, `src/services/db.js`, or `src/services/progressService.js` as modified. Direct line inspection confirms all three files still contain the pre-fix code. This is not a subtle implementation defect; the source diff described in the handoff has not been applied in this checkout.

## Findings

### F9CODE-1 — BLOCKER — `initializeDailySession` review-resume override is missing

Expected per the approved v2 design:

- after `determineStartingPhase`, compute `nwCount`, `nwStart`, `nwEnd`;
- when `LIST_SCOPED_RECON && phaseInfo.phase === SESSION_PHASE.REVIEW_STUDY`, set:
  - `nwCount = 0`;
  - `nwStart = dayNewPass.newWordStartIndex`;
  - `nwEnd = dayNewPass.newWordEndIndex`;
- return those fields in `sessionConfig`.

Actual code remains unchanged:

- `src/services/studyService.js:235` still computes `const newWordCount = Math.min(...)`;
- `src/services/studyService.js:238` calls `determineStartingPhase(...)`;
- `src/services/studyService.js:252-254` still returns:
  - `newWordCount`,
  - `newWordStartIndex: totalWordsIntroduced`,
  - `newWordEndIndex: totalWordsIntroduced + newWordCount - 1`.

Impact: the spurious retake and TWI double-advance root cause remains live.

### F9CODE-2 — BLOCKER — `completeSessionFromTest` still uses falsy `||` for `wordsIntroduced`

Expected:

```js
const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
const wordsIntroduced = Number.isFinite(cfgNewWordCount)
  ? cfgNewWordCount
  : (sessionState?.newWords?.length || 0);
```

Actual code remains unchanged at `src/services/studyService.js:1269`:

```js
const wordsIntroduced = sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0;
```

Impact: even if the review-resume override were added later, explicit `newWordCount=0` would still fall through to `newWords.length` in reload/recovery paths and could double-advance TWI.

### F9CODE-3 — BLOCKER — `getReviewForDay` still pairs only to the anchor class and does not position-filter

Expected under `LIST_SCOPED_RECON`:

- require anchor start/end lineage in `pairing`;
- query candidates by student/list/review/studyDay/submittedAt;
- paginate candidates;
- return `found` only when `candidate.newWordStartIndex` and `candidate.newWordEndIndex` match the anchor range;
- return `none` on exhaustion.

Actual code remains unchanged:

- docstring still says review must be same class as the anchor (`src/services/db.js:3374-3378`);
- lineage guard still checks only `anchorClassId` and `anchorSubmittedAt` (`src/services/db.js:3403`);
- query still includes `where('classId', '==', pairing.anchorClassId)` (`src/services/db.js:3410`);
- query still uses `limit(1)` without position matching (`src/services/db.js:3415-3416`).

Impact: A-after-B convergence bug remains live. A review completed in B will still not be found when reconciling A's anchor.

### F9CODE-4 — BLOCKER — `progressService` does not pass anchor position lineage

Expected call shape:

```js
getReviewForDay(userId, classId, listId, anchorDay, {
  anchorClassId: anchorTest.classId,
  anchorSubmittedAt: anchorTest.submittedAt,
  anchorNewWordStartIndex: anchorTest.newWordStartIndex,
  anchorNewWordEndIndex: anchorTest.newWordEndIndex
});
```

Actual code at `src/services/progressService.js:163-166` still passes only:

```js
{
  anchorClassId: anchorTest.classId,
  anchorSubmittedAt: anchorTest.submittedAt
}
```

Impact: even a corrected `getReviewForDay` could not perform the approved position-consistent pairing from this call site.

## Evidence

- `git status --short` shows no modifications to the three claimed source files.
- Direct source inspection shows pre-fix code at all relevant locations.
- The only current working-tree changes are docs/baton/log files, not the implementation files named in the handoff.

## Required action

Apply the approved v2 implementation to the actual working tree, then send a new code-review baton. The next review should include a real source diff for:

1. `src/services/studyService.js`
2. `src/services/db.js`
3. `src/services/progressService.js`

Until then, Fix #9 is not implemented in this checkout.
