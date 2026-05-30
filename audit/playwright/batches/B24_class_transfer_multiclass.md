# B24 — Class Transfer & Multi-Class Membership

**Priority:** P1
**Estimated duration:** 45–60 minutes
**Depends on:** B00, B22 (for the multi-day walk patterns).
**Personas:** Class-Switcher (the 민사랑 case), Careful Student in multi-class setup, Power Teacher.

## Why this exists

Chat-log pattern #6 — multiple student mid-program transfers caused day-progression chaos. The 민사랑 case (Jan 26 → Feb 1 in the log) bounced between CORE and TOP classes; required manual day-number patches each time.

The pattern: same vocab list is shared across multiple classes. A student in CORE who covers words 1–1280 has "Day 7" mean a different word set than the same-day-7 student in TOP whose list covers 1601–2400. Transferring mid-program creates a mismatch.

David noted the long-term plan is to separate lists per level ("여름 특강 때는 레벨별로 단어 list를 분리할 예정"). Until then, the audit must verify the workaround behavior.

## Scenarios

### S01 — Single student in two classes simultaneously

1. Student `carefulStudent` enrolled in `primaryClass` (with `standardList`) and `secondaryClass` (with `largeList`).
2. Dashboard: shows both classes, both lists.
3. Primary focus: defaults to most recently assigned.
4. Switch primary focus between the two; verify dashboard updates.
5. Walk Day 1–5 in primary list, then switch to secondary, walk Day 1–5 there.
6. Verify both progress states preserved independently.

**Pass criteria:** No cross-contamination. Each list has its own currentStudyDay, recentSessions, etc.

### S02 — Same list across two classes

1. Power Teacher: assign `standardList` to BOTH primaryClass and secondaryClass.
2. Student enrolled in both classes.
3. Take a Day 1 session.
4. Question: does this count toward primaryClass-standardList or secondaryClass-standardList?
5. Verify the attempt doc's `classId` is set correctly (probably to whichever class the student was viewing when they started the session).
6. Verify only ONE class_progress doc updated for that day.

**Pass criteria:** Deterministic class assignment; no double-counting.

### S03 — Mid-program class transfer (CORE → TOP)

**Persona:** Class-Switcher (mimics 민사랑)

1. Setup: student enrolled in `coreClass` (with a CORE-style list, words 1280–1600 worth).
2. Walk Day 1 → Day 7 in CORE class. CSD = 7.
3. Teacher unenrolls student from CORE class.
4. Teacher enrolls student in `topClass` (with a TOP list, words 1601–2400).
5. Student logs in. Dashboard: only TOP class visible? Or CORE still showing (with no available actions)?
6. Start session on TOP list.
7. Expected (per david's note in log): TOP list starts at Day 1 — student sees words 1601–1680 (or first batch from new list).
8. Walk Day 1 → Day 5 in TOP class. CSD for TOP-list = 5; CSD for CORE-list = 7 (preserved or removed depending on transfer policy).

**Pass criteria:** Either preserved-but-inactive OR cleanly removed, but never half-removed (the data corruption case).
**Failure → HIGH** if transfer leaves the student in a confused state.

### S04 — Class transfer with same list shared

1. Setup: student in `coreClass` with `standardList`. Walks Day 1 → 7. CSD = 7.
2. Teacher unenrolls from CORE, enrolls in `topClass`. `topClass` ALSO has `standardList` assigned.
3. Student logs in.
4. Question: does Day 7 progress carry over to topClass-standardList view? Or restart at Day 1?
5. Per code (progress is per user+class+list keyed): `topClass_standardList` would be a NEW doc → student starts at Day 1.

**Document the behavior, regardless of which it is.** Expected per design: starts at Day 1 in new class. Pass criteria: behavior is consistent and predictable.

### S05 — Student re-enrolled in same class after leaving

1. Student in `primaryClass`. Walks Day 1–5.
2. Teacher removes student. Student loses access.
3. Teacher re-adds student.
4. Student logs in. Dashboard shows primaryClass again.
5. Walk Day 6 session.
6. Expected: CSD continues at 6 (the class_progress doc persisted through removal).

**Pass criteria:** Progress survives re-enrollment.

### S06 — Multiple students join class via same code

1. New `primaryClass` with joinCode "ABCDEF".
2. 5 different new students enter "ABCDEF" within 10 seconds.
3. All 5 enroll successfully.
4. `class.studentCount = 5` (not 1 or 10 due to race).
5. `class.studentIds` array has all 5.

**Failure → HIGH** per audit finding #15 if studentCount drifts.

### S07 — Student tries to join class they're already in

1. Student in primaryClass.
2. Re-paste primaryClass joinCode.
3. Expected: clear "Already enrolled" message; no duplicate enrollment.

### S08 — Student joins class with deleted list

1. Power Teacher: assign listX to primaryClass, then delete listX entirely.
2. Student joins primaryClass.
3. Dashboard: shows class with no available lists. Empty state OR error?
4. Should NOT crash.

### S09 — Class deleted while student has session open

1. Student `carefulStudent` mid-session in `secondaryClass`.
2. Teacher deletes secondaryClass.
3. Student tries to submit current test.
4. Expected: clear error; submission goes to a placeholder OR is rejected with a clear message.

**Failure → BLOCKER** if test submission silently fails (student loses test).

### S10 — List unassigned from class mid-session

1. Student starts Day 4 session on listA in classA.
2. Mid-session, teacher unassigns listA from classA.
3. Student tries to submit.
4. Expected: same as S09 — clean error or graceful degradation.

### S11 — Concurrent class join from same user

1. Student opens two tabs, both navigate to dashboard.
2. Both attempt to join same class via joinCode.
3. Verify only one membership doc created.

**Pass criteria:** audit finding #15 — idempotent joinClass.

### S12 — Student in 5+ classes (load shape)

1. Set up a student enrolled in 5 different classes with 1-2 lists each.
2. Dashboard renders all 5.
3. List selector shows ~10 lists.
4. Pick each as primary; verify it sets correctly.
5. No performance degradation visible.

### S13 — Teacher removes student mid-test

1. Student takes Day 4 test in primaryClass.
2. During test, teacher removes student from class.
3. Student submits.
4. Expected: submit succeeds because the test attempt already has classId baked in. But next session attempt should be blocked.

### S14 — Same list, two different paces in two classes

1. classA assigns standardList with pace=7.
2. classB assigns standardList with pace=3.
3. Student enrolled in both.
4. Walking the list via classA shows 7 new words per day.
5. Walking the list via classB shows 3 new words per day.
6. CSDs are independent.

**Pass criteria:** Per-class assignment settings respected.

### S15 — Transfer preserves attempt history

1. Student in classA, walks Day 1-5. Has 5 attempt docs with classId=classA.
2. Teacher transfers to classB.
3. Old attempt docs still exist with classId=classA (immutable historical record).
4. New attempts in classB have classId=classB.
5. Student dashboard shows progress in classB only (current).
6. Teacher gradebook for classA still shows the old attempts.

**Pass criteria:** History preserved; current-state isolated.

## Severity reminder

S03 / S09 / S10 = HIGH. S04 = MEDIUM (depends on design intent). S06 / S11 = HIGH per audit. Others MEDIUM/LOW.
