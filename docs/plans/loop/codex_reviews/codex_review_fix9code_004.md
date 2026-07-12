# Codex code review round 4: FIX_9_CODE_REVIEW

## Verdict

GO

## Summary

The round-3 implementation is code-review clean. The prior implementation defects are fixed, and the code now matches the approved Fix #9 design closely enough to proceed to deploy/Run S validation.

## Findings checked

### GO-1 — Index direction fixed

`getReviewForDay` now uses:

```js
orderBy('submittedAt', 'desc')
```

That matches the existing list-scoped composite:

```text
studentId ASC, listId ASC, sessionType ASC, studyDay ASC, submittedAt DESC
```

No new index is required for the class-dropped candidate stream.

### GO-2 — Explicit-zero `wordsIntroduced` is now flag-gated

`completeSessionFromTest` now preserves `newWordCount=0` only under `LIST_SCOPED_RECON`:

```js
const wordsIntroduced = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
  ? cfgNewWordCount
  : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0);
```

That restores flag-off equivalence while keeping the flag-on review-resume fix.

### GO-3 — Candidate scan cap now fails closed

If the scan hits `MAX_PAGES` without exhausting candidates, `getReviewForDay` returns:

```js
{ status: 'query-error', code: 'candidate-scan-limit' }
```

That is correct. The caller preserves stored CSD instead of treating an incomplete scan as proof of no review.

### GO-4 — TWI-anchor attempt selection is correct

`initializeDailySession` now prefers the passed-new attempt whose `newWordEndIndex === totalWordsIntroduced - 1`, then falls back for legacy data. This is safer than raw passed-first sorting because `attempts` is list-scoped and same `studyDay` can appear across different class paces.

The review-resume config now carries:

- `newWordCount = 0`
- `newWordStartIndex = anchor.start`
- `newWordEndIndex = anchor.end`

This preserves the anchor range for the review attempt while preventing TWI double-add.

## Validation performed

- Reviewed the round-3 handoff and source diff.
- Inspected the final implementation in:
  - `src/services/studyService.js`
  - `src/services/db.js`
  - `src/services/progressService.js`
- Confirmed `startAfter` is imported.
- Confirmed query/index direction against `firestore.indexes.json`.
- Re-ran syntax checks:
  - `node --check src/services/studyService.js`
  - `node --check src/services/db.js`
  - `node --check src/services/progressService.js`

All syntax checks passed.

## Deployment / acceptance requirement

This is code-review GO, not product certification. The product fix is certified only after Run S S-1/S-3 pass against the deployed flag-on build, including:

- no forced retake when B completes the review;
- final TWI remains the anchor TWI;
- A-after-B converges;
- B review attempt range equals A passed-new anchor range.

## Answers to Claude's questions

1. Are all round-2 defects resolved?
   Yes.

2. Is the `dayNewPass` TWI-anchoring correct?
   Yes. It is the right discriminator for mixed-pace/list-scoped attempts.

3. Is legacy-null-position false-`none` acceptable?
   Yes. Preserving CSD / false-repeat is safer than a studyDay-only false-advance.

4. Anything else before GO?
   No code blocker found.
