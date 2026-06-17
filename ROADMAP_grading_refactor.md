# ROADMAP: Grading refactor — Tier 2 (extraction prep) + Tier 3 (async grading)

Created 2026-06-17. This is the **resumable plan** for the two stages deliberately deferred after the
Tier-1 correctness batch shipped. Read alongside:
- `DESIGN_async_grading.md` — the full Tier-3 spec (architecture, data model, lock, UX, rules, migration).
- `AUDIT_REPORT_dedup_and_async.md` — Codex's findings these tiers resolve.
- `AUDIT_BRIEF_dedup_and_async.md` — the audit brief (for re-running/extending the audit).

**Sandbox constraints (carry forward):** I (Claude) CANNOT run `npm run build` (node_modules is a
Windows/other-platform mount → esbuild/rollup native binaries mismatch on Linux) and CANNOT
`git push` or `firebase deploy` (no creds). The owner builds locally + runs all deploys. Verify deploys
via live bundle hash + grep of Korean message strings (survive minification).

---

## STATUS @ 2026-06-17 (what shipped before this save)

**Tier 1 (DONE, in working tree, awaiting owner build+push):**
- Blocker #1: `completeSessionFromTest` gate moved BEFORE the `phase:COMPLETE` write (`studyService.js` ~1173).
- High #3: `getNewWordAttemptForDay` list-scoped `(userId, classId, listId, studyDay)` + all 5 callers updated
  (`db.js` ~2980; callers: `studyService.js:1154`, `TypedTest.jsx:727,749`, `MCQTest.jsx:555,585`).
- Changelog contradictory-Fix-H rows reconciled.
- Earlier same session (already pushed/live): connection-logging, Fix F (threshold PATH-B), Fix H
  (study-day derivation), in-session retake guard #1/#2, #7 attempt-authoritative resume.

