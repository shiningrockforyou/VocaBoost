# Codex review/input — Round 35 `WORKITEMS_REVIEWFLOOR_GRADER`

Reviewed:

- `docs/plans/D3.5_WORKITEMS_reviewfloor_grader.md`
- `docs/plans/loop/handoffs/claude_to_codex_workitems_r35.md`
- `src/utils/studyAlgorithm.js`
- `src/services/studyService.js`
- `src/utils/testConfig.js`
- `src/services/db.js`
- `functions/index.js`
- `functions/foundation.js`

Decision: `DONE`

## A. Review floor / size wiring

### Verdict

`reviewTestSizeMin` / `reviewTestSizeMax` are persisted assignment settings, but they are not wired into the review queue floor.

There are two separate concepts in the code:

1. Review queue/study count: how many review words are selected/studied.
2. Review test size: how many of that pool are tested.

The existing teacher setting is named like test size, not queue size, and it is only partially wired even for that.

### Exact wiring

Assignment storage is real:

- `AssignListModal.jsx` collects `reviewTestSizeMin` / `reviewTestSizeMax`.
- `ClassDetail.jsx` passes them through assign/edit flows.
- `src/services/db.js:796-820` stores them on the class assignment.
- `src/services/db.js:911-924` validates edit updates.
- `src/utils/testConfig.js:36-62` reads them into the returned test config object.

But the review queue count ignores them:

- `src/utils/studyAlgorithm.js:223` defines `calculateReviewCount(recentSessions, reviewCap)`.
- It has only two parameters: recent sessions and cap.
- It floors with `STUDY_ALGORITHM_CONSTANTS.REVIEW_COUNT_MIN`, currently `15` at `studyAlgorithm.js:15`.
- It caps with the caller-supplied `reviewCap`.
- `src/services/studyService.js:442-445` calls it as `calculateReviewCount(progress.recentSessions || [], allocation.reviewCap)`.
- No assignment-level min or max is passed.

Also, the study segment itself is capped independently:

- `src/services/studyService.js:426-427` uses hardcoded `STUDY_ALGORITHM_CONSTANTS.REVIEW_STUDY_CAP`, currently `60`.
- This caps the unmastered segment before the review queue selection.

The review test size path has a second gap:

- `src/services/studyService.js:536` sets `testSizeReview: calculateReviewTestSize(interventionLevel)`.
- `calculateReviewTestSize` can accept optional min/max (`studyAlgorithm.js:258-267`), but `studyService.js` does not pass `assignmentSettings.reviewTestSizeMin` / `reviewTestSizeMax`.
- Later, `DailySessionFlow.jsx:1246-1249` calls `buildTestConfig({ assignment: assignmentSettings, ... })`, and `testConfig.js:31` uses `assignment.testSizeReview` if present, otherwise default `30`.
- Because `studyService.js` does not put assignment min/max into `testSizeReview`, the configured min/max do not control this generated value unless some caller separately supplies `assignment.testSizeReview`.

So the practical answer is:

- `reviewTestSizeMin/Max` are stored.
- They are included in `testConfig` output metadata.
- They are not wired into `calculateReviewCount`.
- They are not wired into the `calculateReviewTestSize(...)` call in `initializeDailySession`.
- The effective review queue floor is hardcoded `15`; the review study cap is hardcoded `60`; the generated review test size defaults to the algorithm defaults unless `testSizeReview` is separately present.

### Server / throttle thresholds

I found no per-class review-score floor or throttle floor in the server path.

`functions/foundation.js:687-688` hardcodes:

- enter forced pathway below `0.30`
- exit forced pathway above `0.50`

`deriveThrottleModeServer(...)` consumes those constants. There is no per-assignment override in that server throttle helper.

Also, review queue sizing appears client/session-init-side here, not a server `completeSession` responsibility. The server completion path owns progress writes and mirrors forced-pathway decisions, but I did not find a server-side `calculateReviewCount` equivalent that consumes `reviewTestSizeMin`.

### Recommendation

If the product goal is “teacher can force a larger review quiz/study exposure,” I would not add a new score/throttle floor first. Use the existing `reviewTestSizeMin` / `reviewTestSizeMax` primitive, but make the semantics explicit.

Recommended small fix:

1. Wire assignment min/max into review test size: `calculateReviewTestSize(interventionLevel, assignmentSettings.reviewTestSizeMin, assignmentSettings.reviewTestSizeMax)`.
2. Decide whether `reviewTestSizeMin` should also be the review queue floor.
   - If yes, change `calculateReviewCount(recentSessions, reviewCap, reviewFloor = REVIEW_COUNT_MIN)` and call it with the assignment min.
   - Bound it as `Math.min(reviewCap, Math.max(reviewFloor, scoreBasedOrDefault))`, or explicitly define what happens when `reviewFloor > reviewCap`.
3. If the teacher-facing label says “review test size,” do not silently use it as a study-queue floor without updating copy/help text. Otherwise teachers will think they are changing only question count while actually increasing study load too.

