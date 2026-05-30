# B05 — Daily Session Flow — Day 2+ Happy Path

**Priority:** P0
**Estimated duration:** 45–60 minutes
**Depends on:** B00, B04.
**Personas:** Careful Student.

## Goal

Day 2+ adds the review phases on top of new-word study/test. Get the phase transitions right.

## Scenarios

### S01 — Day 2 NEW_WORDS → NEW_WORD_TEST → REVIEW_STUDY → REVIEW_TEST → COMPLETE

1. (Set up): student passed Day 1 in B04. Today is Day 2 (or simulate the date advance).
2. Start session.
3. NEW_WORDS phase: 7 cards from words 7–13.
4. Auto-advance to NEW_WORD_TEST. Answer all correctly. Pass.
5. Auto-advance to REVIEW_STUDY: 10 cards from prior days.
6. Dismiss all review cards.
7. Auto-advance to REVIEW_TEST: 10 questions from review pool.
8. Pass.
9. COMPLETE phase shown. Click Continue. Dashboard.

### S02 — Verify currentStudyDay advanced to 2

1. After S01 success.
2. `class_progress.currentStudyDay = 2`.
3. `recentSessions` has 2 entries.
4. `streakDays = 2`.

### S03 — Day 2 with new-word failures (test passes, some words fail)

1. On the new-word test, deliberately answer 1 of 7 wrong.
2. Score = 6/7 = 0.857 < retakeThreshold (0.95). "Retake" appears.
3. Retake. Pass.
4. Verify `newWordFailedIds` properly handled (audit finding #4 — stale closure on `setNewWordFailedIds`).

**Failure → HIGH** if review queue doesn't include the failed new word.

### S04 — Day 2 review-test failures (review tests always pass regardless of score)

1. Take review test, answer 5/10 wrong.
2. Test "passes" anyway (per code: `passed = currentTestType === 'review' ? true : ...`).
3. Verify session completes.

### S05 — Day 3+ extended walk

1. Repeat Days 3, 4, 5 with happy answers.
2. Verify each day's `recentSessions` entry, intervention level, streak.

### S06 — Skip a day — Day N+2 after last study was Day N

1. Simulate the date advancing 2 days after the last session.
2. Start session.
3. The next day starts (Day N+1, not N+2 — the algorithm shouldn't skip).
4. streak: depends on studyDaysPerWeek and whether weekend break applies; verify exact expected value.

### S07 — Long-gap return: 10+ days idle

1. Simulate 10 days passing.
2. Start session.
3. Expected: session resumes at Day N+1 (no jump). Streak reset or preserved depending on studyDaysPerWeek + weekend logic.

### S08 — Session navigation: progress sheet

1. During REVIEW_STUDY, open the SessionProgressSheet drawer.
2. Verify it shows correct counts (cards remaining, dismissed, etc.).
3. Close. Continue.

### S09 — Quit mid-session

1. Day 3 session begun. NEW_WORDS phase, 3 cards dismissed.
2. Click Quit. Confirm.
3. Navigate to dashboard.
4. Tomorrow (simulate date advance), start session again.
5. Expected: starts at Day 3 NEW_WORDS again (the session was not "completed").

### S10 — Session resume after refresh during REVIEW_TEST

(Covered in B06 S09, link there.)

### S11 — Session completion writes correctly

After S01, verify the writes in Firestore:
- `class_progress.recentSessions` — last entry has correct fields.
- `class_progress.lastSessionAt` — Timestamp matches now.
- `class_progress.currentStudyDay = 2`.
- `class_progress.streakDays = 2`.
- `class_progress.interventionLevel` — calculated from recentSessions.
- Audit finding #5: completeSessionFromTest is not wrapped in withRetry. If a transient write fails, find a way to detect it (force a stall on the updateClassProgress endpoint during submit).

## Severity reminder

S01 / S02 = BLOCKER. S03 / S04 / S11 = HIGH. Others MEDIUM.
