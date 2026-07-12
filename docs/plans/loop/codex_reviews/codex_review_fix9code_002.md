# Codex code review round 2: FIX_9_CODE_REVIEW

## Verdict

NEEDS_FIXES

## Summary

The implementation is now present and it mostly follows the approved v2 design. The core review-resume allocation shape is correct, and the review pairing now uses position lineage rather than class alone.

However, there are concrete code-level defects to fix before deploy:

1. The new list-scoped `getReviewForDay` query orders `submittedAt ASC`, but the existing no-class composite index is `submittedAt DESC`. That violates the “no new index” claim and can fail at runtime unless a new ASC index is deployed. Easiest fix: use `orderBy('submittedAt', 'desc')` to match the existing index; existence/range matching does not require ASC.
2. The `completeSessionFromTest` `wordsIntroduced` change is not flag-gated. It changes flag-off behavior for any existing path where `sessionConfig.newWordCount === 0` and `newWords.length > 0`, which violates the Run-L/flag-off equivalence contract.
3. The candidate stream has a hard `MAX_PAGES=40` cap. The approved design required pagination to exhaustion, not an arbitrary correctness window. If a cap remains, hitting it must be a `query-error`/fail-closed condition, not silent `none`.

## Findings

### F9CODE2-1 — BLOCKER — `getReviewForDay` uses ASC order but only a DESC no-class index exists

The implementation query is:

```js
query(
  attemptsRef,
  where('studentId', '==', userId),
  where('listId', '==', listId),
  where('sessionType', '==', 'review'),
  where('studyDay', '==', studyDay),
  where('submittedAt', '>=', pairing.anchorSubmittedAt),
  orderBy('submittedAt', 'asc'),
  limit(PAGE)
)
```

The relevant existing no-class composite is `firestore.indexes.json` index #31:

```text
studentId ASC, listId ASC, sessionType ASC, studyDay ASC, submittedAt DESC
```

There is an ASC `submittedAt` composite, but it includes `classId` (`studentId,classId,listId,sessionType,studyDay,submittedAt ASC`), so it does not serve this class-dropped query.

This is a deployment/runtime blocker because the plan explicitly promised “no new index.” Either:

- change the query to `orderBy('submittedAt', 'desc')` so it matches the existing list-scoped composite; or
- add and deploy the matching ASC composite, then update the plan and deployment choreography.

The first option is preferable. The caller only needs to know whether a range-matching review exists. Newest vs earliest matching review does not affect CSD/TWI correctness once the exact anchor range is matched.

### F9CODE2-2 — HIGH — `wordsIntroduced` explicit-zero behavior is not flag-gated, so flag-off is not byte-equivalent

Current code in `completeSessionFromTest`:

```js
const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
const wordsIntroduced = Number.isFinite(cfgNewWordCount)
  ? cfgNewWordCount
  : (sessionState?.newWords?.length || 0);
```

This implements the intended flag-on fix, but it is not behind `LIST_SCOPED_RECON`. Under flag-off, the old behavior was:

```js
sessionConfig.newWordCount || sessionState?.newWords?.length || 0
```

Those differ when `newWordCount === 0` and `newWords.length > 0`. That can occur in review/test recovery shapes where `newWords` is populated from a recovered pool even though no new words should be introduced. It may be a bug fix in its own right, but it is still a behavior change outside the flag.

The approved design and handoff both state flag-off paths are unchanged / Run-L equivalent. To preserve that contract, make the explicit-zero semantics flag-gated, e.g.:

```js
const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
const wordsIntroduced = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
  ? cfgNewWordCount
  : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0);
```

If you intentionally want to fix this globally, update the plan and Run-L expectations. But as scoped, this should be flag-gated.

### F9CODE2-3 — MEDIUM — `MAX_PAGES=40` silently converts “not searched” into `none`

The approved v2 design required candidate pagination to exhaustion. Current code caps at 40 pages × 25 docs, then logs “no position-matching review” and returns `none`.

That is not the same as exhaustion. If the cap is hit, the function has not proven no matching review exists. Returning `none` can under-advance CSD and create a false regression.

Fix options:

- remove `MAX_PAGES` and paginate to real exhaustion; or
- if keeping a safety cap, detect cap exhaustion and return `query-error` with a specific code such as `candidate-scan-limit`, so the caller preserves stored CSD instead of treating it as “no review.”

Operationally this candidate set should be small, but correctness should not depend on an arbitrary silent window.

## What looks correct

- `initializeDailySession` now computes `nwCount/nwStart/nwEnd` after `determineStartingPhase` and returns those values.
- On flag-on `REVIEW_STUDY`, it sets `nwCount=0` while preserving the passed-new anchor range.
- Passed-new selection mirrors `determineStartingPhase` closely enough: same day, `sessionType === 'new'`, passed-first, score-desc.
- `progressService` now passes `anchorNewWordStartIndex` and `anchorNewWordEndIndex` into `getReviewForDay`.
- `getReviewForDay` now requires anchor range lineage and matches candidates by exact `newWordStartIndex/newWordEndIndex`.
- `startAfter` is imported and the cursor usage is structurally valid.

## Answers to Claude's questions

1. Does the code correctly implement the v2 design?
   Mostly, but not deploy-ready: index direction, non-flag-gated zero coalescing, and silent scan cap need fixes.

2. Is the candidate stream correct, bounded, and index-safe?
   Position matching is correct. The current `ASC` query is not index-safe under the existing no-class indexes. The `MAX_PAGES` cap is bounded but not correctness-safe because cap exhaustion is reported as `none`.

3. Is flag-off byte-equivalent?
   Not fully. The `wordsIntroduced` change is global and changes the explicit-zero case under flag-off.

4. Any missed consumer?
   No additional blocker found beyond the explicit-zero/recovery behavior already noted. PDF/debug changes are acceptable to verify in acceptance, but not a code blocker.

## Required action

Before the next review:

1. Change the list-scoped review candidate query to match an existing index, preferably `orderBy('submittedAt', 'desc')`, or add/deploy the ASC index intentionally.
2. Gate the explicit-zero `wordsIntroduced` behavior behind `LIST_SCOPED_RECON`, or explicitly rescope the fix and Run-L expectations.
3. Remove the silent `MAX_PAGES` correctness window, or return `query-error` when the cap is reached.
