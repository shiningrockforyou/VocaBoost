# Codex review — REVIEWONLY_IMPL round 1

## Verdict

NEEDS_FIXES.

The implementation correctly handles the main review-only path, the null/coercion issue, and the negative-count TWI clamp. But it fails the plan’s stale finite-zero negative case: `sessionConfig.newWordCount <= 0` is trusted by itself, so a stale `0` can skip the new-word retake gate on an ordinary assigned-new day.

## Blocker

### ROI-1 — stale finite `newWordCount: 0` still false-opens the gate

File: `src/services/studyService.js`, current lines ~1319 and ~1414.

Current code:

```js
const reviewOnlyDay = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount) && cfgNewWordCount <= 0;
...
if (!reviewOnlyDay && newWordAttemptPassed !== true && newWordScore < threshold) {
  return { requiresNewWordRetake: true };
}
```

This satisfies the simple predicate in §2, but it does not satisfy the plan’s acceptance test 4b:

> an ordinary assigned-new day whose `sessionConfig.newWordCount` is a stale `0` must still hit the gate.

With the current implementation, a stale finite `0` is enough to make `reviewOnlyDay === true`, so the retake gate is skipped even if the actual day was supposed to assign new words and has no passed new-word attempt.

That is exactly the false-open the test is supposed to prevent.

## Required fix

Do not treat `cfgNewWordCount <= 0` as sufficient by itself. Require a second session-config reason proving that zero/negative was a legitimate no-new-words day.

Concrete shape:

```js
const sessionConfig = sessionState?.sessionConfig || {};
const hasExplicitCfgNewWordCount = LIST_SCOPED_RECON && Number.isFinite(cfgNewWordCount);
const allocationNewWords = sessionConfig?.allocation?.newWords;

const allocationAssignedZero =
  Number.isFinite(allocationNewWords) && allocationNewWords <= 0;
const listIsComplete =
  sessionConfig.isListComplete === true;
const reviewResume =
  sessionConfig.startPhase === SESSION_PHASE.REVIEW_STUDY;

const reviewOnlyDay =
  hasExplicitCfgNewWordCount &&
  cfgNewWordCount <= 0 &&
  (allocationAssignedZero || listIsComplete || reviewResume);
```

This preserves the legitimate cases:

- intervention throttle: `allocation.newWords <= 0`
- list end / over-introduced list: `isListComplete === true`
- Fix #9 review-resume after an already-passed new-word attempt: `startPhase === REVIEW_STUDY`

And it rejects the stale finite-zero ordinary-new case where none of those supporting conditions is true.

If there is a better authoritative local marker already present in `sessionConfig`, use that instead. The required property is the same: stale `newWordCount: 0` alone must not skip the gate.

## Verified correct

The rest of the implementation is aligned with the converged design:

- `wordsIntroduced` is clamped to `0` on the review-only path, so negative `cfgNewWordCount` cannot decrement TWI.
- `newWordScore` stays literal `null` on the review-only no-attempt path.
- `newWordsTestScore` and `newWordsTestPassed` are literal `null` in `saveSessionState`, avoiding `null >= threshold` coercion.
- `reviewOnlyDay: true` is stamped only on the review-only path.
- The ordinary assigned-new gate remains intact when `reviewOnlyDay` is false.
- No fake `recordSessionCompletion` was added for empty/no-review terminal state.

## Scope answer: backend-only Phase 1

Backend-only is safe for local acceptance of the full-freeze recovery bug (#11), provided the audit scope is explicit: it proves review-only days can complete, append review scores, and escape intervention freeze.

It is not sufficient to claim the full list-end UX/dead-end is fixed. This implementation does not add the terminal finished screen or persistent finished hero. A list-end student may be unblocked at the backend while still seeing imperfect/endless-review UX until the terminal/cycling phases land.

So the split is acceptable only if Phase 1 is labeled as:

- closes #11 backend recovery deadlock
- partially unblocks list-end backend completion
- does not certify final list-end UX

## Final

VERDICT blockers=1 high=0 med=1 nits=0

NEEDS_FIXES.
