# Codex review round 2: FIX_9_CROSS_CLASS_REVIEW

## Verdict

GO

## Summary

Fix9 v2 is implementation-ready as a design.

The v1 blockers are resolved:

1. Review-resume session config now separates `newWordCount=0` from the day's anchor range.
2. The subsequent review attempt preserves `newWordStartIndex/newWordEndIndex` from the passed-new anchor.
3. `getReviewForDay` can drop class scoping only after verifying that a candidate review matches the anchor range.
4. Candidate selection is no longer `limit(1)` newest-unverified; it is a paginated candidate stream with client-side position matching.
5. The `wordsIntroduced = 0 || newWords.length` reload edge is correctly identified and fixed by treating explicit zero as authoritative.

This closes all three facets of #9 without reintroducing the old cross-progression pairing bug.

## Review result

### GO-1 — Fix A is now structurally correct

Accepted. On `LIST_SCOPED_RECON && phaseInfo.phase === REVIEW_STUDY`, the session should carry:

- `newWordCount = 0` — no new words are introduced by review completion;
- `newWordStartIndex = dayNewPass.newWordStartIndex` — completion gate can find the passed-new attempt;
- `newWordEndIndex = dayNewPass.newWordEndIndex` — the review attempt preserves the anchor range for later reconciliation.

This is the right split between “introduced now” and “the day’s anchor range.” It avoids both the spurious retake and TWI double-advance while preserving lineage for Fix B.

### GO-2 — The explicit-zero `wordsIntroduced` fix is required and correctly scoped

Accepted. `completeSessionFromTest` must not use `||` for `sessionConfig.newWordCount`. With `newWordCount=0`, `||` would fall through to `newWords.length`, and the reload-to-test path can store the review pool in `newWords`.

Use an explicit presence/finite-number test, e.g.:

```js
const cfgNewWordCount = sessionState?.sessionConfig?.newWordCount;
const wordsIntroduced = Number.isFinite(cfgNewWordCount)
  ? cfgNewWordCount
  : (sessionState?.newWords?.length || 0);
```

That makes zero durable and prevents reload-specific TWI corruption.

### GO-3 — Fix B is safe with position-consistent pairing

Accepted. The v2 plan no longer relies on `studyDay + submittedAt` alone. The safe rule is:

- same student/list;
- `sessionType === 'review'`;
- same `studyDay`;
- `submittedAt >= anchorSubmittedAt`;
- `review.newWordStartIndex === anchor.newWordStartIndex`;
- `review.newWordEndIndex === anchor.newWordEndIndex`.

That is sufficient to avoid the cross-pace/pre-flag false match because the review must carry the same anchor position range. If the same student/list has the same range in another class, that is the same list-position day for this purpose and should count under the student-owned model.

### GO-4 — No-new-index claim is acceptable if implemented exactly as candidate-stream + client filter

Accepted with a strict implementation constraint: do not add positional equality filters to the Firestore query unless you also add/deploy a matching composite index. The no-new-index version must use the existing indexed candidate stream and then validate positions in client code.

Implementation requirements:

- paginate candidates, not fixed `limit(1)`;
- return `found` only on a range match;
- return `none` on exhaustion;
- preserve `query-error` on Firestore failures;
- do not silently fall back to the old anchor-class-only query under the flag, because that would preserve A/B divergence.

## Implementation guardrails

These are not blockers, but they should be followed when writing the diff:

1. Keep every behavior change behind `LIST_SCOPED_RECON` so Run L flag-off equivalence remains intact.
2. Prefer factoring the passed-new attempt selection into a helper or returning the selected `newTest` from `determineStartingPhase`; duplicating the sort is acceptable only if it is byte-equivalent to lines 77-81.
3. For legacy passed-new attempts missing range fields, force `newWordCount=0`, but do not pretend derived range is authoritative if it cannot be proven. Modern Run S acceptance should use position-bearing attempts. If the legacy fallback is kept, log/diagnose when derived range is used.
4. Update comments around `getReviewForDay`; the old “anchor class + temporal lineage” explanation will be wrong after this change. The new invariant is “student/list + temporal guard + anchor range.”
5. Run S S-1/S-3 postverify should assert the B review attempt’s stored range equals A’s passed-new anchor range, as the plan says.
6. The stale `audit/playwright/lsr_runS.mjs` false-green runner still needs to be retired before relying on any Run S output.

## Answers to Claude's questions

1. Is position-consistent pairing now safe against cross-pace/pre-flag false matches?
   Yes. Exact anchor range matching is the missing discriminator. `studyDay` remains insufficient by itself, but `studyDay + submittedAt + anchor range` is safe for the intended student-owned list-position model.

2. Is the client-side candidate stream correct and bounded?
   Correct if paginated to exhaustion. It is not a fixed upper-bound query, but the candidate set is limited to one student/list/sessionType/studyDay after the anchor timestamp. That is operationally small for this app, and correctness does not depend on an arbitrary window.

3. Does preserving `newWordEndIndex=anchor.end` while `newWordCount=0` break other consumers?
   No blocker found. Routing and completion use count/phase; review attempts benefit from preserving range. PDF/debug/gradebook display changes should be noted and checked, but they are not correctness blockers.

4. Anything still unfixed in #9's cluster?
   No remaining design blocker found. The implementation must preserve the v2 invariants exactly.
