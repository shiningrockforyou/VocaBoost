# Codex review/input — Round 36 `REVIEW_PASS_THRESHOLD`

Reviewed:

- `docs/plans/D3.5_WORKITEM_review_pass_threshold.md`
- `docs/plans/loop/handoffs/claude_to_codex_reviewpass_r36.md`
- `functions/index.js`
- `functions/foundation.js`
- `src/services/studyService.js`
- `src/pages/DailySessionFlow.jsx`
- `src/pages/TypedTest.jsx`
- `src/pages/MCQTest.jsx`
- `src/services/db.js`

Decision: `DONE`

## Finding verification

The base finding is correct: review attempts cannot fail today.

Evidence:

- `functions/index.js:434` computes attempt `passed` as `ctx.sessionType === "review" ? true : score >= passThreshold`.
- `functions/foundation.js:2614` mirrors this in the server review-challenge path: `attempt.sessionType === "review" ? true : newScore >= passThreshold`.
- `src/services/studyService.js:1900-1911` says the Day-2+ gate only blocks when the day’s new-word attempt did not pass; review is treated as the final always-pass test.
- I found no existing `reviewPassThreshold`, `requiresReviewRetake`, or `reviewPassed` implementation in `src/` or `functions/`.

So the proposed feature is a new behavior, not a cleanup of an existing hidden lever.

## A. Server hold-on-failed-review: inside `fpHoldCsd` or separate gate?

Recommendation: implement it as a separate explicit `review_retake_required` gate, not as just another reason inside `fpHoldCsd`.

Placement should be after the day guard and after the F-4 evidence check, but before normal CSD/TWI advance and before marker writing.

Reasoning:

- F-4 should still own the “no passed-new anchor and not review-only” invalid-completion case. A failed review threshold should not mask missing evidence.
- `fpHoldCsd` currently means “record this review outcome, but hold CSD” for the forced-pathway throttle/skip cases. It appends `summary` into `recentSessions` and updates stats/streak (`foundation.js:1452-1490`).
- “Retake until pass like the new-word test” usually means the failed test attempt exists, but the day/session is not completed yet. New-word failed attempts do not append a completed session summary. Mirroring that model argues for returning a blocking retake sentinel without appending a `recentSessions` entry.
- If failed review retakes reuse `review_recorded`, every failed retake can append into `recentSessions`, which can distort the rolling review average and create a self-reinforcing throttle effect. That might be desirable only if explicitly chosen, but it should not be accidental.

Suggested server status:

- `status: "review_retake_required"`
- `advanced: false`
- no CSD/TWI write
- no marker write
- no `users/{uid}/sessions` history write
- optional `system_logs` event with `{ reviewScore, reviewPassThreshold, dayNumber, classId, listId }`

Then client `recordSessionCompletionViaServer` should map that status to `{ requiresReviewRetake: true }`, and `completeSessionFromTest` / test pages should block success and route back to review study/test.

If the product explicitly wants failed review scores to feed forced-pathway rolling average, then using the held-summary writer is possible, but the plan needs an idempotency/per-day replacement strategy. Appending every failed retake as a separate `recentSessions` item would be a real semantic change and a likely support trap.

## B. Does the assignment doc reach `completeSession` server-side?

Yes. The assignment is already available server-side.

Trace:

- Client `recordSessionCompletionViaServer` sends only `{ classId, listId, sessionContext }` to the callable (`src/services/studyService.js:994-1011`). It does not send assignment settings.
- Server `completeSession` receives `classId` and `listId` (`functions/foundation.js:1289-1291`).
- It immediately calls `assertEnrolledAssigned(uid, classId, listId)` (`functions/foundation.js:1296`).
- `assertEnrolledAssigned` loads the class doc, reads `classData.assignments`, resolves `assignment = assignments[listId] || null`, verifies assignment/legacy assignment, and returns `{ classData, assignment, teacherId }` (`functions/foundation.js:312-338`).
- `completeSession` already uses that `assignment` to derive pace via `deriveDailyPace(assignment)` (`functions/foundation.js:1296-1297`).

So no client-trusted threshold plumbing is needed for server authority. Add `reviewPassThreshold` to assignment storage, then read it from the existing `assignment` object inside `completeSession`.

Two caveats:

1. `assignment` is fetched before the transaction, not inside the transaction. That matches today’s pace derivation. If teacher edits threshold concurrently with a submit, the server uses whichever class doc version it read before the transaction. That is acceptable for this feature unless you require strict transactional coupling to teacher setting edits.
2. Legacy `assignedLists` without an `assignments[listId]` object returns `assignment=null`. For default-OFF semantics, that should resolve `reviewPassThreshold=0`, not fail. This matches the desired byte-equivalent legacy behavior.

Also update the attempt writer path:

- `functions/index.js:306-364` already authorizes and reads assignment via `assertCanWriteAttempt`.
- `writeAttemptTxn` receives `authRes` and currently destructures `{ passThreshold, teacherId }` (`functions/index.js:404-405`). It should also read `reviewPassThreshold` from `authRes` and use it at `index.js:434`.

## C. Retake-count exhaustion / throttle deadlock

Recommendation: start with unlimited retakes plus teacher-visible surfacing, not a hard cap that auto-advances or permanently blocks.

Minimum safe policy:

- Keep review retakes unlimited from the student’s perspective.
- Persist failed review attempts as attempts with `passed:false`.
- Add teacher-visible signals when a student repeatedly fails review under the threshold, e.g. count failed review attempts for same `studentId,classId,listId,studyDay` and show/stamp after N failures.
- Preserve manual override / challenge paths as the release valve.

Avoid a cap that auto-advances after N failures. That undermines the teacher’s explicit mastery gate.

Avoid a cap that hard-locks without teacher surfacing. That creates silent stuck students.

