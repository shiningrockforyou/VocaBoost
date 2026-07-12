# Codex code review round 3: FIX_9_CODE_REVIEW

## Verdict

GO

## Summary

The Fix #9 implementation is now code-review clean.

The round-2 defects are resolved:

1. `getReviewForDay` now orders by `submittedAt DESC`, matching the existing list-scoped composite index.
2. `wordsIntroduced` explicit-zero behavior is now gated by `LIST_SCOPED_RECON`; flag-off keeps the legacy `||` expression.
3. The pagination cap now fails closed with `query-error` instead of silently returning `none` when the cap is reached.

The implementation now matches the approved v2 design closely enough to proceed to deployment/Run S validation.

## Review result

### GO-1 — Review-resume allocation correctly preserves anchor range while avoiding re-count

Accepted. In `initializeDailySession`, the flag-on `REVIEW_STUDY` branch now:

- computes `nwCount/nwStart/nwEnd` after `determineStartingPhase`;
- sets `nwCount = 0` for review resumes;
- selects the twi-defining passed-new attempt first via `newWordEndIndex === totalWordsIntroduced - 1`;
- preserves that attempt's `newWordStartIndex/newWordEndIndex` on the session config;
- falls back only for legacy data.

That is the right implementation for the #9 root cause: the review completion will not re-introduce words, but the review attempt still carries the anchor range for position-consistent pairing.

### GO-2 — Explicit-zero `wordsIntroduced` is now correctly flag-gated

Accepted. Current code:

```js
const wordsIntroduced = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount)
  ? cfgNewWordCount
  : (sessionState?.sessionConfig?.newWordCount || sessionState?.newWords?.length || 0);
```

This preserves flag-off behavior while making `newWordCount=0` durable under the flag. That addresses the reload/recovery double-advance edge without breaking Run-L equivalence.

### GO-3 — Position-consistent review pairing is implemented safely

Accepted. Under `LIST_SCOPED_RECON`, `getReviewForDay` now requires:

- anchor class/submittedAt lineage;
- integer `anchorNewWordStartIndex` and `anchorNewWordEndIndex`;
- candidate review range exactly matching the anchor range.

It drops class scoping only after adding the position discriminator. This avoids the cross-pace/pre-flag false-pairing bug and allows B's review to complete A's anchor day only when it actually covers the same word range.

### GO-4 — Candidate stream is now index-safe and fail-closed

Accepted. The query now uses `orderBy('submittedAt', 'desc')`, matching the existing no-class composite:

```text
studentId ASC, listId ASC, sessionType ASC, studyDay ASC, submittedAt DESC
```

The `MAX_PAGES` cap now returns `query-error` instead of `none`, so cap exhaustion preserves stored CSD instead of pretending no review exists. That is the correct fail-closed behavior.

## Validation performed

- Inspected the source diff for:
  - `src/services/studyService.js`
  - `src/services/db.js`
  - `src/services/progressService.js`
- Confirmed the relevant index shape in `firestore.indexes.json`.
- Ran syntax checks:
  - `node --check src/services/studyService.js`
  - `node --check src/services/db.js`
  - `node --check src/services/progressService.js`

All three syntax checks passed.

## Deployment / acceptance guardrails

Before declaring the product fixed, still run the planned behavioral validation:

1. Deploy the fixed client/source bundle that contains these three files.
2. Run Run S S-1/S-3 against the deployed flag-on environment.
3. In postverify, assert all of the following:
   - B completes the review with no forced new-word retake;
   - final TWI stays at the anchor TWI, not `+pace`;
   - A-after-B converges to the same completed-day state;
   - B's review attempt stores the same `newWordStartIndex/newWordEndIndex` as A's passed-new anchor.
4. Retire or hard-disable the stale `audit/playwright/lsr_runS.mjs` runner before relying on Run S output.

## Answers to Claude's round-3 questions

1. Are all three round-2 defects resolved?
   Yes. DESC index-safe query, flag-gated explicit-zero semantics, and fail-closed scan cap are all implemented.

2. Is the twi-anchored `dayNewPass` selection correct?
   Yes. Prefering `newWordEndIndex === totalWordsIntroduced - 1` is safer than raw passed-first sorting in list-scoped mixed-pace histories. The fallback is acceptable for legacy data.

3. Is accepting legacy-null-position false-`none` better than a studyDay-only fallback?
   Yes. False-repeat / preserved CSD is safer than false-advance. Do not add a studyDay-only fallback.

4. Anything else before GO?
   No code blocker found. Proceed to deploy + Run S acceptance.
