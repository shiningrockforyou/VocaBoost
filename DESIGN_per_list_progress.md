# Design Spec: Per-List Progress (decouple progress from class)

Status: PROPOSAL (do AFTER current term stabilizes; needs emulator + staging test + data migration). Not a hotfix.

## 1. Problem
A student's learning state is split across two stores that disagree:
- **Word mastery** (`users/{uid}/study_states/{wordId}`, has a `listId` field) — already keyed per **(student, word)** → effectively **per-(student, list)**, shared across all classes on that list.
- **Progress pointer** (`users/{uid}/class_progress/{classId}_{listId}`: currentStudyDay, totalWordsIntroduced, recentSessions, interventionLevel, programStartDate) — keyed **per-(class, list)**.

When a student changes class (or is dual-enrolled) on the same list, mastery persists but the progress pointer RESETS to Day 1. This mismatch is the root cause of: class-move resets, dual-enrollment corruption (정주하), re-introduce overwriting MASTERED→NEW, and the manual migrations we keep doing.

## 2. Goal
Student progress on a **list** persists regardless of class — while class-specific pacing still applies.

## 3. Model (what moves where)
Split state by what it actually belongs to:

| Persist per **(student, list)** | Keep per **class** (assignment config) |
|---|---|
| Word mastery (`study_states`) — already here | `pace`, `studyDaysPerWeek` |
| **`totalWordsIntroduced` (TWI) = absolute position in the list** | `passThreshold` |
| `recentSessions`, `interventionLevel` (learning behavior) | `testMode`, `testSizeNew/Review`, `optionsCount` |
| `lastStudyDate`, `streakDays` | `programStartDate` (per-class enrollment date) |

**Key principle: TWI (absolute word index reached) is the source of truth, not a class-relative "day".**
Derive the current day from TWI + the class's pace:
```
currentDayInClass = Math.floor(TWI / classPace) + 1   // when sitting between days
// a day is "complete" when TWI >= day*classPace AND that day's review is done
```
So "Day 6" at pace 80 and "Day 8" at pace 60 can both be the same TWI=480 position — the day label is class-relative, the position is absolute. Two classes on one list with different paces resolve cleanly: same TWI, different day numbers.

## 4. Concrete changes
1. **New doc:** `users/{uid}/list_progress/{listId}` holding: `totalWordsIntroduced`, `recentSessions`, `interventionLevel`, `lastStudyDate`, `streakDays`, `updatedAt`. (Mastery stays in `study_states` as-is.)
2. **`getOrCreateClassProgress(classId, listId)` → `getOrCreateListProgress(uid, listId)`** + a thin per-class view that computes day/pacing from list_progress + the class's assignment config.
3. **Reconciliation queries attempts by `(studentId, listId)` across ALL classes**, not `(studentId, classId, listId)`. Anchor = most-recent passed new test for the list (any class). This is the central change — today it's class-scoped (`getMostRecentPassedNewTest`, `getReviewForDay` filter by classId; drop the classId filter, key by listId).
4. **Attempts**: keep writing `classId` (for gradebook attribution), but progress/reconciliation read by `listId`. "Day complete" = a passed new test for that TWI band + a review attempt for that band, regardless of which class produced them.
5. **Session init** (`initializeDailySession`): `newWordStartIndex = list_progress.TWI`; day number derived from TWI + this class's pace; thresholds/testMode from this class's assignment.
6. **`initializeNewWordStates`**: only create states for words with NO existing state (use a create-if-absent, not `set(..,{merge:true})` with `status:NEW`) — so re-entry on a shared list never resets MASTERED→NEW. (This is a correctness fix worth doing even independently.)
7. **Gradebook/ClassDetail**: a class shows each student's true list position (may be earned partly in another class). Acceptable/】better; document the semantic change.

## 5. One-time data migration
For each (student, listId): merge all existing `class_progress/{*}_{listId}` docs into one `list_progress/{listId}`:
- `TWI = max(totalWordsIntroduced)` across the student's classes on that list.
- `recentSessions` = the set from the class with the highest TWI (most advanced).
- `interventionLevel`, `lastStudyDate`, `streakDays` = from the most-advanced class.
- Keep the old `class_progress` docs read-only for a release (rollback safety), then retire.
Idempotent; dry-run first (log proposed list_progress per student, diff against current), then apply.

## 6. Edge cases
- **Different lists in different classes** → naturally separate list_progress docs; no conflict. ✓
- **Two classes, same list, different pace** → one TWI; each class renders its own day number from its pace. ✓
- **Dual-active student** (progressing in two classes on one list) → both advance the SAME list_progress; no divergence (this is the fix — today they diverge). ✓
- **Threshold differs between two classes on one list** → pass/fail uses the class the test was taken in (attempt carries classId → look up that class's threshold). ✓
- **A student demoted/repeating** → if a teacher wants a fresh start, that becomes an explicit "reset list progress" admin action, not an accidental side effect of enrollment.

## 7. Risks / testing
- Highest-blast-radius change in the app: a migration bug corrupts everyone's progress. MUST: dry-run migration with diff report; emulator tests for reconciliation-by-list; staging cohort; deploy in a low-traffic window; keep old docs for rollback.
- Reconciliation-by-list must be exhaustively tested against multi-class students (the very cases that break today).

## 8. Interim (low-effort, ship anytime): "move student" admin helper
Until the refactor lands, productize the manual move:
- Input: studentEmail, fromClass, toClass (must share the list).
- Action: copy `class_progress` from→to (it survives reconciliation via Math.max when the target has no attempts), clear the target's stale session_state, and unenroll from the source.
- Guard: refuse if the two classes use different lists (true continuation impossible).
This kills the move pain without touching the core. (It's exactly the script flow used manually on 2026-06-16.)

## 9. Sequencing
1. Now: ship pending hotfix/patches; keep manual moves.
2. Soon: the create-if-absent fix for `initializeNewWordStates` (#6) — small, removes the MASTERED→NEW reset corruption independently.
3. Soon: the "move student" helper (#8).
4. Post-term: the full per-list refactor (#3–#5) with migration + tests.
