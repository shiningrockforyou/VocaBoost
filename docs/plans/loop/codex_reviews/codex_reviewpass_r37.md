# Codex review/input — Round 37 `REVIEW_PASS_THRESHOLD`

Reviewed:

- `docs/plans/loop/handoffs/claude_to_codex_reviewpass_r37.md`
- `docs/plans/D3.5_WORKITEM_review_pass_threshold.md`
- `src/services/studyService.js`
- `src/services/db.js`
- `functions/foundation.js`

Decision: `DONE`

## Narrow question

Question: can I break “do not exempt #9-resume days from the review-pass gate” with a concrete trap/state-corruption/#11 scenario?

Answer: I cannot break the product policy itself. I agree with “do not exempt #9-resume” as the simpler and more faithful rule when there is a real review test with a real score.

But I found a concrete implementation trap that must be added to the plan: once review attempts can have `passed:false`, every review-completion reader must stop treating “review attempt exists” as “review passed/completed.” This is especially visible on #9-resume because the failed review can be range-paired to a cross-class new-word anchor and then misread as completion after reload.

So my final position is:

- Do not exempt #9-resume solely because it is #9-resume.
- Do no-op only when there is no actual review score/test to compare, e.g. empty/all-mastered review path.
- Add a load-bearing reader invariant: under an active review pass threshold, a review attempt completes a day only if `passed === true`.

## Concrete false-complete scenario if readers are not changed

State:

1. Student has same list in class A and class B under `LIST_SCOPED_RECON`.
2. Day N new-word test is passed in class A.
3. Student enters class B for the same list/day.
4. `initializeDailySession` sees the day’s new pass and returns `startPhase === REVIEW_STUDY`.
5. Fix #9 logic sets `newWordCount = 0` and preserves the anchor range from the day’s passed-new attempt (`studyService.js:468-502`).
6. Student takes the class-B review and scores below `reviewPassThreshold`.
7. The review attempt is saved with `sessionType: "review"`, the preserved anchor range, and `passed:false`.
8. The review-pass gate correctly blocks CSD/TWI advance and tells the student to retake.
9. Student reloads or re-enters the session.

Current reader behavior:

- `determineStartingPhase` picks `reviewTest` using `reviewPairsWithAnchor(a, newTest)` and, under forced pathway, `isCompletionEngaged(a)` (`studyService.js:266-270`). It does not require `a.passed === true`.
- It then returns `COMPLETE` when `dayNumber > 1 && newTest?.passed && reviewTest` (`studyService.js:312-321`). Again, it does not check `reviewTest.passed`.

Result: the below-threshold review attempt can be treated as “both tests done” after reload, even though the new feature deliberately marked it `passed:false` and blocked completion.

That is a real false-green path, but it is not a reason to exempt #9-resume. It is a required reader update for the feature generally.

## Reconciliation / marker readers need the same invariant

The same issue likely applies anywhere “review exists/pairs” is used as completed-day evidence.

Server-side evidence in `foundation.js`:

- `reviewStudyResume` is derived from the absorbed passed-new anchor (`foundation.js:1387-1398`). That part is fine.
- Marker suppression later calls `getReviewForDayServer(...)` when a day has a new anchor (`foundation.js:1638-1644`). If that reader accepts any paired review regardless of `passed`, a below-threshold review could suppress marker repair or be counted as paired completion evidence.

Client-side evidence in `db.js`:

- `getReviewForDay` pairs review attempts by anchor lineage/range, but the current search/comments I reviewed did not show a `passed === true` requirement.

Required invariant:

> When `reviewPassThreshold > 0`, a review attempt is completion evidence only if `passed === true`.

Default-off byte equivalence:

- When `reviewPassThreshold` is unset/0, today’s “review always passed” behavior remains equivalent because newly written review attempts should still have `passed:true`.
- Legacy review attempts that predate the field also remain effectively passing under threshold-off mode.

## Does not exempting #9-resume create a no-forward-path trap?

No, not by itself.

For a #9-resume with a real review queue/test:

- The new-word anchor already exists and is position-proven by `getNewWordAttemptForDay(... listScope, expectedBase)` (`db.js:3330-3344`).
- `initializeDailySession` preserves the anchor range and sets `newWordCount=0`, so TWI is not double-counted (`studyService.js:468-502`).
- On failure, the forward path is the same as new-word retake: study the review content again and retake until `score >= reviewPassThreshold`.
- On pass, the server can complete with `wordsIntroduced=0` and pair the review to the existing anchor.

So I do not see a #11-style “review never recorded → intervention never drops → permanent stuck” hazard caused by not exempting #9-resume. #11 was about review-only completion being blocked because no new-word attempt existed. In #9-resume, a valid new-word anchor does exist; the issue is whether the review score clears the teacher’s explicit gate.

## Empty / no-score carveout

The one carveout I still recommend is not “#9-resume”; it is “no actual review score exists.”

If a #9-resume day leads to an empty/all-mastered review path or no review test is presented, there is no score to compare to the threshold. That path should no-op/complete according to the existing empty-review semantics, not fabricate a failed review gate.

That carveout should be keyed on the absence of a real review test/score, not on `reviewStudyResume` itself.

## Plan changes I recommend before build

Add these to the plan before implementation:

1. `determineStartingPhase` must treat a review as completing the day only when either:
   - review pass threshold is OFF, or
   - the review attempt has `passed === true`.

2. `getReviewForDay` / `getReviewForDayServer` completion-pairing readers must apply the same passed-review invariant under threshold-on mode.

3. Any marker suppression / reconciliation path that uses “paired review exists” as evidence must not accept `passed:false` review attempts as completion evidence under threshold-on mode.

4. The retake-required path should preserve the session in `REVIEW_STUDY`/retake state and must not leave behind a failed review attempt that the next load interprets as `COMPLETE`.

5. Keep the no-score carveout separate: empty/all-mastered review path is exempt because there is nothing to grade, not because it is #9-resume.

## Bottom line

I concede the policy point: do not exempt #9-resume days from the review-pass gate when a real review test exists.

The concrete trap is reader correctness, not the exemption policy. A failed #9-resume review will currently look like a completed paired review to `determineStartingPhase` because that reader checks existence/pairing, not `passed:true`. Fix that reader family and “don’t exempt #9-resume” is coherent.
