# B04 — Daily Session Flow — Day 1 Happy Path

**Priority:** P0
**Estimated duration:** 30–45 minutes
**Depends on:** B00.
**Personas:** Careful Student.

## Goal

The first study day on a fresh list is a unique flow (no prior segment, no review queue). Get this clean before testing later days.

## Scenarios

### S01 — Day 1 NEW_WORDS phase: study + dismiss

1. Log in as a fresh-state student. Pick a list with no prior progress.
2. Click "Start Today's Session."
3. NEW_WORDS phase begins. Verify segment is `[words 0..pace-1]` (default pace=7 means 7 cards).
4. For each card, click "I know it" or "Show definition" → "Got it" (depending on UI), and dismiss.
5. After 7 cards: phase auto-advances to NEW_WORD_TEST.

### S02 — Day 1 NEW_WORD_TEST

1. Continued from S01. MCQ test launches for the 7 new words.
2. Answer all correctly. Click Submit.
3. Score ≥ retakeThreshold (default 0.95). Test passes.
4. Results screen → click Continue.

### S03 — Continue after Day 1 test pass

1. Continued. Phase becomes COMPLETE (Day 1 doesn't have a review phase).
2. Verify `currentStudyDay` advanced from 0 to 1 in `class_progress`.
3. Verify `recentSessions` has one entry for today with the right `wordsIntroduced`, `score`, `passed=true`.
4. Verify `streakDays = 1`.

### S04 — Day 1 test fail → retake

1. Same fresh state. Answer test with score < retakeThreshold.
2. Test ends. "Retake" button visible.
3. Click Retake. Test reloads with same words (no new ones).
4. Pass this time.

### S05 — Day 1 dashboard reflection

1. After S03 success, return to dashboard.
2. Verify primary focus list shows `Day 1 complete` indicator (or whatever the actual UI is).
3. The 7-day activity bar shows today's bar filled.

### S06 — Day 1 with practice mode after pass

If practice mode available:
1. After S03, return to test screen, choose "Practice Mode."
2. Practice runs locally, no Firestore writes, no attempt doc.

### S07 — Day 1 with very small list (smaller than pace)

If `tinyList` has only 5 words and pace is 7, the segment is just 5.
1. Same flow; segment is 5, test is 5 questions.

### S08 — Day 1 abandoned mid-NEW_WORDS

1. Start, dismiss 3 of 7 cards.
2. Navigate away to dashboard.
3. Return: resume from card 4.

### S09 — Day 1 done, try to start again

1. After S03, on the dashboard, click "Start Today's Session" again.
2. Expected: a "You've completed today's session" message, OR practice mode offered, but NOT a new attempt of Day 1.

## Severity reminder

S01–S03 = BLOCKER if broken. Others HIGH/MEDIUM.