I would avoid adding a new per-class score/throttle floor in this work item unless the CS ticket specifically asks for “trigger intervention sooner.” The reported issue sounds like “review amount too small,” which maps better to size/floor settings than to the intervention threshold model.

## B. Grader false-negatives on correct Korean

### Current implementation

`functions/index.js:1267-1336` uses a prompt that already says the grader is lenient and that Korean near-synonyms, typos, different POS translated words, and answers matching the Korean definition are correct.

The model call at `functions/index.js:1341-1343` is:

- `model: "claude-haiku-4-5-20251001"`
- `temperature: 0.1`

There is also a deterministic post-pass around `functions/index.js:1455-1464` that rejects the exact English target word or an English inflection/derivation. The comment correctly states this is ASCII-only by construction, so Korean translations should not be caught by that deterministic guard.

Therefore the likely root cause is not the post-filter. It is the model applying prompt Rule 1 too broadly despite the later leniency sentence.

### Provenance

Local provenance check:

- `git diff --name-only 0ddbb34..HEAD -- functions/index.js functions/foundation.js src/utils/studyAlgorithm.js src/services/studyService.js` returned no paths.
- `git show 0ddbb34:functions/index.js` contains the same relevant prompt text and `claude-haiku-4-5-20251001` model line.

Assuming the recorded live functions deploy SHA is still `0ddbb34`, the deployed function should be running the same grader prompt shown in current `functions/index.js`.

Caveat: this is a local repo/deploy-SHA consistency check, not a live Cloud Functions introspection. To close the 2026-06-29 “deploy lag” class of issue, the runbook should require recording the live functions deploy SHA/version immediately before interpreting grader behavior.

### Recommendation

Use a prompt-only fix first, then a rejection-only regrade fallback if the regression set still fails.

I would not move all grading from Haiku to Sonnet as the first step. The failure is a rule-scoping/ambiguity failure, not evidence that the model cannot do the task. A full model bump increases cost and latency on every answer, including easy ones.

Recommended order:

1. Prompt-only hardening:
   - Amend Rule 1 so “restating the word” applies only to English target-word copies or English inflections/derivations.
   - State explicitly that a direct Korean dictionary translation is not restating; it is the meaning and is correct.
   - State that Korean answers should not be rejected for being one-word/direct unless they are merely ad-hoc sound-it-out transliterations.
2. Add the exact CS examples to the prompt or a local regression fixture.
3. Run the regression set repeatedly against Haiku at `temperature: 0.1`.
4. If Haiku still rejects correct Korean translations, add a second-pass regrade only for rejected answers, preferably limited to CJK-containing responses or other high-risk false-negative patterns.
5. Use Sonnet only for that second-pass or for appeal/regrade, unless repeated regression runs show Haiku cannot meet the expected false-negative rate.

### Suggested prompt wording

Add something like this near Rule 1:

> Rule 1 only applies when the student response is the English target word itself or an English inflected/derived form. A Korean translation, even a direct one-word dictionary translation, is a meaning and must be marked CORRECT if it matches the English/Korean definition. Do not call a Korean translation “restating the word” unless it is only a nonstandard phonetic spelling of the English word and not a real Korean word/loanword.

Then add direct examples:

- `autobiographical` / student `자전적인` → correct.
- `indifferent` / student `무관심한` → correct.
- `dissonance` / student `불협화음` or a minor typo close to it → correct.
- `culminate` / student `요점` → wrong.
- `dispel` / student `express disapproval` → wrong.

### Regression set

Minimum fixture:

| Word | Student answer | Expected | Why |
|---|---:|---:|---|
| autobiographical | 자전적인 | correct | direct Korean meaning |
| indifferent | 무관심한 | correct | direct Korean meaning |
| dissonance | 불협화음 | correct | direct Korean meaning |
| dissonance | minor typo near 불협화음 | correct | typo tolerance |
| culminate | 요점 | wrong | “main point” is not “reach a climax/highest point” |
| dispel | express disapproval | wrong | confuses `dispel` with `disapprove` |
| piano | 피아노 | correct | established Korean loanword |
| grief | 그리프 | wrong | ad-hoc sound-out transliteration |
| run | running | wrong | English inflection of target |

Acceptance bar:

- Run the fixture multiple times, not once.
- Require zero false rejections for the known-correct Korean direct translations.
- Require zero false accepts for the known-wrong controls.
- Save raw model JSON and prompt/version/build metadata with the result.

## Bottom line

For the review floor item: the stored teacher min/max are not currently controlling the review queue floor, and they are not passed into the session-level review test size calculation either. Fix the existing size primitive before inventing a score/throttle floor.

For the grader item: the deployed/current prompt already tries to be lenient, but Rule 1 still needs sharper scoping. Start with prompt hardening plus a regression fixture; add rejection-only regrade if Haiku remains unstable; reserve full model bump for proven prompt-fix failure.
