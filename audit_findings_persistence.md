# vocaBoost Persistence & Stability Audit

> **See also:** `CODE_REVIEW_2026-06-01.md` — broader full-codebase audit (2026-06-01). It re-confirms several open backlog items here (#10, #11, #16) and flags a residual bug in the #4 fix (retake doesn't reset `resultsProcessedRef`). Reconcile status between the two files.

**Date:** 2026-05-26
**Scope:** vocaBoost (excluding apBoost) — student-facing test/study flows, persistence layer, Firestore rules.
**Symptom investigated:** "Things weren't writing properly / progress wasn't persisting. Students lost progress or got stuck."

Merged from two parallel audits (Claude Code + Codex). Ranked most-severe first. Highest-leverage UX fixes for the user-reported symptom are the Top 5 below; the two CRITICAL findings above them are security/integrity issues that should be addressed in parallel.

## CRITICAL — security / integrity

### C1. `firestore.rules:22` — any authenticated user can write to any `class_progress` document
**Bug:** The collection-group rule

```
match /{path=**}/class_progress/{docId} {
  allow read, write: if isAuthenticated();
}
```

allows every authenticated user (including other students) to read and write any `class_progress` document anywhere in the database — including overwriting `currentStudyDay`, `recentSessions`, `streakDays`, etc.

**Failure scenario:** A malicious student (or a buggy client) writes to another student's `class_progress` doc, advancing or zeroing their `currentStudyDay`. Teacher gradebook and dashboard reflect the corruption. There is no audit trail.

**Fix shape:** Scope to the student's own progress: `allow write: if isAuthenticated() && resource.data.userId == request.auth.uid` (and equivalent for `create`). Teacher access should go through a server-side mechanism or be gated on a class-membership check.

### C2. `firestore.rules:91` — students can update their own `attempts` documents with no field restrictions
**Bug:**

```
allow update: if isAuthenticated() && (
  resource.data.studentId == request.auth.uid ||
  resource.data.teacherId == request.auth.uid
);
```

No `affectedKeys().hasOnly([...])` clause. Students can rewrite `score`, `answers`, `passed`, `challengeStatus`, `credibility`, `graded` on their own attempts.

**Failure scenario:** Student takes a test, scores 40%. Opens devtools and writes `score: 100, passed: true` to the attempt doc. Teacher's gradebook reflects the spoofed score. Reconciliation in `progressService` then advances `currentStudyDay` based on the false pass.

**Fix shape:** Constrain student-side updates to a narrow allowlist (e.g., just `challengeStatus` if that's intended), and require teacher updates to verify `teacherId == request.auth.uid`.

### C3. `firestore.rules:35` — teachers can write any user's subcollections
**Bug:** `match /users/{userId}/{subcollection}/{docId} { allow write: if isAuthenticated() && (isOwner(userId) || isTeacher()); }`. Any teacher can write to any student's `study_states`, `session_states`, etc., not just students in their own class.

**Failure scenario:** A teacher account is compromised (or simply curious about a peer's students) and rewrites another teacher's students' study_states. No class-membership check.

**Fix shape:** Add class-membership gate, or restrict teacher writes to read-only access for monitoring.

---

## Top 5 — highest leverage UX fixes (resolves ~80% of student data loss)

### 1. `src/pages/MCQTest.jsx:448` — clearTestState wipes recovery before the network write
**Bug:** `clearTestState(testId)` runs at the top of `handleSubmit`, before `processTestResults` or `submitTestAttempt`. The only local recovery copy is deleted before anything is persisted to Firestore.

**Failure scenario:** Student answers 30 MCQs and taps Submit. Line 448 clears localStorage. Line 491 `processTestResults` mutates study_states. Line 565 `submitTestAttempt` fails after 3 retries (network drop). React state still holds answers (a "Try Again" button is visible), but if the student reloads the page, all 30 answers are unrecoverable — and study_states already reflect a phantom test.

**Fix shape:** Move `clearTestState(testId)` to after both `processTestResults` and `submitTestAttempt` resolve successfully.

---

### 2. `src/pages/TypedTest.jsx:618` — same pattern, worse blast radius
**Bug:** Same as #1, but `clearTestState` fires before the 90-second-per-attempt AI grading call.

**Failure scenario:** Student types 50 definitions over ~20 min, presses Submit. Line 618 deletes localStorage. `gradeWithRetry` runs for up to ~5 min (3 × 90s OpenAI timeout + 2 × 10s wait). Tab is closed or laptop sleeps mid-grading. On return: no localStorage, no React state, no attempt doc — the entire test must be redone.

**Fix shape:** Move `clearTestState(testId)` to after grading + `submitTypedTestAttempt` both succeed.

---

### 3. `src/services/studyService.js:346` — `processTestResults` runs before attempt doc is written
**Bug:** `processTestResults` batch-commits ALL per-word study_state mutations (status, intervals, `timesTestedTotal+1`) before the attempt document is written, and has no `withRetry` wrapper. Split-brain when the attempt write later fails.

**Affected callers:** `MCQTest.jsx:491`, `TypedTest.jsx:650`, `BlindSpotCheck.jsx:128`.

**Failure scenario:** study_states commit. `submitTestAttempt`/`submitTypedTestAttempt` fails 3× → error UI shown. `progressService` reconciliation uses the attempts collection as anchor (`progressService.js:126`), so the test "never happened" from its perspective — but the word's status, intervals, and `timesTested` counters are permanently mutated. Student perceives lost progress; analytics quietly corrupted.

**Fix shape:** Reverse order — write the attempt doc first, then `processTestResults`. (Note: `submitTestAttempt` reads study_states for credibility; verify that pre-test study_state is the desired snapshot for that calculation, vs. post-test.)

---

### 4. `src/pages/MCQTest.jsx:1265` — "Try Again" double-increments `timesTestedTotal`
**Bug:** The "Try Again" button after a submit failure re-runs the full `handleSubmit`, which calls `processTestResults` a second time. `timesTestedTotal: increment(1)` fires every retry.

**Affected callers:** "Try Again" at MCQTest.jsx:1265 and 1319; same shape in TypedTest.jsx:1392.

**Failure scenario:** `submitTestAttempt` fails after retries. Student clicks Try Again. `handleSubmit` re-enters; line 491 `processTestResults` executes a fresh batch with `timesTestedTotal: increment(1)`. Three retries before success = +3 instead of +1. Mastery percentages, blind-spot 21-day staleness windows, and intervention pace calculations all become wrong.

**Fix shape:** Track step completion in component state (`resultsProcessed` flag). Don't re-run `processTestResults` if already succeeded. Or: combine with the fix for #3 so retry only attempts the missing step.

---

### 5. `src/services/db.js:1207` — no idempotency on attempt doc ID
**Bug:** `submitTestAttempt` and `submitTypedTestAttempt` use `addDoc(collection(db,'attempts'), …)` — `addDoc` generates a new ID every call. `withRetry` can produce duplicate attempt docs for one test.

**Failure scenario:** `addDoc` commits on the server but the client never receives the ack (mobile network drop). `withRetry` classifies as transient and re-runs `fn` → second `addDoc` → two attempt docs for the same test. Teacher gradebook shows the same submission twice with potentially different scores (credibility re-reads study_states each call, which the first `addDoc` already mutated upstream — once #3 is fixed, this becomes deterministic but still duplicated).

**Fix shape:** Use deterministic ID like `${userId}_${testId}` with `setDoc` (no `addDoc`). Combined with the reordering fix, the second attempt to write the same ID is a no-op overwrite of identical data.

---

## Secondary findings (#6–#15)

### 6. `src/pages/BlindSpotCheck.jsx:128` — never writes an attempt doc, no retry, no recovery
Blind-spot tests only call `processTestResults`. No attempt document, no `withRetry`, no localStorage backup. Error screen at line 151 has only a "Back to Dashboard" button. Teacher gradebook never sees blind-spot tests.

### 7. `src/pages/MCQTest.jsx:152` — `markIntentionalExit` flag persists on tab-close
`markIntentionalExit(testId)` fires on every `beforeunload`. The "Stay" clearing handler at lines 167-168 only fires on click/keydown — tab-close via Cmd+W never triggers it. Flag persists. On reopen, `wasIntentionalExit()` returns true and clears the test state. Same bug in TypedTest.jsx:193.

### 8. `src/pages/MCQTest.jsx:664` — `completeSessionFromTest` not retried, failure swallowed
Attempt is saved with `withRetry` but the subsequent `completeSessionFromTest` call (which updates `currentStudyDay`, `recentSessions`, `streak`, `interventionLevel`) has no retry, and the catch block logs "Don't fail the whole submit" and continues. Student sees success but day never advances. Same in TypedTest.jsx:761.

### 9. `src/services/db.js:59` — `isTransientError` misses real offline errors
Requires either a Firestore error code from a fixed list or `'network'`/`'timeout'` substring in the message. Common offline errors (`'Failed to fetch'`, `code: undefined`) match neither → `withRetry` rethrows immediately on attempt 0 instead of waiting through backoff for the network to return.

### 10. `src/services/db.js:2468` — `submitChallenge` non-atomic, no retry
Writes `user.challenges.history` (token consumed) then `attempts[i].challengeStatus='pending'` separately. Network failure between the two: token consumed but dispute never reaches the teacher gradebook. Tokens are 5-per-user hard-limited.

### 11. `src/services/db.js:629` — `batchAddWords` non-atomic + wordCount drift
Chunks of 500 commit serially with no retry and no transactional outer guard. Partial failure leaves Firestore with N words but `list.wordCount=0`. Subsequent `addWordToList` calls compute position from `wordCount=0` and overwrite existing positions.

### 12. `src/services/db.js:808` — `updateAssignmentSettings` clobbers concurrent writes
`updateAssignmentSettings` / `assignListToClass` / `unassignListFromClass` use read-modify-write on the entire `classes/{id}.assignments` map without a transaction — two tabs editing different lists' settings clobber each other.

### 13. `src/pages/DailySessionFlow.jsx:1261` — stale closure on `newWordFailedIds`
`handleReturnFromTest` calls `setNewWordFailedIds()` then synchronously awaits `moveToReviewPhase()`, which closes over the OLD `newWordFailedIds` in React state. Today's misses are never prepended to the review queue and may then get graduated to MASTERED.

### 14. `src/services/db.js:975` — `fetchAllWords` cache never invalidated
sessionStorage cache (1-hour TTL) has no invalidation in `addWordToList` / `updateWord` / `deleteWord` / `batchAddWords`. After a teacher edit, PDFs and student sessions can return stale word content for up to 60 min.

### 15. `src/services/db.js:911` — `joinClass` not idempotent
Double-click or two tabs both read `isNewMember=true` and both `increment(studentCount, 1)`. `studentIds` dedups via `arrayUnion` but `studentCount` drifts upward — teacher's class card shows 12 students for 11 real students.

### 16. `src/services/progressService.js:323` — `updateClassProgress` is read-modify-write, not transactional
Reads progress, checks `expectedDay`, writes back. Two tabs or two submits can pass the same guard from the same stale snapshot. Especially risky around final test submit, retakes, refreshes, and any view that reads `currentStudyDay` mid-write. Also: the `expectedDay` mismatch path silently swallows updates by returning the existing progress — dropping `recentSessions`, `streakDays`, and `wordsIntroduced` increments from the dropped writer.

### 17. `src/pages/Dashboard.jsx:901,989,1107,1287` — React hook-order violations (rules-of-hooks)
The Dashboard returns the teacher view early, then later code paths call additional hooks. ESLint flags this as `react-hooks/rules-of-hooks`. Triggered by role switching: teacher account → student account toggle, or vice versa, in the same session. Symptom: white screen / runtime "Rendered more hooks than during the previous render" crash.

**Fix shape:** Move all hook calls above any conditional return. Or refactor into separate `TeacherDashboard` / `StudentDashboard` components dispatched from a thin parent.

---

## Cross-cutting themes

Three themes unify almost every finding:

- **"Clear local backup → write to Firestore" ordering is reversed everywhere.** `clearTestState()` is called at the START of `handleSubmit`, not after a successful write. Whatever fails afterward, the only safety net is already gone. **General fix:** clear local state only after both the attempt doc and study_state batch succeed.

- **`withRetry` exists but is not the standard pattern for writes.** Only `submitTestAttempt`/`submitTypedTestAttempt` are wrapped. `processTestResults`, `completeSessionFromTest`, `submitChallenge`, `updateUserSettings`, `updateAssignmentSettings`, `joinClass`, `batchAddWords`, `addWordToList`, `updateWord`, `deleteWord`, `createList` — none use it. The CLAUDE.md claim that "db.js includes retry logic" is misleading: the helper exists but isn't applied.

- **No write is idempotent.** Every retried write can produce duplicates (attempts) or double-counted increments (`timesTestedTotal`, `studentCount`, `currentStudyDay`). **General fix:** use deterministic doc IDs like `${userId}_${testId}` with `setDoc`; gate increment writes behind a cloud function or Firestore transactions with a once-only token.

## Recommended fix order

When you're ready to fix:
1. **C1 + C2 + C3** — Firestore rules. These are security-grade and should ship as a separate PR with rules-emulator tests. Do not bundle with UX fixes; the blast radius is different.
2. **#1 + #2 together** — same pattern in two files, small diff.
3. **#3** — reorder `processTestResults` to run after the attempt write. Verify the credibility-calculation semantics first (does it want pre-test or post-test study_state?).
4. **#5** — switch to deterministic attempt doc ID. Makes retry safe.
5. **#4** — track `resultsProcessed` flag so retry doesn't double-run `processTestResults`. Combined with #3, this becomes mostly free.
6. **#17** — Dashboard hook order. Independent of persistence, but Codex's lint run flagged it and it crashes UX on role switching.
7. Re-test the full submit path under simulated network failure with Playwright before merging.

#6–#16 can be a follow-up sweep — real bugs but lower frequency and lower student-frustration impact.

## Verification context (Codex audit run, 2026-05-26)

- `npm run build`: passed.
- `npm run lint`: failed with **397 errors / 27 warnings**. Relevant non-AP issues: Dashboard hook-order errors (#17), session/test hook dependency warnings.
- `npx playwright test e2e/app.spec.js`: blocked — Playwright Chromium not installed in the audit environment. Verification deferred until Playwright is set up.

## Implementation status (2026-05-30)

| Item | Status | Notes |
| --- | --- | --- |
| C1 (class_progress collection-group write) | ✅ Applied | Rule scoped to `allow read: if isAuthenticated() && isTeacher()` only. |
| C2 (teacher writes to any user subcollection) | ⏸ Documented | Left functional to preserve reviewChallenge. TODO in rules + audit + follow-up PR to move to Cloud Function. |
| C3 (attempts update field allowlist) | ✅ Applied | Student-side limited to `hasOnly(['answers'])`; teacher-side now also requires `isTeacher()`. |
| #1 MCQTest clearTestState ordering | ✅ Applied | Moved to after both attempt write and processTestResults succeed. |
| #2 TypedTest clearTestState ordering | ✅ Applied | Moved to after grading + attempt + processTestResults. |
| #3 processTestResults order | ✅ Applied | Now runs only AFTER attempt is durable in both pages. |
| #4 Try-Again double-increment | ✅ Applied | `resultsProcessedRef` ref guards in both pages. Refresh-then-retry remains a known limitation. |
| #5 Idempotent attempt doc ID | ✅ Applied | Per-session nonce in localStorage + `setDoc` on a deterministic id. |
| #17 Dashboard hook order | ⏸ Deferred | Clean fix requires ~600-line child-component extraction. Booked as its own PR to avoid regressing the very dashboard we're stabilizing. Lint already catches it; only crashes on intra-session role switch. |
| #6, #8, #9, #10, #11, #16 | ⏸ Backlog | Real bugs, not in this PR. See ranked list above. |

**Verification: pending.** Playwright Chromium not installed in current shell; user is setting up a Docker environment next session that will host the e2e run.

## Codex findings — independent verification (Claude, 2026-05-26)

Every Codex finding was cross-checked against the actual code. All confirmed verbatim.

| Codex # | Location | Verified | Notes |
| --- | --- | --- | --- |
| C1 | `firestore.rules:23-24` | ✅ | Collection-group `class_progress` rule grants `allow read, write: if isAuthenticated()` to every user. |
| C2 | `firestore.rules:35-38` | ✅ | `match /users/{userId}/{subcollection}/{docId}` allows write for any teacher account, no class-membership gate. |
| C3 | `firestore.rules:91-94` | ✅ | `allow update` on `attempts` has no `diff().affectedKeys().hasOnly([...])` constraint — students can rewrite `score`, `passed`, `answers`, `challengeStatus`. |
| 2 | `MCQTest.jsx:491`, `TypedTest.jsx:650`, `studyService.js:321` | ✅ | `processTestResults` mutates study_states (including `timesTestedTotal: increment(1)`) before the attempt is persisted. |
| 3 | `db.js:1207`, `db.js:1355` | ✅ | `addDoc(attempts, …)` then separate `updateDoc(userRef, { stats })` — withRetry replays the whole `fn` so duplicates are possible. |
| 4 | `MCQTest.jsx:647-664`, `TypedTest.jsx:743` | ✅ | Catch logs and continues; no withRetry around the multi-doc cascade in `studyService.js:1116`. |
| 5 | `progressService.js:323-369` | ✅ | `getDoc` at 327, guard at 332-335, `updateDoc`/`setDoc` at 361/363. No transaction. Guard's mismatch path silently drops `recentSessions`/`streakDays`/`wordsIntroduced` from the dropped writer. |
| 6 | `db.js:550-554`, `db.js:640-642, 675, 686-691` | ✅ | `addWordToList`: separate `addDoc` then `increment(wordCount)` — concurrent calls assign duplicate `position` values. `batchAddWords`: reads `wordCount` once, `nextPosition++` locally; concurrent imports/adds collide. |
| 7 | `Dashboard.jsx:678-679` (early return) + `:902, :989, :1107, :1159, :1239, :1287, :1288` (later hooks) | ✅ | Teacher branch returns at line 679; six `useMemo`/`useState` calls below execute only on the student branch. Hook count changes when `isTeacher` flips → "Rendered more hooks than during the previous render" crash. |
| 8 | `DailySessionFlow.jsx:299-316` (catch + log only), `:322` (no await on `persistSessionState`) | ✅ | Fire-and-forget; phase-change effect doesn't await or surface the error. Combined with #5, can produce phase-Firestore-disagrees-with-UI states. |

**Net:** Codex was right on every count. Two findings (C1 + C7) were ones my own audit missed entirely. Worth keeping both audits visible as a paired record next time we do this.
