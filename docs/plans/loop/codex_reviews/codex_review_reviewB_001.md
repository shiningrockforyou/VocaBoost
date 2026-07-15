# Codex review — RUNS_REVIEWB round 1

## Verdict

NEEDS_FIXES for the harness. The app-side #9 behavior is sound based on the code path and the recorded live evidence.

The failure `Review B: reached=false` is not evidence that the cross-class review fix is broken. It is a harness assumption error: the harness expects class B's dashboard to already expose a review CTA, but Phase 1 reconciliation happens on session entry, not on the class-keyed dashboard.

## App behavior check

The claimed route is correct.

### Cross-class re-entry routes to review-study

`initializeDailySession(userId, classId, listId, ...)` calls `getOrCreateClassProgress(userId, classId, listId)`, which is the reconciliation point for the class/list progress doc. It then computes:

- `currentStudyDay = (progress.currentStudyDay || 0) + 1`
- `phaseInfo = determineStartingPhase(attempts, currentStudyDay)`

`determineStartingPhase(attempts, dayNumber)` selects attempts for that study day and returns `REVIEW_STUDY` when:

- `dayNumber > 1`
- a passed `sessionType === "new"` attempt exists for that day
- no `sessionType === "review"` attempt exists for that day

That is exactly the S-1 state after Day 2 new was passed in class A and before the review is completed in B.

`DailySessionFlow` then uses `config.startPhase === SESSION_PHASE.REVIEW_STUDY` to load the review segment and set `phase` to review study. So the reported live observation — entering B's session lands on "Review Study — Day 2" with B's `class_progress` reconciled — matches the code.

Conclusion: #9's cross-class entry behavior is correct.

## Dashboard behavior check

The misleading B dashboard is expected under the current Phase-1 model.

Dashboard panel C derives phase from the currently selected class/list doc and filters attempts by `a.classId === getPrimaryFocus.classId && a.listId === getPrimaryFocus.id`. If B has no class-local `class_progress` yet, the dashboard can render as Day 1 / start-new-words even though session entry will reconcile to the list-wide position.

That is a class-keyed display limitation, not a contradiction in the #9 session-entry behavior.

## Harness finding

### RB-1 — `driveReviewToTest` assumes a dashboard review CTA that may not exist

Severity: high for Run S certification.

Current `driveReviewToTest` starts by looking for:

```js
page.getByRole('button', { name: /review|continue/i })
```

That is wrong for this cross-class Phase-1 state. B's dashboard may only expose "Start Session" / "Start new words" because B has no class-local progress yet. The correct user action is still to enter the session. The app then reconciles and routes to review-study.

The S-1 B step should not call `driveReviewToTest` directly from the dashboard. It should first enter the session via the available study affordance, then verify it is on review-study, then drive the review to test.

## Recommended harness fix

Add or reuse a shared helper with this shape:

```js
async function enterSessionAny(page, findings, label) {
  // click first visible study affordance:
  // Start Session | Start new words | Continue | Review | Start Review
  // click through the "Start Studying" intro if present
  // require in-session evidence: Card N of M, Session menu, or Quit session
}
```

Then update the S-1 B review step:

1. `dashReady(classBName)`
2. `enterSessionAny(...)`
3. Assert the session is review-study, not new-word study:
   - visible "Review Study", or
   - review card state, or
   - absence of new-word-only screen
4. Call a review-to-test driver that can operate from inside the review-study screen.
5. Submit the review and assert no retake gate.

This should be a targeted harness change. Do not change the app for this.

## Other S-1 steps

The same enter-then-observe treatment is relevant anywhere the harness is trying to infer state from the dashboard while Phase-1 reconciliation is known to happen only on session entry.

Specifically:

- The "leave A before review" step already enters A and observes review-study before leaving; that shape is correct.
- The "re-enter A expecting no re-review" step should also enter the session before making the no-retake/no-review conclusion. A dashboard-only assertion can be misleading for the same class-keyed-display reason.

## UX note

The B dashboard label is misleading: it can say Day 1 / Start new words, but clicking it routes to Day-2 review. This should be logged as a low-severity UX / Phase-2 item, not a blocker for #9.

Reason: the data behavior is correct, and Phase 1 intentionally keeps display progress class-keyed while reconciliation is lazy at session entry. Phase 2's student+list progress model should remove this mismatch.

## VERDICT

NEEDS_FIXES for the Run S harness.

#9 app behavior is SOUND. The harness must enter B's session before driving/requiring the review UI.
