# VocaBoost — Status, Outstanding Work & Audit Plan (2026-06-17)

Snapshot for prioritizing fixes and briefing a supplementary audit (Codex).

## A. Deploy status (verified against origin/main `0349929`)

### ✅ LIVE in production
- **Patch 1 (A–E, v2.1)** — Day-2+ passer/desync fix, completion-gate honoring `passed`,
  threshold `toFraction`, resume guard (B), empty-review auto-complete (E) + durable marker (E-4).
- **Hotfix** — render "all mastered" modal during LOADING (fixes the infinite spinner).
- Earlier: F01 MASTERED-exclusion, reviewChallenge denominator+stale-day guard, phantom-enroll
  rule, name-edit, newWordsTestScore unit fix.

### ❌ WRITTEN but NOT applied (code not in repo; only the .md docs are committed)
1. **`PATCH_threshold_display_fix.md` (F/G/H)** — F: legacy test-launch path uses 0.95 default →
   wrong "below 95%" labels + UI/server pass-verdict split for 92–94% scorers. G: error-mechanism
   classification + codes. H: wrong-day attempt stamping on lost session context.
2. **`PATCH_connection_logging.md`** — diagnostic logging of grading failures to `system_logs`.
   ⚠️ OVERLAPS with G (both replace `gradeWithRetry`) — apply ONE, not both. Recommend shipping the
   connection-logging one FIRST (smallest, pure diagnostics, lowest risk) to get failure data.
3. **In-session "failed → retake, never review" guard** — NOT WRITTEN YET. Needed: the deployed B
   only guards the *resume* path; the *in-session* `handleReturnFromTest`/`moveToReviewPhase` still
   routes a failed Day-2+ new-word test into review (confirmed live: student "Sohyun" 2026-06-17).
   The gate (C) stops wrong *advancement*, but the student is stranded in review unable to retake.

## B. Outstanding issues (by priority)

### P0 — actively hurting students
1. **Failed-test-bypass (in-session).** Failed Day-2+ new-word test → dumped into review, can't
   retake. Live. Needs the in-session guard (B.3 above) AND the resume to be attempt-authoritative.
2. **Connection / grading-failure epidemic.** Root cause still UNCONFIRMED. Candidates: school WiFi
   (esp. Vietnam @ssis.edu.vn cohort), 90s client timeout on big tests (pace-100 / 50-q classes),
   Anthropic upstream errors, `max_tokens:4096` truncation on large payloads, transient Firestore
   billing/quota (was exhausted once 2026-06-15 due to expired card; restored). Blocked on data →
   needs the logging patch + Cloud Functions logs. Generating daily manual-grade load.

### P1 — structural / recurring
3. **Client-authoritative session state (overwrite race).** Server resets get clobbered by a
   student's open tab re-saving its in-memory phase. Phase should be derived from durable attempts,
   not pushed from the client. (Surfaced via Sohyun: every reset reverted within minutes.)
4. **Per-class vs per-list progress.** Class moves reset progress; dual-enrollment on one list
   causes drift/corruption (e.g., `initializeNewWordStates` `merge:true` can reset MASTERED→NEW).
   Design written: `DESIGN_per_list_progress.md`. Interim: a "move student" admin tool.
5. **7 same-list dual-enrolled students** still uncleaned (5 done 2026-06-17). Ambiguous which class
   is current — need enrollment-date rule or per-student confirmation. (woojin_shin, Juha Jeong,
   김나연, Jini Shin, 복시은, 임소현, 김연재.)

### P2 — quality / hygiene
6. **Threshold resolution duplication** — threshold resolved in ~6 places; F fixes the dangerous
   ones but duplication remains. Also: confirm whether a **duplicate "26SM 제주 SAT BRIDGE" with
   threshold 100** exists (would make passing impossible); the active one is correctly 90.
7. **Duplicate/typo-email accounts** — multiple students have a typo-domain dup (e.g. `@gmil.com`,
   `@gmai.com`): YooJiwoong, 김현규, others. Data hygiene sweep needed.
