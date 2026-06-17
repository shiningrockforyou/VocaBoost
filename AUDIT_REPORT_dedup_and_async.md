# VocaBoost Dedup + Async Grading Audit Report

Date: 2026-06-17  
Branch: `main`  
HEAD: `7e015d2`  
Scope: live VocaBoost source on current branch; `src/apBoost` intentionally excluded except where grep output accidentally surfaced it.  
Mode: audit only; no source fixes made.

## Verification Notes

- `npm run build` could not complete because Rollup's optional native package is missing from `node_modules`: `Cannot find module @rollup/rollup-linux-x64-gnu`. This is an environment/dependency install issue, not a source finding. Build/lint behavior remains unverified in this pass.
- The worktree is dirty with user-applied changes in `src/pages/DailySessionFlow.jsx`, `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`, help docs, and `change_action_log.md`, plus untracked design/brief docs. I audited the current files as-is and did not revert or edit them.

## Executive Summary

The 2026-06-17 emergency fixes are mostly present in live code: the Day-2+ failed-new-test back-button bypass is now gated before review (`src/pages/DailySessionFlow.jsx:1346`-`1355`), test pages now inspect `completeSessionFromTest()` returning `requiresNewWordRetake` (`src/pages/TypedTest.jsx:870`-`875`, `src/pages/MCQTest.jsx:737`-`742`), Fix H's study-day fallback exists in both test pages (`src/pages/TypedTest.jsx:713`-`755`, `src/pages/MCQTest.jsx:536`-`591`), and #7's attempt-authoritative resume is in place (`src/pages/DailySessionFlow.jsx:813`-`827`).

The architecture is still fragile. The current async-grading design is directionally correct only if it replaces the existing client-grading path, not if it layers beside it. Today, typed tests still grade first through a callable function, then write the attempt (`src/pages/TypedTest.jsx:689`-`690`, `src/pages/TypedTest.jsx:758`-`785`), and `submitTypedTestAttempt()` still rejects calls without finished `gradingResults` (`src/services/db.js:1301`-`1303`). That is the opposite persistence order from the async design.

Top risks:

1. Completion gate can still write `session_state.phase = complete` before deciding the day must not complete (`src/services/studyService.js:1173`-`1197`).
2. `getNewWordAttemptForDay()` does not filter by `listId`, so same-class multi-list students can have the wrong list's new-word pass used for review stamping or completion gating (`src/services/db.js:2980`-`2995`).
3. Firestore rules currently allow students to create attempt docs with arbitrary score/pass/graded fields as long as `studentId` is their uid (`firestore.rules:101`-`102`), which is unacceptable for server-authoritative async grading.
4. Threshold, pass verdict, study-day derivation, attempt write, and completion remain duplicated across TypedTest and MCQTest (`src/pages/TypedTest.jsx` is 1570 LOC; `src/pages/MCQTest.jsx` is 1438 LOC).
5. Required composite indexes for reconciliation/current-day queries are not committed in `firestore.indexes.json`; only teacher attempt indexes exist for VocaBoost attempts (`firestore.indexes.json:3`-`34`).

## Findings

### Blocker: Day completion writes `COMPLETE` before the failed-new-test gate returns

What: `completeSessionFromTest()` writes session state as complete before it checks whether Day-2+ has an authoritative passing new-word attempt.

Where: `src/services/studyService.js:1173`-`1179` writes `phase: SESSION_PHASE.COMPLETE`; `src/services/studyService.js:1182`-`1197` then returns `requiresNewWordRetake: true` if the new-word test is not passed.

Why it matters: The callers now stop presenting completion on `requiresNewWordRetake` (`src/pages/TypedTest.jsx:870`-`875`, `src/pages/MCQTest.jsx:737`-`742`), but the durable display/cache state has already been stamped complete. #7 no longer trusts `session_state.phase` for routing (`src/pages/DailySessionFlow.jsx:813`-`827`), so this is less catastrophic than before, but it still creates contradictory state that can confuse UI, support tooling, teacher/admin inspection, and future code.

Repro/reasoning: Any Day-2+ review completion path that lacks a passing new attempt reaches the save at `1173` before the gate at `1187`.

Concrete fix: Move the Day-2+ gate before the `saveSessionState(... phase: COMPLETE ...)` write. For async grading, make completion a server-authoritative operation that only writes complete after a graded passing new attempt and review attempt are both present for the same `{studentId, classId, listId, studyDay}`.

### Blocker: Async design requires stricter attempt writes/rules than current source provides

What: The async design says the client writes a pending typed attempt, the server grades it, and the client listens. Current code still does client callable grading first, then writes a fully graded attempt. Current rules also allow client-created attempts to contain arbitrary graded fields.