Throttle interaction:

- Forced pathway throttle and review pass threshold are separate gates.
- A student can pass the per-session review threshold but still remain held by throttle if the rolling average has not crossed the forced-pathway exit threshold. That is not a deadlock; it is two independent criteria.
- However, if failed review retakes are appended to `recentSessions`, the rolling average can be polluted by multiple same-day failures and make the throttle much stickier. This is why I recommend the separate `review_retake_required` status with no `recentSessions` append for ordinary threshold failures.
- Existing forced-pathway skip/engagement hold should remain distinct. A non-engaged skip can still use the existing `review_recorded` semantics if that is load-bearing for the anti-runaway fix. Do not conflate “non-engaged skip hold” with “engaged but below teacher threshold retake.”

## D. Does `reviewOnlyDay` exemption cover list-end and #9-resume safely?

The data needed to distinguish the cases exists, but a blanket `reviewOnlyDay` exemption is too broad.

Current client derivation in `studyService.js:1781-1789` makes `reviewOnlyDay` true for three reasons:

1. `allocation.newWords <= 0` — forced-pathway/throttle allocation-zero day.
2. `sessionCfg.isListComplete === true` — list-end / over-introduced list.
3. `sessionCfg.startPhase === SESSION_PHASE.REVIEW_STUDY` — #9 review resume where new was already passed elsewhere.

Current server derivation mirrors this more explicitly as `reviewOnlyReasons`:

- `allocationZero`
- `listComplete`
- `reviewStudyResume`

So the exemption should not be `if (reviewOnlyDay) skip review threshold`. That would exempt throttle allocation-zero days too, which defeats the teacher’s review mastery gate on exactly the students most likely to need it.

Recommended exemption:

- Exempt `reviewOnlyReasons.listComplete === true`.
- Exempt `reviewOnlyReasons.reviewStudyResume === true` if the product decision is that #9-resume should finish on review completion without a new-word retake and without being trapped by this new optional review gate.
- Also exempt/no-op when there is no actual review test because the review segment is empty/all mastered; otherwise there is no score to compare.
- Do not automatically exempt `reviewOnlyReasons.allocationZero === true`; let the review threshold apply there unless David explicitly decides throttle-review days should always complete regardless of review score.

The client has enough persisted session config to make the same distinction:

- `sessionCfg.isListComplete`
- `sessionCfg.startPhase === SESSION_PHASE.REVIEW_STUDY`
- `allocation.newWords <= 0`

But the server’s `reviewOnlyReasons` should be the authority under `SERVER_PROGRESS_WRITE`.

## Additional landing sites / risks the plan should add

### 1. Test pages currently only call completion when `passed` is true

Both test pages call `completeSessionFromTest` inside a `passed && isSessionFinalTest` guard:

- `TypedTest.jsx:1048-1055`
- `MCQTest.jsx:847-874` follows the same shape

Today review `passed` is always true, so review completion always runs. After adding review threshold, a failed review attempt will have `passed:false`. If the guard is not changed, the client will not call `completeSessionFromTest` for failed review attempts.

That may be acceptable if the desired behavior is “attempt saved, no session completion, show retake UI.” But then do not claim the server records a failed-review hold on the normal client path. If the desired behavior is server-authoritative retake sentinel, the guard must become something like:

- complete on final test if passed, OR
- final test is review and review threshold is active, so the server can return `review_retake_required`.

Either way, add this as an explicit landing site.

### 2. DailySessionFlow review-return path assumes review completion means COMPLETE

`DailySessionFlow.jsx:1455-1483` handles returned review test results by setting `reviewTestResults`, fetching progress, building summary, and setting phase `COMPLETE`.

If failed review tests route back to DailySessionFlow with `testCompleted`, that branch must not blindly set `COMPLETE`. It needs to recognize the new `requiresReviewRetake` / failed-review state and return to `REVIEW_STUDY` or show a review retake prompt.

### 3. Re-entry modal currently allows “Move On to Next Day” after review score

`DailySessionFlow.jsx:2076-2085` shows a re-entry modal with “Retry Review Test” and “Move On to Next Day.” Under an active review pass threshold, a below-threshold saved review score must not offer “Move On” unless the server already completed the day or an override happened.

### 4. Challenge / override path must use review threshold too

`functions/foundation.js:2602-2614` recomputes score/passed after a challenge and currently hardcodes review attempts to passed. With a review threshold, this must become review-threshold-aware.

Also inspect the day-advance after challenge:

- `advanceForChallenge` / `runChallengeDayAdvanceTxn` currently uses `passThreshold` from the assignment and has phase-gated TWI logic for review attempts.
- For a review attempt that crosses from below review threshold to above review threshold via teacher challenge/override, that should probably be able to complete/advance the day if all other guards pass.
- That boundary check must use `reviewPassThreshold`, not the new-word `passThreshold`.

This is a real missed landing site because teacher correction is the likely escape valve for borderline review failures.

### 5. Naming / units

Keep units explicit:

- Attempt `score` in functions is 0–100.
- Client `testResults.score` in `studyService.js` is 0–1.
- Assignment `passThreshold` is 0–100.

A `reviewPassThresholdDecimal` in test config is fine, but server code should compare 0–100 to 0–100. The plan should call out both units to avoid a 95-vs-0.95 false gate.

## Bottom line

The feature is feasible and the server already has assignment access in `completeSession`. The main correction I would make before implementation is semantic: do not blindly fold failed review threshold into `fpHoldCsd`/`review_recorded`. Treat it as a separate retake-required gate unless David explicitly wants failed review retakes to append to `recentSessions` and affect throttle averages.

Also tighten the exemption: exempt list-end and #9-resume specifically, not blanket `reviewOnlyDay`, or throttle review-only days will bypass the new teacher gate.
