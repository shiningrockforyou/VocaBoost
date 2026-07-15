# Codex review — REVIEWONLY_IMPL round 2

## Verdict

NEEDS_FIXES.

ROI-1 is closed in `studyService.js`. The confirmed-reason predicate is materially better and matches the stale finite-zero guardrail. But the new list-end/no-review UI path violates the converged design: it still fake-completes an empty/no-work day through the existing modal handler.

## Blocker

### ROI2-1 — empty/no-review terminal still records a fake completed session

File: `src/pages/DailySessionFlow.jsx`

New code routes a fresh empty review segment to `showNoReviewModal`:

```js
if (allWords.length === 0) {
  setShowNoReviewModal(true)
  return
}
```

But that modal is wired to:

```js
const handleNoReviewModalClose = async () => {
  setShowNoReviewModal(false)
  await completeSession()
}
```

And `completeSession()` calls `recordSessionCompletion(...)`.

So despite the handoff saying “No `recordSessionCompletion` added at `:826`,” the new path still records a completed session indirectly via the modal OK button. That violates the converged guardrail:

> NEVER call `recordSessionCompletion` for an empty/no-review terminal state.

This matters for the exact list-end/no-review case: a student with no review work can advance CSD without doing any work, and the audit would see a fake day completion.

### Required fix

Split the modal/action by cause.

For the empty/no-review terminal branch, do not reuse `showNoReviewModal` if its close handler completes the session. Use a terminal/no-work state that only shows the finished/all-mastered message and navigates/returns without calling `completeSession()`.

Concrete acceptable shapes:

1. Add a separate state, for example `showTerminalNoWorkModal`, whose close handler only clears/navigates and does not call `completeSession()`.
2. Or add a reason flag such as `noReviewModalMode`, and make `handleNoReviewModalClose` call `completeSession()` only for the legacy resume branch where that behavior is still intentional.
3. Or bypass the modal and set `phase = PHASES.COMPLETE` with a terminal marker/config, but still do not call `recordSessionCompletion`.

The acceptance test must assert not only that no empty review test appears, but also that `currentStudyDay`, `recentSessions`, and completed-session records do not advance for this no-work terminal state.

## Verified fixed

### ROI-1 — stale finite-zero false-open

Closed.

The updated predicate now requires `cfgNewWordCount <= 0` plus one of:

- `allocation.newWords <= 0`
- `isListComplete === true`
- `startPhase === SESSION_PHASE.REVIEW_STUDY`

That rejects the stale finite-zero ordinary-new case and preserves the legitimate throttle/list-end/review-resume cases.

### Negative TWI clamp

Still correct.

`wordsIntroduced` is `0` on the review-only path, so over-introduced list-end cannot decrement TWI.

### Null/coercion fix

Mostly correct.

Genuine no-attempt review-only completion persists null new-word fields and avoids `null >= threshold`.

One non-blocking note: for non-null attempts, `newWordsTestPassed` is still computed from `newWordScore >= threshold` rather than the already-authoritative `newWordAttemptPassed` flag. That is pre-existing in this function, but it can still produce `COMPLETE + passed:false` for manual/lower-threshold passes. I would track it, but I am not making it part of this review-only blocker.

## Scope answers

### B1 — W3 sequencing

Agree this is a doc/tracking dependency, not a code change for this client-side Phase 1. A future server-authoritative/W3 completion path must re-derive the review-only exception server-side and must not trust client `sessionConfig.newWordCount`.

### B2 — `review_only_completion` observability

Useful, but non-blocking for this patch. If added, keep it behind the same path and avoid making observability failure block completion. I would accept either adding it in Phase 1 or deferring to the observability/W3 work.

## Final

VERDICT blockers=1 high=0 med=1 nits=0

NEEDS_FIXES.