Where: `src/pages/TypedTest.jsx:689`-`690` calls `gradeWithRetry()` before persistence; `src/pages/TypedTest.jsx:758`-`785` writes the attempt after grading; `src/services/db.js:1301`-`1303` requires `gradingResults`; `src/services/db.js:1374`-`1382` writes `score`, `graded: true`, `answers`, `passed`, and `submittedAt`; `firestore.rules:101`-`102` permits any create where `request.resource.data.studentId == request.auth.uid`.

Why it matters: If async is added without deleting this path, typed tests will have two grading sources and two verdict sources. If pending attempt creation is added under current rules, a malicious or buggy client can create "server-graded" looking attempts.

Concrete fix: Introduce a dedicated pending-attempt writer that accepts raw answers only and writes `gradingStatus: 'pending'`, `score: null`, `passed: null`, `graded: false`, `gradingMeta`, and deterministic attempt id. Update rules so students can only create pending attempts with an allowlisted schema; only Cloud Functions/Admin SDK can set `score`, `passed`, `graded`, AI reasoning, and terminal `gradingStatus`.

### High: `getNewWordAttemptForDay()` is not list-scoped

What: The helper finds a student's new-word attempt by `studentId`, `classId`, `sessionType`, and `studyDay`, but not `listId`.

Where: `src/services/db.js:2980`-`2995`.

Why it matters: Same-class multi-list students can have two attempts with the same `studyDay`. The latest submitted attempt from another list can be treated as the current list's new-word pass. This helper is used by the Day-2+ completion gate (`src/services/studyService.js:1153`-`1164`) and by both test pages' study-day derivation (`src/pages/TypedTest.jsx:727`-`728`, `src/pages/MCQTest.jsx:555`-`556`).

Concrete fix: Change signature to `getNewWordAttemptForDay(userId, classId, listId, studyDay)` and add `where('listId', '==', listId)`. Update all callers. Commit/deploy the needed composite index.

### High: Required attempt indexes are missing from committed `firestore.indexes.json`

What: Reconciliation and phase helpers use composite attempt queries not present in the checked-in index file.

Where: committed VocaBoost attempt indexes only cover `teacherId + submittedAt` and `teacherId + classId + submittedAt` (`firestore.indexes.json:3`-`34`). Missing query shapes include `studentId + classId + listId + submittedAt` (`src/services/db.js:3032`-`3038`), `studentId + classId + listId + sessionType + passed + studyDay` (`src/services/db.js:3147`-`3155`), and `studentId + classId + listId + sessionType + studyDay` (`src/services/db.js:3198`-`3205`).

Why it matters: Missing indexes turn reconciliation and recovery into "return empty / skip" behavior in some paths (`src/services/db.js:3052`-`3075`), which can preserve stale or wrong progress rather than correcting it.

Concrete fix: Export and commit all production indexes needed by these queries before relying on reconciliation/async routing.

### High: Threshold resolution remains duplicated and partly inconsistent

What: Dangerous Path B threshold mislabeling appears fixed, but threshold logic still exists in many places with different fallback chains and units.

Where: centralized builder uses `assignment.passThreshold ?? 95` and `passThreshold / 100` (`src/utils/testConfig.js:29`-`58`); DailySessionFlow derives `newWordRetakeThreshold` from assignment pass threshold (`src/pages/DailySessionFlow.jsx:591`-`598`) but autosave recomputes pass with `sessionConfig?.retakeThreshold || 0.95` (`src/pages/DailySessionFlow.jsx:308`-`311`); study service uses `assignmentSettings.newWordRetakeThreshold || DEFAULT_RETAKE_THRESHOLD` (`src/services/studyService.js:229`-`232`); standalone Typed/MCQ initialize sessions with `DEFAULT_RETAKE_THRESHOLD` even after reading `assignment.passThreshold` for UI state (`src/pages/TypedTest.jsx:352`-`369`, `src/pages/MCQTest.jsx:295`-`315`); Dashboard PDF/session payloads hardcode `newWordRetakeThreshold: 0.95` (`src/pages/Dashboard.jsx:1800`, `src/pages/Dashboard.jsx:1835`).

Why it matters: The code can display one threshold, compute a pass verdict with another, and initialize a session with a third. This previously caused 92-94% passers in 92%-threshold classes to see the wrong result; the same class of bug remains possible in non-primary launch paths.

Concrete fix: Extract one helper, for example `resolvePassThresholdFraction(assignmentOrSettings)`, accepting percent or fraction safely and returning a fraction. Use it in `buildTestConfig`, `initializeDailySession` callers, `completeSessionFromTest` fallback, challenge recalculation, Dashboard launches, and result copy. In async, the client should not own the verdict; it should only display the server-written threshold/verdict.

