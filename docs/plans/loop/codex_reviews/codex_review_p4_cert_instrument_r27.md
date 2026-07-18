# Codex review — P4/D3 behavioral certification instrument, round 27

Verdict: NEEDS-FIXES.

The instrument is directionally right, and the live flag posture / sha-pinning are correct. I am not signing it off until two acceptance-oracle ambiguities are fixed.

## What is correct

### (a) Flag set matches live `0ddbb34`

Confirmed.

`git show 0ddbb34:functions/foundation.js` shows the intended production posture:

- `SERVER_COMPLETE_SESSION_ENABLED=true`
- `SERVER_RESOLVE_LIST_PROGRESS_ENABLED=true`
- `SERVER_RESET_PROGRESS_ENABLED=true`
- `SERVER_ADVANCE_FOR_CHALLENGE_ENABLED=true`
- `ANCHOR_VALIDATION_SHADOW=true`
- `REVIEW_ENGAGEMENT_STAMP_ENABLED=true`
- `RECOVERY_SCORE_CLAMP_ENABLED=true`
- `FORCED_PATHWAY_ENABLED=true`
- `FORCED_PATHWAY_GRANDFATHER_EPOCH_MS=1784333239063`
- `LIST_PROGRESS_CANONICAL=false`
- `ANCHOR_VALIDATION_ENFORCE=false`
- `CYCLING_ENABLED=false`
- override / teacherIds flags false

That is the live `0ddbb34` posture the certification needs to emulate.

### (c) `0ddbb34` pinning + sha stamp

Sound.

The requirement to hash-match/check out `0ddbb34` and stamp the certified sha closes the r34 baseline-drift failure mode, provided the output artifact includes:

- exact function source sha
- exact flag set
- exact epoch
- emulator run metadata
- per-assertion results

### (d) Pass/fail disposition

Mostly correct.

All certification assertions must pass. Any assertion failure should stop the certification and be escalated. Treat rollback as a candidate, not an automatic action, because an emulator failure can still be a harness/setup defect.

## Required fixes before GO

### 1. Assertion #2 must spell out exact epoch-boundary expected outcomes

Current wording:

> “Test BOTH sides of the grandfather epoch: a post-epoch non-engaged/skip review engages the hold (no advance); a pre-epoch (grandfathered) review behaves per spec.”

That is too ambiguous. In `0ddbb34`, hold-csd is:

```js
fpHoldCsd = fpThrottleReviewOnly || (dayNumber >= 2 && !fpReviewEngaged)
```

So a grandfathered/pre-epoch review is only “engaged” for the engagement leg. It can still hold if the day is throttle review-only (`allocationZero`).

Replace assertion #2 with explicit subcases:

2a. **Post-epoch non-engaged review, non-throttle normal allocation**

- setup: Day >= 2, `FORCED_PATHWAY_ENABLED=true`, review attempt submitted after epoch, `engagedReview=false` / insufficient answers, `allocationZero=false`, not list-complete, not review-study-resume
- expected: `status="review_recorded"`, no CSD advance, no TWI advance, `review_recorded` log emitted
- purpose: proves F3 engagement hold independent of throttle

2b. **Pre-epoch non-engaged-looking review, non-throttle normal allocation**

- setup: same as 2a except submittedAt before `1784333239063`
- expected: grandfather makes it completion-engaged, so the non-engagement hold must not fire; with a valid day/new-anchor or valid non-review-only evidence, completion advances exactly once
- purpose: proves the grandfather boundary prevents old skip-like reviews from being stranded

2c. **Throttle review-only day**

- setup: recent sessions/persisted `reviewMode` cause binary throttle allocationZero, not list-complete, not review-study-resume
- expected: `status="review_recorded"`, no CSD advance, no TWI advance, `reviewMode` persisted from held recentSessions
- purpose: proves the throttle hold branch itself

Optional but useful: run 2c with both pre-epoch and post-epoch reviews and assert it holds in both cases, because `fpThrottleReviewOnly` is independent of grandfather engagement.

Without these explicit expected outcomes, a harness could pass a vague “pre-epoch behaves per spec” while not proving the actual boundary.

### 2. Assertion #5 must match the chosen harness layer

The instrument says this is approach-1: emulator callable re-cert extending M-CALL. That is not a DSF/UI harness.

Current assertion #5 says:

> “DSF `day_guard_rejected` does not fire on the server path for a legitimate completion...”

In a callable-emulator harness, do not claim DSF behavior. Replace with server/callable observables:

5a. **Normal legitimate completion**

- expected: callable result is not `day_guard_rejected`
- no `day_guard_rejected_session_cleared`
- no `day_guard_session_clear_FAILED`
- CSD/TWI outcome matches assertion #1

5b. **Stale day completion**

- expected: callable returns `status="day_guard_rejected"` / `dayGuardRejected=true`
- CSD/TWI unchanged
- stale `session_states` doc cleared
- exactly one of `day_guard_rejected_session_cleared` or `day_guard_session_clear_FAILED` emitted, with success expected for normal emulator conditions

If DSF UI recovery is still required, that is a separate UI smoke, not part of this approach-1 callable cert. Do not label the callable cert as proving DSF unless a real UI harness is added.

## Recommended additional precision

Not blockers if the two fixes above are made, but worth adding to avoid false greens:

- For every CSD/TWI assertion, specify the exact document path expected under `LIST_PROGRESS_CANONICAL=false`: `users/{uid}/class_progress/{classId}_{listId}`.
- Assertion #6 should check both:
  - zero `users/{uid}/list_progress` docs for the test uid
  - no global/sandbox canonical write created by the resolver/completion path during the run
- Assertion #4 should prove challenge acceptance after a held review cannot advance the held day, not merely that `progress.reviewMode=true` causes an early return.

## Final

`codexDecision=NEEDS-FIXES`

`codexConverged=false`

Fix assertion #2 and #5 as above, then send the instrument back for sign-off.