8. **Teacher-side challenge UX** — no challenge inbox; pending-challenge row badge never renders
   (lazy `answers:[]`). From the teacher-side audit; not yet fixed.
9. **Reconciliation volume** — ~565/48h, all benign catch-up (0 reverts, verified). Symptom of
   stored-progress lagging attempts (consequence of gate C routing advancement through reconcile).
   No action, but the per-list refactor would reduce it.
10. **Orphaned data from manual fixes** — many `manualOverride` attempts + `automarker` reviews +
    copied class_progress docs created this week. Should be validated for consistency.

## C. Audits to run (hand to Codex — each is self-contained)

**AUDIT-1: New-word → review → complete state machine (HIGHEST VALUE).**
Map every path after a new-word test — pass/fail × in-session/resume/retake × single/dual-class ×
pool-collapsed/normal review. For each: correct routing? no wrong advancement? no stuck/strand state?
Focus files: `DailySessionFlow.jsx` (handleReturnFromTest, moveToReviewPhase, the resume blocks,
auto-save effect), `studyService.js` (determineStartingPhase, completeSessionFromTest gate,
recordSessionCompletion), `TypedTest.jsx`/`MCQTest.jsx` (results screen buttons, navigation).
Goal: prove/disprove the in-session failed-test-bypass and enumerate any other strand states.

**AUDIT-2: Source-of-truth / overwrite race.**
Where can client-pushed `session_state` override server/attempt truth? Trace the auto-save effect and
every resume path. Recommend the minimal change to make resume attempt-authoritative (so a stale tab
can't revert a reset). Verify reconciliation (`getOrCreateClassProgress`, anchor logic, Math.max vs
bidirectional) never loses progress and tolerates the manual `automarker` attempts.

**AUDIT-3: Grading/connection failure surface (client + server).**
Client: `gradeWithRetry` (timeout 90s, fixed-10s retries, no jitter, no offline handling).
Server (`functions/index.js gradeTypedTest`): Anthropic error handling, `max_tokens:4096` truncation
risk on large tests, JSON-parse failure path, empty/blank `correctDefinition`, payload-size limits.
Goal: enumerate all failure modes, which are surfaced/logged/recoverable, and whether big tests
(pace-100, 50-q) systematically time out. Cross-check against Cloud Functions logs.

**AUDIT-4: Per-class vs per-list data model.**
Validate `DESIGN_per_list_progress.md`. Confirm: study_states shared per-list; class_progress per-
class; `initializeNewWordStates` `merge:true` resetting MASTERED→NEW on re-introduce; new-word index
derived from per-class TWI. Pressure-test the proposed migration + the "derive day from TWI+pace".

**AUDIT-5: Threshold resolution.**
Find all sites resolving pass threshold (server submit, completion gate, resume guard, buildTestConfig,
TypedTest/MCQTest PATH-A/B, Dashboard, sessionConfig builders). Confirm F closes the divergences;
find any remaining 0.95-default leaks; verify server vs UI verdict can't disagree.

**AUDIT-6: Data integrity sweep.**
Duplicate/typo-email accounts; remaining same-list dual-enrollments; orphaned class_progress from
moves; the week's `manualOverride`/`automarker` docs for consistency; study_states validity
(status enum, MASTERED w/ returnAt); duplicate-named classes + any threshold=100 config.

**AUDIT-7 (optional): Security rules.**
`firestore.rules` `isTeacher()` is a GLOBAL role — any authenticated teacher can read/write any
student/class. Owner deprioritized earlier; list it for completeness (UI-scoped only, not rules-scoped).

## D. Recommended order
1. Ship **connection-logging** patch → collect failure data (P0 #2 is the biggest pain).
2. Write + ship the **in-session retake guard** (P0 #1, Sohyun bug).
3. **AUDIT-1 + AUDIT-3** via Codex in parallel (the two with the most live impact).
4. Then F/G (threshold + error codes), the move-tool, and schedule the per-list refactor (AUDIT-4).