### High: Async `AWAITING_GRADE` is not yet represented in the VocaBoost flow

What: No VocaBoost `AWAITING_GRADE` phase/status exists in current client/session code.

Where: `SESSION_PHASE` only has `NEW_WORDS_STUDY`, `NEW_WORDS_TEST`, `REVIEW_STUDY`, `REVIEW_TEST`, and `COMPLETE` (`src/services/sessionService.js:26`-`31`). DailySessionFlow maps the same five phases (`src/pages/DailySessionFlow.jsx:291`-`297`). VocaBoost source has no `gradingStatus`/`AWAITING_GRADE` references outside APBoost and unrelated functions scoring helpers.

Why it matters: A pending typed grade must block review and completion without looking like a failure or a fresh unsubmitted test. Without a distinct state, refresh/resume will either show a retake path or accidentally progress based on stale session data.

Concrete fix: Add derived `AWAITING_GRADE` to phase resolution, not necessarily as a trusted `session_state.phase`. It should be derived from an attempt for `{studentId,classId,listId,studyDay,sessionType:'new', gradingStatus in ['pending','in_progress']}`. Rendering should show pending/teacher fallback UI and disable review/complete.

### Medium: Fix H is applied, but as duplicated inline logic with a shared helper dependency bug

What: Study-day fallback and stale-context guard now exist in both TypedTest and MCQTest, but they are copy-pasted and both depend on the list-unscoped `getNewWordAttemptForDay()`.

Where: Typed fallback and stale-context guard: `src/pages/TypedTest.jsx:713`-`755`; MCQ fallback and stale-context guard: `src/pages/MCQTest.jsx:536`-`591`.

Why it matters: The immediate wrong-day bug is reduced, but any future correction must be made twice, and both copies can still make a wrong decision for same-class multi-list students because the helper ignores `listId`.

Concrete fix: Extract `deriveAttemptStudyDay({ userId, classId, listId, testType, sessionContext })`, fix the helper to include `listId`, and have both test pages call the same function until the pages are consolidated.

### Medium: TypedTest and MCQTest remain large twins with duplicated critical workflows

What: The two pages independently implement config loading, threshold resolution, study-day derivation, deterministic attempt id, retry submission, processTestResults, completion handling, result-card pass logic, and recovery cleanup.

Where: `src/pages/TypedTest.jsx` is 1570 lines; `src/pages/MCQTest.jsx` is 1438 lines. Shared logic examples: threshold Path A/B/standalone (`src/pages/TypedTest.jsx:282`-`386`, `src/pages/MCQTest.jsx:240`-`331`), pass verdict (`src/pages/TypedTest.jsx:711`, `src/pages/MCQTest.jsx:532`), attempt id/write (`src/pages/TypedTest.jsx:763`-`785`, `src/pages/MCQTest.jsx:604`-`636`), completion-return guard (`src/pages/TypedTest.jsx:870`-`875`, `src/pages/MCQTest.jsx:737`-`742`).

Why it matters: This is the main reason reactive production fixes land in one path and not the other. It also makes async grading risky because the replacement must remove logic from both pages.

Concrete fix: Extract, in order: `useTestConfigResolution`, `deriveAttemptStudyDay`, `submitAttemptAndApplyResults`, `completeSessionAfterAttempt`, and a shared results shell. Keep MCQ question generation and typed input/grading UI separate.

### Medium: Attempt idempotency is mostly good in normal pages, but the DB functions still allow random fallback ids

What: Both test pages use deterministic `attemptDocId = userId_testId_nonce` before calling submit functions (`src/pages/TypedTest.jsx:763`-`781`, `src/pages/MCQTest.jsx:604`-`632`). The DB functions still fall back to random ids if a caller omits `attemptDocId`.

Where: MCQ fallback: `src/services/db.js:1242`-`1248`; typed fallback: `src/services/db.js:1397`-`1402`.

Why it matters: Async grading needs exactly-once semantics for a submitted test. A new caller, retry path, or teacher fallback that omits the deterministic id can create duplicate attempts and duplicate grading jobs.

Concrete fix: For async pending typed attempts, require deterministic ids and reject missing `attemptDocId`. Consider making current submit helpers reject missing ids for non-practice class/list tests.

### Medium: Challenge/manual override threshold logic still uses duplicated percent defaults

What: `reviewChallenge()` recalculates pass status by fetching assignment pass threshold with a `95` fallback.

Where: `src/services/db.js:2659`-`2675` and `src/services/db.js:2730`-`2740`.

Why it matters: It is another threshold authority. It currently works in percent units because attempts store percent scores, but it can diverge from future threshold helper behavior or async server verdicts.

