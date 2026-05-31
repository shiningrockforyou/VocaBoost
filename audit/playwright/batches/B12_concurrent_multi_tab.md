# B12 — Concurrent & Multi-Tab

**Priority:** P1
**Estimated duration:** 60–90 minutes
**Depends on:** B00, B02 or B03 for the test flows.
**Personas:** Hostile Student, Power Teacher, Anxious Teacher.

## Goal

The audit flagged read-modify-write hazards across:
- `updateClassProgress` (no transaction, double-completion possible)
- `updateAssignmentSettings` (clobbers concurrent edits)
- `joinClass` (not idempotent, double-counts)
- `submitChallenge` (multi-doc non-atomic)

Multi-tab is the most realistic way students/teachers hit these. Each scenario sets up two Playwright contexts (or one context with two pages) and races them.

## Scenarios

### S01 — Two tabs, same user, same test

1. Tab A and B both log in as `careful`.
2. Both navigate to MCQ on `tinyList`.
3. Tab A: answer 3, submit.
4. Tab B: answer 5 (different), submit.
5. Inspect Firestore.

Acceptable outcomes:
- A submitted first; B's submit either overwrote A's (same nonce — setDoc replaces) or was rejected.
- One attempt doc, one timesTestedTotal increment per word.

Unacceptable:
- Two attempt docs.
- timesTestedTotal=2 per word.

### S02 — Two tabs, same user, different lists

1. Tab A: take test on `tinyList`.
2. Tab B: take test on `standardList`.
3. Each submits.
4. Expected: two separate attempt docs (different testIds → different nonces → different docIds).

### S03 — Two students same time

1. Tab A: `careful` takes test.
2. Tab B: `rushed` takes a DIFFERENT test on a different list (so processTestResults doesn't touch overlapping study_states).
3. Both submit. Verify no cross-contamination.

### S04 — Two students same time, overlapping lists

1. Tab A: `careful` takes test on `standardList`.
2. Tab B: `rushed` takes test on `standardList` (same list, different per-student study_states).
3. Both submit. Verify each student's study_states are isolated.

### S05 — joinClass race

1. Tab A and B: same student. (Use a fresh account not in primaryClass.)
2. Both navigate to dashboard, paste joinCode for primaryClass.
3. Both click Join near-simultaneously.
4. Inspect class doc:
   - `studentCount` incremented by 1, not 2 (audit-suspect).
   - `studentIds` array has the student once.
   - Member subcollection has one doc.

**Failure → HIGH** if studentCount = +2.

### S06 — updateClassProgress race

1. Tab A and B: same student logged in.
2. Both navigate to a session that's at REVIEW_TEST phase.
3. Submit at roughly the same time.
4. Both submit invoke `updateClassProgress`. The audit-flagged race: both read stale `currentStudyDay = N`, both compute `N+1`, both write.
5. Expected: `currentStudyDay = N+1` (not N+2). recentSessions has one entry for today (not two).

**Failure → HIGH** if double-day advance or double recentSessions.

### S07 — updateClassProgress with stale expectedDay guard

1. Tab A: completes session, currentStudyDay → N+1.
2. Tab B (started earlier, holds stale data): submits its completion attempt. Its `sessionSummary.day = N` (stale).
3. The guard at progressService.js:332 should detect mismatch and silently drop the update.
4. Audit finding #16: this silent drop loses recentSessions update from Tab B.
5. Verify: recentSessions has only A's entry.

### S08 — Teacher: two tabs editing same class assignments

1. `powerTeacher` opens primaryClass in tabs A and B.
2. Tab A: edit pace for `tinyList` to 10.
3. Tab B: edit pace for `standardList` to 5.
4. Both save.
5. Inspect class doc: both updates present (or one is clobbered).

**Audit-flagged outcome:** one update clobbers the other because both write back the whole `assignments` map after reading stale snapshot.
**Failure → HIGH** if clobbering.

### S09 — Teacher: two tabs editing same list

1. `powerTeacher` opens `standardList` in editor in tabs A and B.
2. Tab A: change word 5's definition.
3. Tab B: change word 10's definition.
4. Both save.
5. Verify both updates persisted (per-word writes don't clobber).

### S10 — Teacher: simultaneous batchAddWords

Power-user-like:
1. Two tabs, both attempt to import a CSV to the same list (say 100 words each).
2. Both submit.
3. Verify final word count = 200, no position collisions.

**Audit-suspect:** position assignment in `batchAddWords` reads wordCount once at start; two concurrent imports get the same starting position → duplicate positions.

### S11 — Reviewing challenges from two tabs

1. `powerTeacher` opens gradebook → pending challenges.
2. Tab A: accepts dispute 1.
3. Tab B (before A's writes propagate): accepts the same dispute.
4. Verify behaviour: second accept either errors ("already reviewed") OR is idempotent. Either is OK.
5. Audit-concern: the day-advancement branch in reviewChallenge could double-fire and double-increment currentStudyDay.

**Failure → HIGH** if currentStudyDay is double-incremented.

### S12 — Hostile student writes another student's study_states

1. `hostile` opens devtools.
2. `await firebase.firestore().doc('users/<carefulStudentUid>/study_states/<wordId>').set({ status: 'FAILED' })`.
3. Expected: PERMISSION_DENIED (per the recent rule tightening if it covered this; if not, this would succeed pre-fix).
4. Verify the careful's data is unchanged.

### S13 — Hostile student writes another student's class_progress

1. `hostile` devtools.
2. `await firebase.firestore().doc('users/<carefulStudentUid>/class_progress/<docId>').update({ currentStudyDay: 999 })`.
3. Expected: PERMISSION_DENIED.

**Per recent C1 fix:** this should now be denied. If it succeeds, the fix didn't land — BLOCKER.

### S14 — Hostile student tries to modify their own attempt's score

1. Take an MCQ as `hostile`. Score 40%.
2. devtools: `await firebase.firestore().doc('attempts/<id>').update({ score: 100, passed: true })`.
3. Expected: PERMISSION_DENIED (per C3 fix — `hasOnly(['answers'])`).

**Per recent C3 fix:** denied. If succeeded → BLOCKER.

### S15 — Tab A is unauthenticated, Tab B is authenticated

1. Tab A: logged out.
2. Tab B: logged in as a student.
3. From tab A, try to navigate to /dashboard.
4. Expected: redirect to /login (no leak).

## Severity reminder

S05 / S06 / S07 / S08 / S10 / S11 = HIGH. S12 / S13 / S14 = BLOCKER if any succeeds (security regression). Others MEDIUM.