**⚠️ HARD DEPENDENCY created by Tier 1 (#3) — MUST be done by owner BEFORE the Tier-1 code deploys:**
Adding `where('listId')` changes the query shape → needs a NEW composite index. Deploying the code
without the index = the query fails (and the gate/derivation silently returns null).
- New index needed — `attempts` collection, fields:
  `studentId ASC, classId ASC, listId ASC, sessionType ASC, studyDay ASC, submittedAt DESC`.
- ALSO (audit High #4): the live reconciliation composite indexes are NOT tracked in
  `firestore.indexes.json` (only `teacherId+submittedAt` and `teacherId+classId+submittedAt` are).
  Risk: a future `firebase deploy --only firestore:indexes` from the repo DROPS the live ones.
- **Owner action (one pass):**
  1. `firebase firestore:indexes > firestore.indexes.json`  (exports ALL live indexes; never drops).
  2. Manually ADD the new `studentId+classId+listId+sessionType+studyDay+submittedAt` composite if the
     export doesn't already contain it (it won't — #3 is new code not yet live).
  3. Review diff → commit → `firebase deploy --only firestore:indexes`.
  4. Wait for indexes to finish building (Firebase console) → THEN deploy the Tier-1 web code.
- Deploy ORDER for Tier 1: **indexes first, code second.**

---

## TIER 2 — Extraction prep (de-duplication; pure refactor, no behavior change)

Goal: collapse the duplicated logic the patches exposed into single homes, SHAPED to fit Tier 3 so async
becomes a replacement, not a bolt-on. Each item: pure refactor, verifiable by `npm run build` + the same
targeted repros (no Playwright needed — no UX change). Order matters (later items depend on earlier).

### T2.1 — `resolvePassThresholdFraction(assignmentOrSettings) → number (0–1)`
**Problem (measured):** ~8 threshold-resolution sites / 37 refs, with divergent fallbacks & units. A page
can display one threshold, compute the pass verdict with another, init the session with a third.
**Sites to unify (from audit High "threshold"):**
- `src/utils/testConfig.js:29-58` (`buildTestConfig`, `passThreshold ?? 95`, `/100`) — the closest to canonical.
- `src/pages/DailySessionFlow.jsx:591-598` (derives `newWordRetakeThreshold` from passThreshold) AND
  `:308-311` (autosave recomputes pass with `sessionConfig?.retakeThreshold || 0.95`).
- `src/services/studyService.js:229-232` (`newWordRetakeThreshold || DEFAULT_RETAKE_THRESHOLD`) and the
  `completeSessionFromTest` local `threshold` fallback (~1136).
- `src/pages/TypedTest.jsx:352-369` and `src/pages/MCQTest.jsx:295-315` (standalone init defaults to
  DEFAULT even after reading `assignment.passThreshold` for UI) — PATH-A/C; PATH-B already fixed in Fix F.
- `src/pages/TypedTest.jsx:86` / `MCQTest.jsx:89` `useState(0.95)` initial values.
- `src/pages/Dashboard.jsx:1800, 1835` hardcode `newWordRetakeThreshold: 0.95` in PDF/session payloads.
**Design:** one helper (likely in `src/utils/testConfig.js` or a new `src/utils/threshold.js`); accepts a
value that may be percent (92) or fraction (0.92) and returns a fraction; single DEFAULT constant
(reuse `STUDY_ALGORITHM_CONSTANTS.DEFAULT_RETAKE_THRESHOLD`). Mark each call site DISPLAY-only (keep, just
for label copy) vs VERDICT (must match the server). **Port the same logic into `functions/` for Tier 3** so
the server verdict and client display agree by construction.
**Acceptance:** grep shows 0 ad-hoc `|| 95` / `|| 0.95` / `?? 0.95` threshold patterns outside the helper.

### T2.2 — `deriveAttemptStudyDay({ userId, classId, listId, testType, providedDayNumber }) → number`
**Problem:** Fix H's study-day fallback + stale-context guard is COPY-PASTED in both test pages
(`TypedTest.jsx:713-755`, `MCQTest.jsx:536-591`). Tier 1 list-scoped the helper but left the two copies.
**Design:** extract the whole block (the `!providedDayNumber` derivation AND the stale-context guard) into
one function. Inputs it needs: `getOrCreateClassProgress` (progressService), the now-list-scoped
`getNewWordAttemptForDay` (db), direct `getDoc`/`doc`/`db` for the cheap class_progress read, and
`logSystemEvent` (keep the `attempt_day_fallback` / `attempt_day_context_invalid` telemetry inside).
**Home:** new `src/services/studyDay.js` (leaf util importing db + progressService) to avoid circular deps
— DO NOT put in studyService.js if it would cycle. Verify import graph before placing.
**Both test pages** then call the single helper at the attempt-write site. Removes ~40 lines from each.
**Acceptance:** the `csd+1 / getNewWordAttemptForDay` logic exists in exactly ONE place; both pages call it.

### T2.3 — `getNewWordGateStatus(...) → 'not_submitted' | 'pending' | 'failed' | 'passed'`
**Problem (measured):** 27 independent "is the new-word test passed?" computations (resume init,
persist effect, `handleReturnFromTest`, `completeSessionFromTest`, etc.). Some are legit defense-in-depth
locks; some are redundant recomputations that can diverge.
**Design:** one attempt-derived function that classifies the current-day new-word gate. `determineStartingPhase`,
`completeSessionFromTest`'s gate, and the DailySessionFlow routing all read THIS instead of recomputing.
**CRITICAL — this is the seam Tier 3 plugs into:** the return type already includes `'pending'`, which Tier 2
won't produce yet (no async) but Tier 3 will. Build the enum now so AWAITING_GRADE drops in cleanly.
**Acceptance:** the pass decision has one canonical source; call sites read it; defense-in-depth locks remain
but reference the same status.

### T2.4 — Shared attempt-status model (constants)
Define `ATTEMPT_STATUS = { PENDING, IN_PROGRESS, GRADED, ERROR, NEEDS_TEACHER_GRADE }` in a shared module
usable by BOTH client and `functions/` (or mirror it). Not wired to behavior in Tier 2 — just the vocabulary
Tier 3 needs. Legacy attempts (no status field) are treated as `GRADED`.

### Tier 2 NOT to do (would be deleted by Tier 3 — don't pre-extract)
- Do NOT extract the TypedTest/MCQTest grading/submit twins yet (audit Medium "twins"). Tier 3's async
  rewrite replaces the typed grading path entirely; extracting it first = wasted work + merge pain.
- Do NOT extract `gradeWithRetry` — Tier 3 deletes it.
- Challenge threshold dup (`db.js:2659-2675, 2730-2740`) — defer; works in percent units, low risk.

---

## TIER 3 — Async write-triggered grading (the big project)

Full spec: `DESIGN_async_grading.md`. This section = the execution checklist + test/deploy plan.
**Guiding principle (non-negotiable): REPLACE, DON'T PARALLEL.** Success = the §8 consolidation inventory
counts actually DROP (gradeWithRetry deleted, client score/verdict deleted, threshold/study-day collapsed).
If async ends up running beside the sync path, it FAILED its purpose.

### T3.1 — Server: grading trigger
- New Cloud Function: `onDocumentCreated` on `attempts/{id}` (firebase-functions v2 — repo is v7/Node24;
  pattern exists, `onCall`/`onSchedule` already used at `functions/index.js`).
- Fires when a typed `'new'`/`'review'` attempt is created with `gradingStatus: 'pending'`.
- Calls Anthropic (reuse the grading logic in `functions/index.js:gradeTypedTest` + `scoring.js`); resolves
  the pass threshold SERVER-SIDE (port T2.1). Writes back `score`, `answers[].isCorrect`, `passed`,
  `gradingStatus: 'graded'`, `gradingMeta`.
- **Idempotency (Blocker-class):** transition `pending → graded` in a transaction OR guard
  `if (status !== 'pending') return`. Deterministic attempt docId (the per-session nonce already used by
  the pages: `userId_testId_nonce`) so retries/dup events can't double-grade or re-introduce words.
  NOTE audit Medium: `db.js:1242-1248` (MCQ) and `1397-1402` (typed) still allow RANDOM fallback ids if a
  caller omits `attemptDocId` — for async, REJECT missing ids on pending creates.
- Error path: on exhausted retries / unparseable LLM / upstream down → write `gradingStatus: 'error'` +
  `gradingMeta.lastError`. Never leave silently stuck.

### T3.2 — Server: stale-pending sweeper
- `onSchedule` function: find `pending`/`in_progress` attempts older than T minutes with no terminal status
  → mark `error` (or `needs_teacher_grade`) / re-enqueue. Backstop for lost trigger events.

### T3.3 — Server: Firestore rules (audit Blocker)
- Current `firestore.rules:101-102` lets a student create an attempt with ANY score/passed/graded fields as
  long as `studentId == auth.uid`. Tighten:
  - Student create: allow ONLY `gradingStatus:'pending'`, own studentId, raw `answers` (incl
    studentResponse), with `score/passed = null`, `graded = false`, and server-only fields ABSENT.
  - Forbid student writes to `score`, `passed`, `graded`, `answers[].isCorrect`, terminal `gradingStatus`.
  - Forbid updates to an attempt once `graded` (terminal).
  - Teachers (`isTeacher()`) may write grade fields → powers the manual-grade fallback. (Known: isTeacher
    is a GLOBAL role — any teacher can write any student; acknowledged, not fixed here.)
  - Trigger runs Admin → bypasses rules.

### T3.4 — Client: write-pending + listen (DELETE the sync path)
- New writer (or reworked `submitTypedTestAttempt`) that persists raw answers + `pending` BEFORE any
  grading. (Today `db.js:1301-1303` REQUIRES finished `gradingResults` — opposite order; that guard must go
  for the pending path.)
- Replace `gradeWithRetry` call (`TypedTest.jsx:689-690`) → write pending, then `onSnapshot` the attempt
  doc; render results when `graded`. **DELETE** `gradeWithRetry` (`TypedTest.jsx:~590-660`), the client
  score computation, and the client `passed = score >= threshold` verdict for typed new tests.
- MCQ untouched (client-graded, no cloud call).

### T3.5 — Client: `AWAITING_GRADE` state + gated CTA
- Add derived `AWAITING_GRADE` to phase resolution (NOT a trusted `session_state.phase`): derived from a
  current-day `'new'` attempt with `gradingStatus in ['pending','in_progress']`.
  Touch: `SESSION_PHASE` (`sessionService.js:26-31`), the phase map (`DailySessionFlow.jsx:291-297`),
  `determineStartingPhase` (`studyService.js:57`), every switch/branch on phase.
- Re-entry while pending → grading screen (NOT a fresh test, NOT review).
- **Grading screen** (replaces the sync "Grading Failed/Try Again" modal): spinner + "채점 중…" +
  "나가셔도 결과는 자동 반영" + only forward affordance = Dashboard. Transitions via listener:
  graded+passed → results → Continue to Review works; graded+failed → results → Retake (Fix #1 path);
  slow(>~30-60s)/error → reveal "선생님께 채점 요청".
- **Review CTA: VISIBLE but GATED** (owner decision): keep it rendered; clicking while pending/failed shows
  a state-aware message (inline note, not modal) + lock styling; un-locks when passing grade arrives.
  Messages (from `DESIGN_async_grading.md` §5.2):
  - pending: "채점이 끝나야 복습 단어가 열려요. 잠시만 기다려 주세요."
  - graded-failed: "새 단어 시험을 먼저 통과해야 해요 (N%+). 통과 후 복습이 열립니다."
  - slow/error: pending message + ask-teacher option.

### T3.6 — The LOCK (hide ≠ block; defense in depth)
- Phase-resolution lock: `determineStartingPhase` refuses REVIEW_STUDY without a graded+passed new attempt;
  `pending`/`failed`/`error` → never review.
- Completion-gate lock: `completeSessionFromTest` (now gated BEFORE the COMPLETE write thanks to Tier-1 B1)
  must treat `pending` and `error` as "not passed" too.
- Tamper lock: grades server-written-only (T3.3 rules).
- Verify NO nav path (browser back/forward, bookmarked `?type=review`, stale tab, history) can advance a day
  without a server-written passing grade. (This was the owner's explicit "lock the door" requirement.)

### T3.7 — Teacher "Pending grading" queue (absorbs "ask teacher to grade")
- Gradebook surface listing `pending`(slow)/`error`/`needs_teacher_grade` attempts. Per item: "Grade with
  AI" (teacher-triggered callable re-runs grading server-side on the saved answers) or "Grade manually"
  (mark ✓/✗ → score vs threshold). On grade → normal graded attempt → reconciliation advances student.
- The student "선생님께 채점 요청" button sets `gradeRequestedFromTeacher: true` → routes here.

### T3.8 — Completion timing
- v1: day completes when the GRADED attempt lands; client reacts to the `graded` snapshot and runs the
  existing `completeSessionFromTest`. Verify no race vs reconciliation (`getOrCreateClassProgress`) or the
  `automarker` review-attempt pattern.
- v2 (later): move completion INTO the trigger for full server-authoritative completion (the ultimate #7).

### T3.9 — Migration / coexistence
- Legacy attempts (no `gradingStatus`) → treat missing as `graded`.
- Deploy ORDER: functions + rules FIRST, client SECOND (never write pending docs nothing grades).
- Rollback: revert client to sync grading; sweeper marks orphan pending → error → teacher queue. No data
  loss (answers persisted).

### T3.10 — TEST PLAN (Tier 3 REQUIRES this; Playwright + more — unlike Tiers 1/2)
Because Tier 3 changes UX, timing, states, rules, and adds a Cloud Function, reasoning alone is insufficient.
- **Unit/logic:** threshold parity (client display == server verdict); idempotency (double-fire trigger →
  one grade); phase resolution for every {not_submitted, pending, failed, passed} × {Day1, Day2+} ×
  {single-list, multi-list} × {fresh, resume}.
- **Playwright E2E (live/local dev server):** normal grade (submit → pending → graded → review);
  slow grade (artificial delay → "ask teacher" appears); offline at submit (write queues, resolves on
  reconnect); trigger error → teacher queue; **multi-tab / stale-tab** (the overwrite-race scenario —
  confirm a stale tab can't unlock review or revert state); resume-while-pending (re-enter → grading screen,
  not fresh test); the LOCK (browser-back into `?type=review` while pending → blocked).
- **Rules tests:** student cannot create a graded-looking attempt; cannot write score/passed; cannot mutate
  a graded attempt; teacher can.
- **Deploy choreography rehearsal** on a staging project if available, else a low-traffic window.

---

## RECOMMENDED SEQUENCE (resume here)
1. **Owner:** index export + deploy + build/push Tier-1 (see STATUS dependency block).
2. **Tier 2** in order T2.1 → T2.2 → T2.3 → T2.4 (build + repro between each).
3. **Tier 3** T3.1–T3.3 (server, deploy, test with hand-written pending docs) → T3.4–T3.6 (client, DELETE
   sync path) → T3.7 (teacher queue) → T3.8 → T3.10 (full test plan) → T3.9 deploy choreography.
4. After Tier 3: re-measure the §8 consolidation counts; if they didn't drop, the refactor failed.

## SEPARATE (not in these tiers, tracked elsewhere)
- Practice Mode (5×/day server-capped AI; reuse the async pipeline w/ `mode:'practice'`, non-authoritative).
- Day-card "To advance, complete: ☐ X ☐ Y" checklist (attempt-derived; small; web-only).
- Teacher "Attention" panel (failed≥3×, grading errors today, no-progress N days, dual-enrolled) over
  attempts + system_logs.
- Per-list progress refactor (`DESIGN_per_list_progress.md`) + interim "move student" tool.
- 7 same-list dual-enrollments cleanup.
- **Review-test pass threshold.** Today review tests auto-pass (`passed` always true), so they have no
  real pass/fail verdict. Consequence already visible: the gradebook score color (2026-06-17) colors by
  `passed`, so review rows are ALWAYS green regardless of score (owner chose option A for now). To add a
  real threshold:
  1. Decide source: reuse the assignment `passThreshold`, or a separate `reviewPassThreshold` (review and
     new-word mastery bars may differ pedagogically).
  2. Decide the CONSEQUENCE of a failing review — this is the hard part: today review completes the day
     unconditionally. Options: (a) require a review retake before the day completes (mirrors the new-word
     gate — big change to the day-completion state machine + `completeSessionFromTest`), or (b) let the day
     complete but record `passed:false` for reporting only (low-risk; unlocks correct gradebook color with
     no flow change). Recommend starting with (b).
  3. Once review attempts carry a real `passed`, the gradebook color "option B" (color reviews by verdict)
     becomes automatic — no extra UI work; just flip the behavior chosen on 2026-06-17.
  4. Interacts with async grading (Tier 3) completion logic and with `determineStartingPhase` — sequence
     AFTER Tier 3 if pursuing consequence-option (a).