Concrete fix: Use the same server/client shared threshold resolver or move challenge pass recomputation to a Cloud Function with the async grading authority.

### Nitpick: Change log contains superseded/contradictory same-day status

What: `change_action_log.md` has a row saying Fix H was not yet applied, then another row saying Fix H was applied.

Where: applied row at `change_action_log.md:9`; older/superseded note at `change_action_log.md:10`.

Why it matters: It made audit triage harder. Live code confirms H is present in both pages.

Concrete fix: Add a short supersession note or keep newest entries strictly ordered with status transitions.

## Regression Check Against 2026-06-17 Rows

- Fix #1, in-session retake guard: confirmed present. Day-2+ return from new test now checks `results.score >= passThreshold` before `moveToReviewPhase()` (`src/pages/DailySessionFlow.jsx:1346`-`1355`).
- Fix #2, completion return handling: confirmed present in both test pages (`src/pages/TypedTest.jsx:870`-`875`, `src/pages/MCQTest.jsx:737`-`742`). Residual issue: `completeSessionFromTest()` still writes complete before returning the retake signal (`src/services/studyService.js:1173`-`1197`).
- Fix F, threshold mislabel: Path B is fixed in both pages (`src/pages/TypedTest.jsx:304`-`319`, `src/pages/MCQTest.jsx:254`-`270`). Not fully deduped; standalone and Dashboard paths still hardcode/default to 95 in places (`src/pages/TypedTest.jsx:352`-`369`, `src/pages/MCQTest.jsx:295`-`315`, `src/pages/Dashboard.jsx:1800`, `src/pages/Dashboard.jsx:1835`).
- Fix H, study-day derivation: confirmed present in both pages (`src/pages/TypedTest.jsx:713`-`755`, `src/pages/MCQTest.jsx:536`-`591`). Residual issue: duplicated logic and list-unscoped helper.
- #7, attempt-authoritative resume: confirmed present. `session_state.phase` is documented as display cache (`src/pages/DailySessionFlow.jsx:300`-`306`), and routing uses only `config.startPhase === REVIEW_STUDY` (`src/pages/DailySessionFlow.jsx:813`-`827`).
- Connection diagnostics: confirmed present in `gradeWithRetry()` (`src/pages/TypedTest.jsx:590`-`660`). It logs failure/recovery but does not solve the write-after-grading risk.

## Async Design Review

The async design in `DESIGN_async_grading.md` is the right architectural direction because it makes "student submitted raw answers" durable before AI grading can fail. The critical condition is replacement: delete the callable-first flow (`src/pages/TypedTest.jsx:590`-`690`), delete client pass verdict for typed new tests (`src/pages/TypedTest.jsx:711`), and stop using `submitTypedTestAttempt()` as the graded-first typed writer (`src/services/db.js:1276`-`1402`).

Minimum async architecture required:

1. Client writes deterministic pending attempt with raw answers only.
2. Firestore trigger claims/grades attempt idempotently.
3. Server writes score, passed, graded answers, `gradingStatus`, and any failure metadata.
4. Client listens and renders pending, complete, or teacher-fallback states.
5. Phase resolution treats pending/in-progress new-word attempts as `AWAITING_GRADE`; it must not route to review, complete, or fresh retake.
6. Completion logic must be server-authoritative and list-scoped.
7. Firestore rules must allow only pending client creates and prevent client-owned score/pass fields.
8. Sweeper should mark stale `pending`/`in_progress` attempts as `error` or `needs_teacher_grade`. Scheduled functions are already available in the repo pattern (`functions/index.js:669`-`728`), though that example is APBoost session cleanup.

## Recommended Extraction Order

Do these before or as part of async implementation:

1. `resolvePassThresholdFraction()` shared helper.
2. `getNewWordAttemptForDay(userId, classId, listId, studyDay)` plus indexes and caller updates.
3. `deriveAttemptStudyDay()` shared helper.
4. A server/client shared attempt-status model: `pending`, `in_progress`, `graded`, `error`, `needs_teacher_grade`.
5. `getNewWordGateStatus()` returning one of `not_submitted`, `pending`, `failed`, `passed`.

Then implement async typed grading by replacing the existing typed submit path. Do not keep `gradeWithRetry()` as the primary path once write-triggered grading is enabled.

## Could Not Verify

- Build output, lint output, and production runtime behavior because `npm run build` failed due missing Rollup optional dependency in `node_modules`.
- Whether production Firestore has indexes not represented in `firestore.indexes.json`.
- Live dual-enrollment or multi-list student data; the list-scope issue is code-proven but not data-quantified here.
- Cloud Function trigger implementation for async typed grading; no VocaBoost async grading trigger exists in the current source.
