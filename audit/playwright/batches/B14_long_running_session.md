# B14 — Long-Running Session

**Priority:** P1
**Estimated duration:** 60–120 minutes (some scenarios genuinely take a while).
**Depends on:** B00.
**Personas:** Distracted Student (idle), Lazy Student (abandons).

## Goal

Time-based bugs hide in long sessions. Auth tokens expire, recovery windows close, day boundaries cross, weekend skip logic kicks in. Test these on the real time axis where possible; use `Date.now` shimming where not.

## Scenarios

### S01 — 5-minute idle mid-test

1. Begin MCQ on `standardList`.
2. Answer 10 questions.
3. Stop interacting. Wait 5 real minutes.
4. Click on Q11. Verify: answer accepted, session still alive.
5. Submit. Verify: success.

**Failure → MEDIUM** if session auto-terminates or recovery state is gone.

### S02 — 1-hour idle (auth token refresh)

1. Begin test. Answer 5.
2. Stop. Wait 60+ minutes (real time, or `Date.now` shim).
3. Click on Q6. Verify: works.
4. Submit. Verify: token refreshed seamlessly.

If shimming Date.now alone isn't enough to trigger token refresh, manually call `await firebase.auth().currentUser.getIdToken(true)` and verify behaviour.

### S03 — Midnight rollover during test

1. Begin a session at 23:55 (simulated). Day-1 happy path.
2. Answer the new-word test slowly. Complete at 00:05 (5 min later, simulated).
3. Submit.
4. Verify: which "day" does the session belong to? recentSessions entry has what date?

**Spec:** typically the date stamp at submission time wins. Verify it's consistent and not split across two day entries.

### S04 — Weekend skip — Fri → Mon

1. Set up: list with studyDaysPerWeek=5 (M-F).
2. Day N completed on Friday.
3. Simulate Saturday: student opens dashboard. "No session today" or similar.
4. Simulate Sunday: same.
5. Simulate Monday: session for Day N+1 available, no streak break.

### S05 — Weekend skip — student tries to study on Saturday anyway

1. Continued from S04: on Saturday, try to force-start a session.
2. Expected: either disabled / no-op OR allowed with a warning ("Not a study day; you'll still progress").
3. Verify recentSessions has the Saturday entry if allowed.

### S06 — Multiple sessions in a single day

1. Day N completed (per B05 S01).
2. Same day, try to start again from dashboard.
3. Expected: blocked / shows "completed" indicator.
4. Try a "Practice Mode" if available.

### S07 — Long Typed test with AI grading taking many minutes

1. Begin Typed on `largeList` (or simulate it with the standard list and a stalled grading function).
2. Stall grading for 5 minutes (still within the 3 × 90s retry budget).
3. Verify the UI shows progress / spinner without appearing hung.
4. Eventually grading completes; submit succeeds.

### S08 — Student leaves test open for 30+ minutes, then submits

1. Begin MCQ. Answer all but don't submit.
2. Wait 30 min real (or simulate).
3. Click Submit. Verify: works. Auth still valid; submit completes; attempt has answers.

### S09 — Date change while test is in progress

1. Begin MCQ at 23:55 (sim).
2. Answer some. Date rolls to next day mid-test.
3. Submit at 00:10.
4. Verify: attempt's submittedAt and the recentSessions entry both reflect "next day" (since submit happened then), not "previous day."

### S10 — DST transition forward (March)

1. Simulate Saturday before DST.
2. Sunday morning: clocks jump forward 1 hour.
3. Verify: streakDays calculation handles the lost hour correctly. No off-by-one day.

### S11 — DST transition backward (November)

1. Same but for the gained hour.

### S12 — Streak break logic

1. Day N completed. Simulate N+2 (skipped a day with studyDaysPerWeek=7).
2. Verify: streakDays reset.

### S13 — Streak preservation across weekend

1. Day N (Friday) completed, streak = K.
2. Day N+1 (Monday) completed.
3. streak should be K+1, not 1 (weekend skip preserves streak).

### S14 — Recovery window expiration mid-test

Already covered in B06 S02.

### S15 — recentSessions length cap

1. Complete sessions for 15+ consecutive days.
2. Verify recentSessions is capped at `MAX_RECENT_SESSIONS` (probably 14 or 30).
3. Oldest entries dropped FIFO; stats recalculated correctly.

### S16 — currentStudyDay long-running

1. Simulate 100 days of sessions.
2. Verify currentStudyDay = 100, no overflow / type issues.

## Severity reminder

S03 / S09 / S10 / S11 = HIGH (date math). S07 / S15 = MEDIUM. Others LOW.
