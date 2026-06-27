# Change Action Log

> **Instructions for Claude:** Log every code change you make to this file. Add a new row for each modification with the date, file path, and a brief description of what changed. This helps track all modifications across sessions.

| Date | File | Change |
|------|------|--------|
| 2026-06-27 | functions/index.js | gradeTypedTest grader calibration (NEED_TO_FIX #2), two findings from the live quirk battery. (1) **Loanword transliteration**: rubric now accepts a Korean transliteration ONLY when it is the standard/most-commonly-used Korean word for the term (piano→피아노, computer→컴퓨터, repertoire→레파토리, bus→버스 = CORRECT) while still rejecting ad-hoc sound-outs no one uses (grief→그리프 = WRONG). Reworded `<rules>` self-reference rule into a "sound-it-out vs established loanword" test; replaced the renaissance WRONG example (conflicted with the new rule — 르네상스 IS the standard Korean word) with grief→그리프 WRONG + added piano→피아노 and repertoire→레파토리 CORRECT examples. (2) **Inflection**: an inflected/derived ENGLISH form of the target word with no meaning is now WRONG (run→running, candid→candidly). Added `isInflectionOfWord(response, word)` helper (ASCII-only, handles consonant-doubling/drop-e/y→i, so a Korean different-POS translation like impoverish→가난한 stays CORRECT) and wired it into post-validation Rule 2 (replacing the old word/+s/+ed/+ing exact check) + the rubric rule #1 (covers irregulars like ran). node --check clean; helper unit-tested offline 15/15. NOT yet deployed — needs `firebase deploy --only functions`; quirk battery re-runs against live post-deploy. |
| 2026-06-22 | src/config/featureFlags.js + src/pages/TypedTest.jsx + src/pages/MCQTest.jsx | Server-side attempt write — Phase 1 CLIENT half. Added `SERVER_ATTEMPT_WRITE` flag (default FALSE). When ON, both test pages route the durable attempt write through the `submitVocabAttempt` Cloud Function (server scores/persists transactionally + idempotently on the same `attemptDocId`) instead of the client-side `submitTypedTestAttempt`/`submitTestAttempt`. Localized swap inside the existing try — the failure-catch (block progression + preserve localStorage recovery + leave study_states untouched + return) and the post-write `processTestResults`/`completeSessionFromTest`/`clearTestState` ordering are unchanged. Flag OFF = byte-for-byte old behavior. esbuild-clean. **Deployed server fn validated E2E** (real persona token): MCQ 10/50→score 20 (not 100), review-always-passes, idempotent 2nd-call alreadyWritten, invalid-anchor refused+not-written, valid anchor 30/30→100. Client NOT yet live (needs Netlify deploy; flag stays OFF until validated on sandbox). |
| 2026-06-22 | functions/index.js | Server-side attempt write — Phase 1 SERVER half (PLAN_server_side_attempt_write_v2.md §13). Added: `writeAttemptTxn` (transactional, idempotent on the client `attemptDocId`; auth+enrollment via classes.studentIds/users.enrolledClasses; server passThreshold with review-always-passes; scores against ctx.totalQuestions so skipped count as incorrect; echoes the client anchor; REFUSES an invalid new-word anchor — CS-2026-06-21); `readExistingAttemptForContext` (ownership+context checked); `normalizeExistingAttempt` (stored aiReasoning→API reasoning); `buildTypedAttemptAnswers` (correctDefinition→correctAnswer + challenge fields); new `submitVocabAttempt` callable (MCQ + typed write-retry). Extended `gradeTypedTest`: HttpsError-ified all throws (was raw Error → opaque functions/internal), pre-AI ownership-checked existence check (no token re-spend on lost-response retry), both result exits (no-AI + AI) route through `finishGrading` which writes when `writeContext` present and returns the grade (NOT re-billed) on write failure. Backward-compatible: engaged ONLY when client sends `writeContext` (no client does yet). users.stats.credibility/retention side-effect DEPRECATED server-side (grep: 0 UI consumers). node --check clean; eslint = only the pre-existing env-gap no-undef errors (deploy lint is `eslint . || exit 0`). NOT yet deployed (needs `firebase deploy --only functions` on Windows). Client cutover = follow-up, validated against the deployed fn. |
| 2026-06-21 | src/services/db.js | F1b: `fetchUserAttempts` now caches resolved list titles by listId (`listTitleCache` + `resolveListTitle`) instead of a `getDoc(lists/{listId})` per attempt. Kills the N+1 sequential reads (e.g. 70 attempts on one list = 1 read, not 70) that slow-loaded `userAttempts` and fed the dashboard hero-phase race. Caches the resolved string incl. the 'Vocabulary Test' fallback; keeps the `if(listId)` guard. Plan: DASHBOARD_OMNIBUS_FIX_PLAN.md. |
| 2026-06-21 | src/pages/Dashboard.jsx | F1a/F3 follow-up (Codex review of the impl): (Critical) stat tiles called `totalWordsIntroduced.toLocaleString()` on the now-possibly-undefined destructured value when panelBState returns `{loading}` → crash; tiles now render `tileSk` skeletons (or safe `tIntro`) gated on `anyLoading`. (High) hero showed the "No active list" empty state during the settings/classes-load window; added a `firstPaintLoading = !settingsLoaded || studentClassesLoading` full-skeleton hero branch BEFORE the `getPrimaryFocus ? hero : empty` ternary, so the empty state only shows for a genuinely class-less student post-load. (Medium, KNOWN-EXCEPTION not fixed here) ESLint `react-hooks/rules-of-hooks` still flags pre-existing conditional hooks: the `isTeacher` early-return (Dashboard.jsx ~:768) precedes the student-only hooks (getPrimaryFocus/classOptions/listOptions/panelBState/panelCState/dailyActivity). This change ADDS hooks (classOptions/listOptions) inside that existing student-only region. NO RUNTIME CRASH under the current flow: PrivateRoute blocks Dashboard until `!initializing && user`, and AuthContext sets `user` atomically with `role` (never non-null without role), so `isTeacher` has its final value on first render and the hook count never flips. Vite build does not run ESLint. Proper fix tracked as a follow-up: split Dashboard.jsx into TeacherDashboard + StudentDashboard (removes the conditional-hook structure without hoisting large student-only logic above the teacher path). |
| 2026-06-21 | src/pages/Dashboard.jsx | F1a (hero-phase loading race) + F3 (class selector). F1a: added `userAttemptsLoading`/`progressDataLoading` (init false, set inside guarded fetches, reset in finally) + `settingsLoaded=userSettings!==null`; progress effect now fetches the UNION of assignedListDetails/assignedLists/assignments keys (so a focus key is never unfetched) and releases the flag on the no-class path; `panelCState`/`panelBState` gate in order settings→focus→loading BEFORE deriving phase/numbers (prevents the wrong 'Start new words'/'Day1 COMPLETE' flash and the spurious `impossible_phase_detected` write); hero renders white-tinted skeletons (ring numbers, chips, CTA column) while loading. F3: replaced the list-only `Studying:` selector with a `FocusControl` (renders as borderless label when ≤1 option, dropdown when ≥2) ×2 — Class + List controls; parent-controlled `openFocus` (mutual close) + ESC/outside-click; `classOptions`/`listOptions` (class-qualified so selecting never writes classId=undefined); `handleClassSelection` picks the class's primary list (most-recent assignedAt) with a same-class assertion; gated on `settingsLoaded && getPrimaryFocus && classOptions.length` (no preference-clobber during settings load); removed dead `availableLists`/`showListSelector`. Plans: DASHBOARD_OMNIBUS_FIX_PLAN.md + DASHBOARD_CLASS_SELECTOR_PLAN.md. |
| 2026-06-20 | `src/pages/Dashboard.jsx` | **Student dashboard redesign** (branch `redesign/student-dashboard`; backup at `backups/Dashboard.jsx.20260620.bak`). Replaced the 3-panel "Command Deck" (~lines 1345–1582) — which duplicated one list's data 3–4× (Start Session ×3, Day ×2, list title ×2, progress in 3 framings), led with a demoralizing "0/400 weekly" hero, a mislabeled "Mastery Rate 0%" (really `avgReviewScore`), and an empty "7-Day Rhythm" placeholder. New layout: ONE consolidated hero (conic-gradient ring = list completion `totalWordsIntroduced/wordCount`, title, streak + words-left tags, single "Start Session" CTA previewing day + new-word count from `getPrimaryFocus.pace`) → 4 honest tiles (Words Introduced / **Avg Review Score** [renamed] / Words Left / Streak) → real "This week" bar chart bound to existing `dailyActivity` (replaces empty rhythm). Wired only to existing in-scope vars; "My Classes" join/list kept. esbuild-validated (full file transpiles clean); NOT build/screenshot-verified in-container (rollup linux binary absent — verify via `npm run dev` locally). FOLLOW-UP: exact "Mastered/Needs Review/Blind Spots" tiles need 3 small `study_states` aggregation queries (not yet in this component); current tiles use honest available data. |
| 2026-06-19 | `src/pages/DailySessionFlow.jsx`, `functions/index.js` | **Fix: "Grading Failed" loop on test resume after refresh.** Root cause: the two local recovery snapshots saved the test word pool as `wordPool.map(w => ({ id: w.id, word: w.word }))` — dropping `definition`. When a student refreshed/crashed mid-test and recovery restored `newWords` from that snapshot (`recoveredWordPool` → `setNewWords(state.newWords)`), every word lost its definition. On submit the client built `correctDefinition: word.definition` = `undefined`, and the grading Cloud Function's `for`-loop validation `throw new Error(...)` rejected the ENTIRE 35-word batch → surfaced as opaque `functions/internal` → "Grading Failed after 3 attempts" with Try-Again looping forever (same stripped pool). Confirmed from prod function logs (`Invalid input: each answer must have wordId, word, correctDefinition... index.js:99`, 18× in one window while a fresh submit "Successfully graded 30 answers"). Data was clean (scanned all 1600+ words across every list = 0 malformed). **Client fix:** both recovery snapshots now persist `definition`, `definitions`, `partOfSpeech` so a resumed test can grade. **Server fix:** replaced the throw-on-first-malformed `new Error` with collect-all + `logger.error` (logs uid + offending wordIds for monitoring) + `throw new HttpsError("invalid-argument", ...)` with a clear, retryable message ("reload the test page and submit again") instead of a generic INTERNAL crash. Branch `fix/grading-missing-definition`; functions redeploy required for the server half (`firebase deploy --only functions`). Follow-up idea: client `gradeWithRetry` should not retry on `invalid-argument` (deterministic) — deferred. |
| 2026-06-17 | `src/pages/Gradebook.jsx`, `src/services/db.js` | UX: gradebook score color now tied to the class pass threshold instead of a hardcoded 80/60 band. `getScoreColor(score, passed)` colors by the attempt's authoritative `passed` flag (computed at submission vs the class's real passThreshold; respects manual overrides) → `text-success` if passed, `text-error` if not (design tokens, was raw `text-emerald/amber/red`). So e.g. 90% in a 92% class now shows red, not green. Added `passed` to the 3 gradebook loaders that previously omitted it (`queryTeacherAttempts` list, the 2nd list query, and `fetchAttemptDetails` detail) — without this `attempt.passed` was undefined and the color would silently fall back. Legacy attempts lacking `passed` fall back to a neutral 80/60 gradient (also tokenized). NOTE: review attempts always have passed=true (review auto-passes), so they always render green regardless of score — owner chose to keep this (option A) for now; adding a real review-test threshold is deferred to the backlog in `ROADMAP_grading_refactor.md` (would make review color correct automatically). |
| 2026-06-17 | `src/services/studyService.js` | Audit Blocker #1 (completion gate ordering): `completeSessionFromTest` Day-2+ branch wrote `saveSessionState(... phase: COMPLETE ...)` BEFORE the new-word-pass gate returned `requiresNewWordRetake`, stamping the durable session_state cache complete for a day that did NOT complete (contradicts Fix #2/#7; pollutes UI/support/admin tooling). Moved the gate ABOVE the COMPLETE write and inside the Day-2+ else branch (dropped the now-redundant `!isFirstDay`); a blocked day now returns early and never stamps complete. Also list-scoped the gate's `getNewWordAttemptForDay` call (see #3 row). `npm run build` before push. |
| 2026-06-17 | `src/services/db.js`, `src/services/studyService.js`, `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx` | Audit High #3 (list-scope `getNewWordAttemptForDay`): helper signature `(userId, classId, studyDay)` → `(userId, classId, listId, studyDay)` + added `where('listId','==',listId)`. Without it, a same-class multi-list student with two `'new'` attempts on the same studyDay had the orderBy-submittedAt/limit-1 return the WRONG list's attempt — used by the Day-2+ completion gate AND by Fix H's study-day derivation (which I widened from 1 caller to 3 this session). Updated all 5 call sites (1 in studyService, 2 in TypedTest, 2 in MCQTest) in place. ⚠️ NEEDS a new composite index (`attempts`: studentId+classId+listId+sessionType+studyDay + submittedAt desc) deployed BEFORE this code, or the query fails. NOTE: study-day derivation is still duplicated across the two test pages — extraction to a shared `deriveAttemptStudyDay()` is deliberately deferred to Tier 2 (see `ROADMAP_grading_refactor.md`). `npm run build` before push. |
| 2026-06-17 | `ROADMAP_grading_refactor.md` | DOC (no code): detailed resumable plan for the deferred Tier 2 (de-dup extractions: `resolvePassThresholdFraction`, `deriveAttemptStudyDay`, `getNewWordGateStatus`, attempt-status model — with exact sites/signatures/homes) and Tier 3 (async write-triggered grading: trigger, sweeper, rules, AWAITING_GRADE, gated CTA, the lock, teacher pending-grade queue, completion timing, migration, and a full Playwright/E2E + rules test plan + deploy choreography). Captures the Tier-1 deploy dependency (list-scoped query needs a new composite index deployed BEFORE the code) and the deliberately-deferred study-day dedup. Resume point for the whole grading refactor. |
| 2026-06-17 | `DESIGN_async_grading.md`, `AUDIT_BRIEF_dedup_and_async.md` | DOCS (no code): (1) Spec for asynchronous write-triggered AI grading — client writes attempt as `gradingStatus:'pending'`, Firestore `onDocumentCreated` trigger grades server-side, client `onSnapshot` renders result; adds derived `AWAITING_GRADE` phase, visible-but-gated Review CTA (state-aware messages), two-layer lock (phase-resolution + completion-gate) so a day can't advance without a server-written passing grade, idempotency/sweeper, rules diff, migration, and a §8 "consolidation inventory" enforcing REPLACE-DON'T-PARALLEL (the refactor must DELETE the client grade/score/gate/threshold/studyDay duplication, not run beside it). Folds "ask teacher to grade" in as the error/slow fallback. (2) Codex audit brief covering A: dedup measurement (threshold ~8 sites/37 refs, pass-gate 27 computations, Fix-H studyDay copy-paste, TypedTest/MCQTest twins) with {extract-now} vs {fold-into-async} tagging; B: adversarial review of the async design incl. the lock + consolidation contract; C: architecture health + regression check on this session's patches. |
| 2026-06-17 | `src/pages/DailySessionFlow.jsx` | P1 #7 (overwrite race / "bad session state persisting"): made session resume routing ATTEMPT-AUTHORITATIVE. Removed the `sessionSaysReviewResume` branch (and now-unused `isSameDay`/`resumeNewWordThreshold`/`resumeNewWordsPassed`) that let a stale/poisoned `session_state.phase` route a student into review — the mechanism by which an open tab silently reverted admin/server resets within minutes and could carry a non-passer into review. Routing now keys solely on `config.startPhase` (from `determineStartingPhase(attempts)`); if attempts say not-review, going to the new-word phase is self-healing. `session_state` is still read for DISPLAY values (scores, dismissed words) and the COMPLETE re-entry modal. Annotated `persistSessionState` so `phase` is documented as a non-authoritative cache (write side unchanged; load no longer trusts it). No backend change. `npm run build` before push. |
| 2026-06-17 | `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx` | Codex Fix H (wrong-day attempt stamping): when a test launches WITHOUT `sessionContext.dayNumber` (lost/stale nav state), both pages previously stamped the attempt with `progress.currentStudyDay` (last COMPLETED day) — so a current-day review stamped the previous day and reconciliation (needs a review attempt for day N) could never complete the day → it re-prompted forever (confirmed live 2026-06-10, 한승환 Adv-A1). H-1/H-2: new test → CSD+1; review → CSD+1 if day CSD+1's new test is passed (`getNewWordAttemptForDay`), else CSD. H-3: stale-context guard — even when a dayNumber IS provided, re-derive if it's outside the only legitimate window [CSD, CSD+1] (old tab / restored sessionStorage). Both log `attempt_day_fallback` / `attempt_day_context_invalid` to system_logs to measure how often context is lost. Added `getNewWordAttemptForDay` (both) + `logSystemEvent` (MCQTest) imports. Safe w/ gradebook review retake (snapshot rolls CSD back so the provided day stays in-window). `npm run build` before push. |
| 2026-06-17 | `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx`, `public/help-student-ko.html`, `public/help-student-en.html` | Codex Fix F (threshold mislabel): PATH-B (legacy `wordPool` launch) no longer hard-defaults the display/UI pass threshold to 95. Now: if `assignmentSettings.passThreshold` is present use it; else fetch the class doc and read `assignments[listId].passThreshold` (fallback 95 only if truly unresolved). Fixes 92–94% scorers in 92%-threshold 26SM classes seeing a false "below 95%" label and a UI "Did not pass / Try Again" that contradicted the server's correct pass verdict. Student guides (ko/en) dethreaded the "default 95%" anchor → class-specific phrasing (예: 92%). G (error-code classification) intentionally SKIPPED — it rewrites the same `gradeWithRetry` already carrying the new connection-logging; fold in later. (H was applied immediately after — see the newer row above; this row's "H not yet applied" note is superseded.) `npm run build` before push. |
| 2026-06-17 | `src/pages/TypedTest.jsx` | Connection-error diagnostics: `gradeWithRetry` now writes per-attempt failure telemetry to `system_logs` via `logSystemEvent` (added to import). New events: `grading_attempt_failed` (severity error — classId/listId/testId/studyDay/testType/wordCount/payloadChars, network effectiveType/downlink/rtt, attempt/isFinal, elapsedMs, `timedOut` = ran full 90s window, `failedFast` = died <2s, navigator.onLine, errCode/errName/errMessage) and `grading_recovered` (severity warning — logged when a retry succeeds). Fire-and-forget (logSystemEvent self-catches); all fields null-guarded (no undefined → Firestore-safe). No behavior change to grading itself. Purpose: classify the connection-error epidemic (timeout vs unreachable vs offline vs server) by class + network. `npm run build` before push. |
| 2026-06-17 | `src/pages/DailySessionFlow.jsx`, `src/pages/TypedTest.jsx`, `src/pages/MCQTest.jsx` | Codex Blockers #1+#2: (#1) handleReturnFromTest now gates Day-2+ moveToReviewPhase on `results.score >= retakeThreshold` — a failed new-word test (incl. via the results back-button) routes to NEW_WORDS retake instead of review. (#2) TypedTest/MCQTest now capture `completeSessionFromTest()` return; on `requiresNewWordRetake` they block (setGradingError/setSubmitError + early return) instead of falsely presenting the day as complete. Parse-checked (esbuild). NOTE: also need `firebase firestore:indexes` export committed (Codex #3) + `npm run build` before push. |
| 2026-05-31 | `public/help-teacher-ko.html`, `public/help-teacher-en.html` | Resectioned both teacher guides to front-load top TA tasks: moved Gradebook from 6th to 3rd (now: 1 Getting Started, 2 TA/Admin Access, 3 Gradebook, 4 Class Management, 5 Word List Management, 6 Assigning Word Lists, 7 FAQ). Renumbered TOC, section-number spans, and section comments. EN file was missing the TA/Admin Access section so added it as section 2 (translated from KO) to keep the two files parallel. No prose rewrites. |
| 2026-06-01 | `CODE_REVIEW_2026-06-01.md` | Added full multi-agent code audit report (vocaBoost excl. apBoost): 72 verified findings (0 blocker / 7 high), severity-ranked + systemic patterns |
| 2026-05-31 | `scripts/seed-26sm-classes.js` | Created seeder that creates 28 26SM SAT classes in production with appropriate Base Camp (pace=60, size=25, threshold=90) or Ascent (pace=80, size=30, threshold=92) tier defaults; auto-assigns the matching VZIP 3K list; auto-detects weekend ([주말]) classes for studyDaysPerWeek=2 |
| 2026-05-31 | Firebase production | Created 28 26SM SAT classes via seed-26sm-classes.js (16 Base Camp / 12 Ascent); each with auto-generated unique 6-char joinCode, veterans@vocaboost.com as ownerTeacherId, list assignment baked in. Join codes recorded in audit/playwright/seeded_26sm_classes.json (gitignored) |
| 2026-05-31 | `.gitignore` | Added pattern `audit/playwright/seeded_*.json` so the new 26SM class output file (with join codes) doesn't get committed |
| 2026-05-31 | `scripts/update-26sm-classes.js` | Created script + updated all 28 26SM SAT class assignments to corrected tier definitions: BRIDGE pace 60 (3 classes), INT/CORE pace 80 (12), ADV/Top pace 80 (10), FINAL pace 100 (3). Set testOptionsCount=6 for all (6-choice MCQ review). testMode=typed and reviewTestType=mcq preserved across all. studyDaysPerWeek preserved (2 for [주말], 5 otherwise) |
| 2026-05-31 | `scripts/update-26sm-classes.js` + Firebase | Bumped FINAL tier testSizeNew from 30 → 35; reran update across all 28 (effective change on 3 FINAL classes only) |
| 2026-01-02 | `src/pages/Dashboard.jsx` | Removed Panic Mode warning banner (lines 1300-1312) |
| 2026-01-02 | `src/pages/DailySessionFlow.jsx` | Fixed daily pace calculation - changed `pace * 7` to `pace * studyDaysPerWeek` (line 467) |
| 2026-01-02 | `src/pages/ClassDetail.jsx` | Added `studyDaysPerWeek` setting to Edit List Settings modal |
| 2026-01-03 | `src/services/db.js` | Fixed duplicate class fetches in `fetchUserAttempts` - now caches `assignedLists` (lines 2610-2667) |
| 2026-01-03 | `src/services/db.js` | Fixed `removeStudentFromClass` to also remove from user's `enrolledClasses` (lines 259-268) |
| 2026-01-03 | `src/services/db.js` | Added `testType` parameter to `submitTestAttempt` function (line 1313) |
| 2026-01-03 | `src/services/db.js` | Fixed `joinClass` to verify user document exists before proceeding (lines 795-797) |
| 2026-01-03 | `src/services/studyService.js` | Fixed `buildReviewQueue` to fetch today's failed words directly by ID instead of filtering from segment (lines 481-500) |
| 2026-01-03 | `src/services/studyService.js` | Added blind spot count caching to `getBlindSpotPool` and `getBlindSpotCount` for efficiency |
| 2026-01-03 | `src/pages/Dashboard.jsx` | Updated `getBlindSpotCount` call to pass `classId` for caching (line 529) |
| 2026-01-03 | `src/services/db.js` | Optimized `fetchDashboardStats` to use Firestore orderBy + limit(1) for latest attempt instead of client-side sort (lines 396-402) |
| 2026-01-03 | `src/services/db.js` | Optimized `fetchUserAttempts` to use Firestore orderBy for sorted results, removed client-side sort (lines 2592-2686) |
| 2026-01-03 | `src/pages/ClassDetail.jsx` | Added `passThreshold` and `testSizeNew` to Edit List Settings modal |
| 2026-01-03 | `src/components/AssignListModal.jsx` | Added `passThreshold` and `testSizeNew` to initial assignment settings |
| 2026-01-03 | `src/services/db.js` | Updated `assignListToClass` to accept and save `passThreshold` and `testSizeNew` |
| 2026-01-03 | `src/pages/MCQTest.jsx` | Read `passThreshold` and `testOptionsCount` from assignment instead of hardcoded values |
| 2026-01-03 | `src/pages/TypedTest.jsx` | Read `passThreshold` from assignment instead of hardcoded value |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Fixed `interventionLevel: undefined` error by adding default value of 0 (line 976) |
| 2026-01-03 | `src/services/progressService.js` | Added duplicate day completion guard - blocks re-submission if dayNumber doesn't match expected next day (lines 98-103) |
| 2026-01-03 | `src/services/db.js` | **Box Removal Migration** - Fixed retention calculation to use test score directly instead of filtering by box >= 4 |
| 2026-01-03 | `src/services/db.js` | Fixed mastery count in `fetchDashboardStats` to use `status === 'PASSED'` instead of `box >= 4` |
| 2026-01-03 | `src/services/db.js` | Fixed words learned count in `fetchStudentAggregateStats` to use status instead of box |
| 2026-01-03 | `src/services/db.js` | Removed box updates from `submitTestAttempt` and `submitTypedTestAttempt` - status updates handled by processTestResults |
| 2026-01-03 | `src/services/db.js` | Fixed challenge bug in `reviewChallenge` - now updates status to PASSED instead of box |
| 2026-01-14 | `src/pages/DailySessionFlow.jsx` | Fixed test recovery sessionContext - added missing fields (segment, interventionLevel, wordsIntroduced, wordsReviewed, newWordStartIndex, newWordEndIndex) to prevent TWI reconciliation failures |
| 2026-01-14 | `scripts/export-attempts.js` | Created script to export all Firestore attempts to flattened JSON |
| 2026-01-14 | `scripts/export-users.js` | Created script to export all Firestore users to flattened JSON |
| 2026-01-03 | `src/services/db.js` | Deleted unused box functions: `computeNextReview`, `nextBoxValue`, `saveStudyResult` |
| 2026-01-03 | `src/services/db.js` | Deleted unused legacy test generators: `generateTest`, `generateTypedTest` |
| 2026-01-03 | `src/services/db.js` | Simplified `normalizeStudyState` to just merge defaults with document |
| 2026-01-03 | `src/types/studyTypes.js` | Removed legacy box-related JSDoc comments |
| 2026-01-03 | `src/services/db.js` | Added day progression trigger in `reviewChallenge` when challenge acceptance pushes score above threshold (lines 2544-2589) |
| 2026-01-03 | `src/services/studyService.js` | Fixed PDF pace calculation - changed `pace * 7` to `pace * studyDaysPerWeek` in `getTodaysBatchForPDF` and `getCompleteBatchForPDF` |
| 2026-01-03 | `src/services/studyService.js` | Added failed carryover words to `getTodaysBatchForPDF` - returns structured `{ newWords, failedCarryover, reviewWords }` |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Updated `downloadListAsPDF` to handle structured format with demarcated sections for new words vs failed carryover |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Updated PDF handler to preserve structured format when calling `downloadListAsPDF` |
| 2026-01-03 | `src/pages/Dashboard.jsx` | Updated PDF handler to preserve structured format when calling `downloadListAsPDF` |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Added logo image to PDF header with aspect-ratio-preserving sizing (fixed 10mm height, auto width) |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Changed column widths to responsive: `wrap` for #/Word/POS, `auto` for Definition/Sample |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Added `rowPageBreak: 'avoid'` to prevent table rows from splitting across pages |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Rewrote `calculateSegment` function - now uses intervention-adjusted projection with week-based segment rotation instead of cumulative days 2-4 logic |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Commented out `EARLY_DAYS_THRESHOLD` constant (no longer needed) |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Added legacy `calculateSegment` as comment block for reference |
| 2026-01-03 | `src/services/studyService.js` | Updated `calculateSegment` call to pass `dailyPace` and `interventionLevel` parameters (lines 81-87) |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Updated review test size constants from 20-50 to 30-60 |
| 2026-01-03 | `src/utils/studyAlgorithm.js` | Updated `calculateReviewTestSize` to accept optional `minSize` and `maxSize` parameters for teacher-configurable ranges |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Removed failed carryover mixing - NEW_WORDS phase now shows only new words (failed words handled via segment review priority) |
| 2026-01-03 | `src/components/AssignListModal.jsx` | Added review test settings: `reviewTestType`, `reviewTestSizeMin`, `reviewTestSizeMax` |
| 2026-01-03 | `src/pages/ClassDetail.jsx` | Added review test settings section to Edit List Settings modal |
| 2026-01-03 | `src/services/db.js` | Updated `assignListToClass` to accept and save review test settings |
| 2026-01-03 | `src/services/db.js` | Updated `updateAssignmentSettings` to handle review test settings validation |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Updated `goToReviewTest` to use `reviewTestType` from assignment settings |
| 2026-01-03 | `src/utils/pdfGenerator.js` | Added reviewWords section with green header (#22C55E) and light green table background (#DCFCE7) |
| 2026-01-03 | `session-time-calculator.html` | Added synchronized slider + textbox inputs for all parameters (pace, test sizes, intervention, time constants, pool settings, algorithm constants) |
| 2026-01-03 | `session-time-calculator.html` | Added Graduation Model section with dynamic calculation of avg tests to graduate based on student accuracy (%), consecutive correct needed, and new test bonus checkbox |
| 2026-01-03 | `src/types/studyTypes.js` | Added `MASTERED` and `NEEDS_CHECK` to `WORD_STATUS` enum for graduation system |
| 2026-01-03 | `src/types/studyTypes.js` | Added `masteredAt` and `returnAt` fields to `DEFAULT_STUDY_STATE` |
| 2026-01-03 | `src/services/studyService.js` | Added `graduateSegmentWords()` - graduates X% of PASSED words where X = review test score |
| 2026-01-03 | `src/services/studyService.js` | Added `returnMasteredWords()` - returns MASTERED words to NEEDS_CHECK after 21 days |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Added `returnMasteredWords` call before session initialization |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Added `graduateSegmentWords` call after review test in `completeSession` |
| 2026-01-03 | `src/pages/MCQTest.jsx` | Fixed retake shuffling - now re-shuffles words using `selectTestWords()` to avoid identical test order |
| 2026-01-03 | `src/components/DismissedWordsDrawer.jsx` | NEW: Right-side drawer component for viewing/restoring dismissed words |
| 2026-01-03 | `src/pages/DailySessionFlow.jsx` | Added dismissed words drawer with undo functionality - stores full word data on dismiss, toggle button in header, restore individual or all |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Fixed challenge bug - capture `attemptId` from `submitTestAttempt` return value and call `setAttemptId(result.id)` |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Fixed challenge bug - capture `attemptId` from `submitTypedTestAttempt` return value and call `setAttemptId(result.id)` |
| 2026-01-04 | `src/utils/testConfig.js` | **NEW FILE** - Centralized test configuration builder with `buildTestConfig()` function. Single source of truth for test parameters, applies testSizeNew limiting to word pools. |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | Added import for `buildTestConfig`; Updated `navigateToTest()` to build testConfig and pass as single object (words now limited by testSizeNew before navigation) |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Refactored to consume `testConfig` from navigation state with backwards compatibility for legacy props; Added testConfig path in `loadTestWords()` |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Refactored to consume `testConfig` from navigation state with backwards compatibility for legacy props; Added testConfig path in `loadTestWords()` |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Navigation Simplification** - Simplified `CompletePhase` to single "Back to Dashboard" button; Removed unused props (`onMoveOn`, `onNext`, `onRetakeReview`); Removed retake warning box |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | Removed `showMoveOnConfirm` and `showNextSessionModal` state variables; Deleted Move On Confirmation and Next Session modals |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | Removed unused `handleRetakeReviewTest` function |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Changed quit handler to always navigate to `/` (Dashboard) instead of `returnPath` |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Replaced "Study" button with "Dashboard" on failed new word tests |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Added "Dashboard" button to needs-work and critical review test tiers (alongside Retake) |
| 2026-01-04 | `src/pages/MCQTest.jsx` | Removed unused `handleGoToStudy` function |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Changed quit handler to always navigate to `/` (Dashboard) instead of `returnPath` |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Replaced "Study" button with "Dashboard" on failed new word tests |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Added "Dashboard" button to needs-work and critical review test tiers (alongside Retake) |
| 2026-01-04 | `src/pages/TypedTest.jsx` | Removed unused `handleGoToStudy` function |
| 2026-01-04 | `NAVIGATION_AUDIT.md` | **NEW FILE** - Comprehensive navigation audit documenting all 68 navigation elements across 21 files, including button destinations, redirects, and 3 dead route issues |
| 2026-01-04 | `scripts/migrateWordPositions.js` | **NEW FILE** - One-time migration script to add `position` field to existing words based on `createdAt` order |
| 2026-01-04 | `src/services/db.js` | **Word Position Refactor** - `addWordToList()` now assigns `position: currentCount` (0-indexed) to new words |
| 2026-01-04 | `src/services/db.js` | **Word Position Refactor** - `batchAddWords()` now assigns sequential positions starting from current wordCount |
| 2026-01-04 | `src/services/db.js` | **Word Position Refactor** - `fetchAllWords()` changed `orderBy('createdAt', 'asc')` → `orderBy('position', 'asc')` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getSegmentWords()` uses `orderBy('position')` and filters by `w.position` instead of computed `wordIndex` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `initializeNewWordStates()` uses `word.position` instead of `word.wordIndex` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getFailedFromPreviousNewWords()` uses `orderBy('position')` and filters by `w.position` |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getNewWords()` uses `orderBy('position')` and filters by position range |
| 2026-01-04 | `src/services/studyService.js` | **Word Position Refactor** - `getBlindSpotPool()` uses `orderBy('position')` instead of `createdAt` |
| 2026-01-04 | `src/pages/ListEditor.jsx` | **Word Position Refactor** - All 3 word queries changed from `orderBy('createdAt')` to `orderBy('position')` |
| 2026-01-04 | `src/pages/MCQTest.jsx` | **Word Position Refactor** - Fallback query uses `orderBy('position')`, removed dynamic `wordIndex` assignment |
| 2026-01-04 | `src/pages/TypedTest.jsx` | **Word Position Refactor** - Fallback query uses `orderBy('position')`, removed dynamic `wordIndex` assignment |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Word Position Refactor** - Removed `wordIndex` mapping; words already have `position` field |
| 2026-01-04 | `src/utils/pdfGenerator.js` | **Word Position Refactor** - Changed `word.wordIndex ?? word.index` to `word.position` for word numbering |
| 2026-01-04 | `src/pages/Dashboard.jsx` | **Performance** - Parallelized progress data loading using `Promise.all` instead of sequential `for...await` loops (lines 543-586) |
| 2026-01-04 | `src/components/dev/SegmentDebugPanel.jsx` | **NEW FILE** - Collapsible debug panel showing segment boundaries, session config, and word-level queue details |
| 2026-01-04 | `src/services/studyService.js` | Added `getDebugSessionData()` export for debug panel - returns sessionConfig, reviewQueue, and segmentWords |
| 2026-01-04 | `src/pages/Dashboard.jsx` | Added SegmentDebugPanel component to list cards (dev-only via `import.meta.env.DEV`) |
| 2026-01-04 | `src/services/studyService.js` | **Full Segment PDF** - `getTodaysBatchForPDF()` now uses `getSegmentWords()` instead of `buildReviewQueue()` to show ALL segment words |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Full Segment Study** - Session initialization and `moveToReviewPhase()` now use `getSegmentWords()` for REVIEW_STUDY phase |
| 2026-01-04 | `src/services/studyService.js` | **Bug Fix** - `getDebugSessionData()` now transforms assignment with `weeklyPace = pace * studyDaysPerWeek` (matching `getTodaysBatchForPDF` pattern) |
| 2026-01-04 | `src/pages/DailySessionFlow.jsx` | **Bug Fix** - Fixed "No Test Content" error on review tests: `navigateToTest()` now passes `reviewQueue` instead of `null` for review test wordPool (line 1014) |
| 2026-01-04 | `src/pages/MCQTest.jsx` | **Shuffle Fix** - Added `shuffleArray` import; Fixed biased distractor selection and option ordering to use Fisher-Yates instead of `sort(() => Math.random() - 0.5)` (lines 195, 206) |
| 2026-01-04 | `src/pages/TypedTest.jsx` | **Shuffle Fix** - Fixed biased retake shuffle to use `shuffleArray()` instead of `sort(() => Math.random() - 0.5)` (line 650) |
| 2026-01-04 | `src/services/studyService.js` | **Shuffle Fix** - Added `shuffleArray` import; Fixed biased graduation selection to use Fisher-Yates instead of `sort(() => Math.random() - 0.5)` (line 781) |
| 2026-01-05 | `src/services/studyService.js` | **Bug Fix** - `graduateSegmentWords()` now writes `wordIndex` and `listId` to Firebase batch (lines 802-803). Debug panel's `getMasteredWordsInRange()` filters by `wordIndex`, so graduated words were invisible without this field. |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | Added `newWordStartIndex` and `newWordEndIndex` to sessionContext (lines 1062-1063) |
| 2026-01-09 | `src/services/db.js` | Added `sessionContext` parameter to `submitTestAttempt` function (line 1003) |
| 2026-01-09 | `src/services/db.js` | Added 9 flattened session context fields to `submitTestAttempt` attemptData: `isFirstDay`, `listTitle`, `segmentStartIndex`, `segmentEndIndex`, `interventionLevel`, `wordsIntroduced`, `wordsReviewed`, `newWordStartIndex`, `newWordEndIndex` (lines 1064-1073) |
| 2026-01-12 | `src/utils/sessionStepTracker.js` | **NEW FILE** - Centralized step calculation utility with `getSessionStep()` function. Returns `{ stepNumber, totalSteps, stepText }` based on phase or testType. |
| 2026-01-12 | `src/utils/sessionStepTracker.js` | Fixed switch cases to use lowercase phase constants (`'new_words'`, `'review_study'`, `'complete'`) instead of uppercase |
| 2026-01-12 | `src/pages/MCQTest.jsx` | Replaced custom header (lines 1037-1072) with SessionHeader component on active test screen; Added step tracker import and usage |
| 2026-01-12 | `src/pages/MCQTest.jsx` | Updated results screen to use `getSessionStep()` utility instead of inline calculation (lines 730-731) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | Updated active test screen and results screen to use `getSessionStep()` utility instead of inline calculation (lines 780-781, 1079-1080, 1122-1124) |
| 2026-01-12 | `src/pages/DailySessionFlow.jsx` | Updated to use `getSessionStep()` utility instead of inline calculation (lines 1558-1567) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **Review Test UX** - Updated button labels for all 4 tiers: Excellent → "Continue" (was "Return to Dashboard"); Good → swapped button order; Needs Work & Critical → "Review Again" + "Continue" (was "Retake Test" + "Dashboard") |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **Review Test UX** - "Review Again" button now navigates with `goToStudy: true` state to return user to review study flashcards instead of retaking test |
| 2026-01-12 | `src/pages/MCQTest.jsx` | **Review Test UX** - Updated button labels for all 4 tiers: Excellent → "Continue"; Good → swapped button order; Needs Work & Critical → "Review Again" + "Continue" |
| 2026-01-12 | `src/pages/MCQTest.jsx` | **Review Test UX** - "Review Again" button now navigates with `goToStudy: true` state to return user to review study flashcards instead of retaking test |
| 2026-01-09 | `src/services/db.js` | Added `sessionContext` parameter to `submitTypedTestAttempt` function (line 1121) |
| 2026-01-09 | `src/services/db.js` | Added 9 flattened session context fields to `submitTypedTestAttempt` attemptData (lines 1215-1224) |
| 2026-01-09 | `src/pages/MCQTest.jsx` | Pass `sessionContext` to `submitTestAttempt` call (line 539) |
| 2026-01-09 | `src/pages/TypedTest.jsx` | Pass `sessionContext` to `submitTypedTestAttempt` call (line 636) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `isTransientError()` helper to identify retryable Firebase errors (lines 44-55) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `addJitter()` helper for exponential backoff randomization (lines 57-61) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `withRetry()` generic retry wrapper with exponential backoff and logging (lines 63-109) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `logSystemEvent()` for anomaly logging to `system_logs` collection (lines 111-125) |
| 2026-01-09 | `src/services/db.js` | **Solution #3** - Added `listId` parameter to `submitTestAttempt()` and `submitTypedTestAttempt()` |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #3** - Wrapped `submitTestAttempt()` with `withRetry()` for transient failure recovery |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #3** - Added `submitError` state and error UI with "Try Again" button |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #3** - Added `beforeunload` handler to warn before leaving with unsaved answers |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #3** - Wrapped `submitTypedTestAttempt()` with `withRetry()` for transient failure recovery |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #3** - Added `submitError` state and error UI with "Try Again" button |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #3** - Added `beforeunload` handler to warn before leaving with unsaved answers |
| 2026-01-09 | `src/services/db.js` | **Solution #1** - Added `getRecentAttemptsForClassList()` to query recent attempts by studentId/classId/listId |
| 2026-01-09 | `src/services/progressService.js` | **Solution #1** - Added `calculateCSDAndTWIFromAttempts()` to derive CSD/TWI from attempt history |
| 2026-01-09 | `src/services/progressService.js` | **Solution #1** - Modified `getOrCreateClassProgress()` to reconcile CSD/TWI and return `{ progress, attempts }` |
| 2026-01-09 | `src/services/progressService.js` | **Solution #1** - Added `logSystemEvent('csd_twi_reconciled', ...)` when mismatch detected |
| 2026-01-09 | `src/services/studyService.js` | **Solution #1** - Updated `initializeDailySession()` to destructure `{ progress, attempts }` |
| 2026-01-09 | `src/pages/MCQTest.jsx` | **Solution #1** - Updated `getOrCreateClassProgress()` call to destructure `{ progress }` (line 525) |
| 2026-01-09 | `src/pages/TypedTest.jsx` | **Solution #1** - Updated `getOrCreateClassProgress()` call to destructure `{ progress }` (line 621) |
| 2026-01-09 | `src/services/studyService.js` | **Solution #2** - Added `determineStartingPhase()` to detect mid-session or complete states from attempts (lines 57-95) |
| 2026-01-09 | `src/services/studyService.js` | **Solution #2** - Added `logSystemEvent('impossible_phase_detected', ...)` for Day 1 anomaly |
| 2026-01-09 | `src/services/studyService.js` | **Solution #2** - Updated `initializeDailySession()` to return `startPhase`, `recoveredNewWordScore`, `recoveredReviewScore` |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Solution #2** - Added startPhase handling in init: COMPLETE skips to completion, REVIEW_STUDY loads segment words and skips new word phase (lines 604-639) |
| 2026-01-09 | `src/services/progressService.js` | **Bug Fix #4** - Added Math.max safeguard to prevent CSD/TWI regression if query returns empty/incomplete data (lines 117-119) |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Bug Fix #6** - Fixed undefined `combinedWords` variable in test recovery - now uses `testRecovery.localState?.wordPool` (lines 696, 713) |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Bug Fix #7** - Added `setCardsReviewed(0)` to REVIEW_STUDY recovery to reset card count (line 633) |
| 2026-01-09 | `src/pages/DailySessionFlow.jsx` | **Bug Fix #8** - Wrapped `getSegmentWords` in try-catch for REVIEW_STUDY recovery with error UI fallback (lines 620-645) |
| 2026-01-11 | `src/pages/MCQTest.jsx` | **Rollback** - Removed all pending submission localStorage recovery work (Steps R1-R8): removed `isResumingSubmission` and `showConnectionWarning` states, removed `resumePendingSubmission` function, restored simple testRecovery useEffect, removed all pending submission save/clear logic in handleSubmit, removed resuming submission UI, simplified submission overlay to show only "Submitting Your Test..." with retry button on error |
| 2026-01-11 | `src/pages/TypedTest.jsx` | Added simple submission overlay modal (lines 1259-1288) matching MCQTest's simplified approach - full-screen modal with "Submitting Your Test..." message, spinner, and retry button on error |
| 2026-01-11 | `src/pages/TypedTest.jsx` | Removed inline `submitError` display (previously lines 1182-1200) - error handling now centralized in submission overlay modal |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added retry state variables `retryAttempt` and `gradingError` (lines 97-99) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added `gradeWithRetry()` function with 3 max retries, 10s delay between retries, 90s timeout per attempt (lines 572-603) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Updated `handleSubmit()` to use `gradeWithRetry()` instead of direct API call, added retry state initialization (lines 605-628) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added `handleRetryGrading()` for manual retry after all attempts fail (lines 753-757) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Updated submission overlay to show retry status on attempts 2-3 with yellow warning and attempt counter (lines 1287-1314) |
| 2026-01-12 | `src/pages/TypedTest.jsx` | **AI Grading Retry Logic** - Added separate grading error modal with manual "Try Again" button after 3 failed attempts, preserves student answers (lines 1332-1355) |
| 2026-01-12 | `src/services/db.js` | **Challenge Bug Fix** - `reviewChallenge()` now updates `passed` field when challenge is accepted. Previously only `score` was updated, leaving `passed: false` even when score crossed threshold. This caused reconciliation to not advance days. (lines 2606-2628) |
| 2026-01-12 | `CLAUDE.md` | Fixed filename reference from `changes_action_log.md` to `change_action_log.md` and added table format hint |
| 2026-01-12 | `CLAUDE.md` | Added apBoost rule to log changes to `change_action_log_ap.md` instead of main log |
| 2026-01-12 | `change_action_log_ap.md` | **NEW FILE** - Separate change log for apBoost development |
| 2026-01-13 | `updated_tech_spec_vocaboost.md` | **NEW FILE** - Complete technical specification document with 15 sections covering architecture, routing, pages, components, design system, state management, services, data models, algorithms, study flow, utilities, dev tools, and security |
| 2026-01-19 | `src/services/progressService.js` | **TWI Bug Fix** - Changed reconciliation TWI calculation to use most recent new test instead of exact CSD-level match (lines 86-97). Previous logic failed when no new test existed at exact CSD level. |
| 2026-01-19 | `src/services/progressService.js` | **TWI Bug Fix** - Added fallback TWI fetch: if TWI=0 with CSD>0, calls `getMostRecentNewTest()` to recover TWI from any new test (lines 167-176) |
| 2026-01-19 | `src/services/db.js` | **NEW FUNCTION** - Added `getMostRecentNewTest()` helper for fallback TWI reconciliation - queries only new tests with sessionType filter (lines 3016-3060) |
| 2026-01-19 | `src/services/studyService.js` | **TWI Bug Fix** - Changed `wordsIntroduced` to use `sessionConfig.newWordCount` as primary source instead of `newWords.length` which was often 0 (line 1087) |
| 2026-01-19 | `src/services/progressService.js` | **Anchor-Based Reconciliation** - Rewrote `calculateCSDAndTWIFromAttempts()` to use NEW TEST as anchor for both CSD and TWI (lines 40-102). CSD and TWI now derived from same source to prevent mismatch. |
| 2026-01-19 | `src/services/progressService.js` | **Orphan Cleanup** - Added `cleanupOrphanedReviews()` function to delete review tests where `studyDay > anchorDay`. Logs full attempt data to `system_logs` before deletion (lines 115-155). |
| 2026-01-19 | `src/services/progressService.js` | **Orphan Cleanup** - Updated `getOrCreateClassProgress()` to call `cleanupOrphanedReviews()` after calculating anchor day (lines 212-215) |
| 2026-01-26 | `scripts/advance-student-to-day.js` | **NEW SCRIPT** - Admin script to advance a student's progress when transferring between classes (CORE→TOP). Inserts synthetic NEW + REVIEW attempts and resets class_progress/session_states so reconciliation sets correct CSD/TWI. Used to advance Sarang Min (love0609m@gmail.com) to Day 11 in TOP OFFLINE class. |
| 2026-02-03 | `src/services/db.js` | **NEW FUNCTION** - Added `getMostRecentPassedNewTest()` to query only PASSED new tests for reconciliation anchor (lines 3066-3111). Fixes bug where failed new tests incorrectly advanced TWI. |
| 2026-02-03 | `src/services/db.js` | **NEW FUNCTION** - Added `getReviewForDay()` to check if review exists for specific study day (lines 3113-3153). Used by reconciliation to determine CSD. |
| 2026-02-03 | `src/services/progressService.js` | **CRITICAL BUG FIX** - Rewrote reconciliation to use two-query approach: (1) find anchor from PASSED new tests only, (2) check if review exists for anchor day. Previously, failed new tests were used as anchors, causing TWI to advance and students to skip word ranges on retry. |
| 2026-02-03 | `src/services/progressService.js` | Removed old `calculateCSDAndTWIFromAttempts()` function, replaced with direct calls to new db.js query helpers. |
| 2026-02-03 | `scripts/check-single-student.js` | Updated reconciliation analysis to only consider PASSED new tests as anchors, matching new app logic. |

---

## Phase 4: Word Position Field Refactor

**Date:** 2026-01-04

### Problem Statement

Word indices were computed at runtime from array position after `orderBy('createdAt', 'asc')`. This design was fragile because:
- Timestamps can be inconsistent (imports, clock skew, simultaneous adds)
- "#435 of List X" didn't point to anything specific - it was just the 435th item after sorting
- Any timestamp issues would silently corrupt word order and break segment boundaries

### Solution: Explicit `position` Field

Added permanent `position: number` field to all word documents. Words are now:
- Assigned sequential 0-indexed positions on creation
- Queried by `orderBy('position', 'asc')` instead of `createdAt`
- Filtered directly by `w.position` instead of computed array index

### New Word Document Structure

```javascript
{
  id: "abc123",
  word: "Abate",
  definition: "...",
  position: 0,        // NEW: Permanent, explicit position (0-indexed)
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### CRUD Changes

**`addWordToList()` (db.js):**
```javascript
const listDoc = await getDoc(doc(db, 'lists', listId))
const currentCount = listDoc.exists() ? (listDoc.data()?.wordCount ?? 0) : 0
const wordPayload = {
  ...wordData,
  position: currentCount,  // 0-indexed position
  createdAt: serverTimestamp(),
}
```

**`batchAddWords()` (db.js):**
```javascript
let nextPosition = listDoc.data()?.wordCount ?? 0
// Each word in batch gets sequential position
position: nextPosition++
```

### Query Changes

All `orderBy('createdAt', 'asc')` changed to `orderBy('position', 'asc')`:

| File | Function/Location |
|------|-------------------|
| `db.js` | `fetchAllWords()` |
| `studyService.js` | `getSegmentWords()`, `getFailedFromPreviousNewWords()`, `getNewWords()`, `getBlindSpotPool()` |
| `ListEditor.jsx` | `loadList()`, `reloadWords()`, `handleAddWord()` |
| `MCQTest.jsx` | Fallback load |
| `TypedTest.jsx` | Fallback load |

### Index Pattern Removal

All `.map((doc, index) => ({ wordIndex: index, ... }))` patterns changed to read `position` from document:

```javascript
// BEFORE:
const allWords = wordsSnap.docs.map((doc, index) => ({
  id: doc.id,
  wordIndex: index,
  ...doc.data()
}))
const segmentWords = allWords.filter(w => w.wordIndex >= startIndex)

// AFTER:
const allWords = wordsSnap.docs.map((doc) => ({
  id: doc.id,
  ...doc.data()
}))
const segmentWords = allWords.filter(w => w.position >= startIndex)
```

### Migration Script

**File:** `scripts/migrateWordPositions.js`

One-time script to backfill `position` field on existing words:
1. Fetches all lists
2. For each list, gets words ordered by `createdAt`
3. Assigns sequential positions (0, 1, 2, ...)
4. Batch updates all word documents

Must be run once before deploying the code changes.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Index base | 0-indexed | Matches JavaScript array semantics, simpler math |
| Gap handling | Allow gaps | Simpler than cascade updates on delete; filter logic handles gaps |
| Position on delete | No change | Gaps are fine; wordCount decrements but positions stay stable |
| Position on update | Preserved | updateDoc merges, doesn't overwrite position |

### Files Modified

| File | Changes |
|------|---------|
| `scripts/migrateWordPositions.js` | NEW - Migration script |
| `src/services/db.js` | `addWordToList`, `batchAddWords`, `fetchAllWords` |
| `src/services/studyService.js` | 5 functions updated (orderBy + position field) |
| `src/pages/ListEditor.jsx` | 3 query locations |
| `src/pages/MCQTest.jsx` | Fallback query |
| `src/pages/TypedTest.jsx` | Fallback query |
| `src/pages/DailySessionFlow.jsx` | Removed wordIndex mapping |
| `src/utils/pdfGenerator.js` | Word number from position |

### Backups

All modified files backed up to `vocaboost/backups/position-refactor/` before changes.

---

## Phase 3: Mastery Graduation System (% Culling Approach)

**Date:** 2026-01-03

### Problem Statement

Without a graduation mechanism, the review pool grows unboundedly as students learn new words each day. At 80 words/day, 5 days/week = 400 words/week with zero graduation means:
- Week 4: Pool = 1,600 words
- Week 8: Pool = 3,200 words
- Review becomes impossible to complete in reasonable time

### Solution: % Culling Graduation

After each review test, graduate **X% of PASSED words** in the segment, where **X = test score**.

```
Review test score = 80%
→ Fetch all PASSED words in today's segment
→ Randomly select 80% of them to graduate
→ Update selected words to MASTERED status
→ FAILED words always stay in pool (safety net)
```

### Why % Culling (vs Individual Streak Tracking)

| Approach | Complexity | Trigger | Per-Word Tracking |
|----------|------------|---------|-------------------|
| Streak (old design) | High | Every test result | `correctStreak` field |
| **% Culling (implemented)** | **Low** | **After review test only** | **None needed** |

**Key insight:** FAILED words provide the safety net. We're graduating from words the student got RIGHT on the test - the test itself is the verification. No need for additional per-word streak tracking.

### Design Decisions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Graduation trigger | After review test | Segment-level, not per-word |
| Graduation rate | X% where X = test score | Proportional to demonstrated knowledge |
| Pool for graduation | PASSED words in segment | All segment PASSED words, not just tested |
| FAILED words | Never graduate | Safety net - always stay for more practice |
| Return delay | 21 days | Matches existing blind spot threshold |
| Conservative rounding | `Math.floor` | Avoid over-graduating on small pools |

### New Status Values

```javascript
export const WORD_STATUS = {
  NEW: 'NEW',
  NEVER_TESTED: 'NEVER_TESTED',
  FAILED: 'FAILED',
  PASSED: 'PASSED',
  MASTERED: 'MASTERED',      // NEW: Graduated from review pool
  NEEDS_CHECK: 'NEEDS_CHECK' // NEW: Returned from MASTERED after 21 days
};
```

### Study State Document Changes

```javascript
// Added to DEFAULT_STUDY_STATE:
{
  masteredAt: null,    // Timestamp when word became MASTERED
  returnAt: null       // Timestamp when word should return (masteredAt + 21 days)
}
```

### Core Functions Implemented

#### `graduateSegmentWords(userId, listId, segment, testScore)`
**Location:** `src/services/studyService.js` (lines 745-793)

1. Fetches all segment words with current status
2. Filters to PASSED words only (excludes FAILED, NEVER_TESTED, MASTERED, NEEDS_CHECK)
3. Calculates graduation count: `Math.floor(passedWords.length * testScore)`
4. Randomly selects words to graduate (Fisher-Yates shuffle + slice)
5. Batch updates selected words to MASTERED status with 21-day return timestamp
6. Returns `{ graduated: number, remaining: number }`

#### `returnMasteredWords(userId, listId)`
**Location:** `src/services/studyService.js` (lines 803-829)

1. Queries for MASTERED words where `returnAt <= now`
2. Batch updates them to NEEDS_CHECK status
3. Clears `masteredAt` and `returnAt` fields
4. Returns count of words returned to pool

### Integration Points

**Session Initialization (DailySessionFlow.jsx line 477):**
```javascript
// Return any MASTERED words that have passed their 21-day period
await returnMasteredWords(user.uid, listId)
```

**Session Completion (DailySessionFlow.jsx lines 997-1008):**
```javascript
// Graduate percentage of PASSED words from segment after review test
if (sessionConfig?.segment && reviewTestResults?.score !== undefined) {
  graduationResult = await graduateSegmentWords(
    user.uid,
    listId,
    sessionConfig.segment,
    reviewTestResults.score
  )
}
```

### Pool Dynamics (Projected at 80% Accuracy)

**Scenario: 80 words/day, 5 days/week = 400 words/week**

| Week | Inflow | Segment PASSED | Graduate (80%) | Net Pool Growth |
|------|--------|----------------|----------------|-----------------|
| 1 | 400 | ~256 | ~205 | +195 |
| 2 | 400 | ~320 | ~256 | +144 |
| 3 | 400 | ~350 | ~280 | +120 |
| 4 | 400 | ~360 | ~288 | +112 (+ returns) |
| 8+ | 400 | ~400 | ~320 | Stabilizes ~800-1000 |

**Key insight:** Weekly graduation rate ≈ `score × PASSED% × inflow` = 0.80 × 0.80 × 400 = **256 words/week**

With 400 inflow and ~256 graduation, pool grows slowly then stabilizes when returns balance.

### Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| No PASSED words in segment | Returns `{ graduated: 0, remaining: 0 }` |
| 100% test score | Graduates all PASSED words in segment |
| 0% test score | Graduates 0 words (all stay for practice) |
| All segment words MASTERED | No PASSED words to graduate, early return |
| Day 1 (no segment) | Skip review phases, no graduation call |
| Small pool (e.g., 3 words at 85%) | `Math.floor(3 * 0.85) = 2` (conservative) |
| NEEDS_CHECK word passes test | Status → PASSED; then eligible for graduation |
| NEEDS_CHECK word fails test | Status → FAILED; stays in pool |

### Files Modified

| File | Changes |
|------|---------|
| `src/types/studyTypes.js` | Added `MASTERED`, `NEEDS_CHECK` to `WORD_STATUS`; Added `masteredAt`, `returnAt` to `DEFAULT_STUDY_STATE` |
| `src/services/studyService.js` | Added `graduateSegmentWords()` and `returnMasteredWords()` functions |
| `src/pages/DailySessionFlow.jsx` | Added imports; Call `returnMasteredWords()` on init; Call `graduateSegmentWords()` after review test |

### Files NOT Needing Changes

- `src/utils/studyAlgorithm.js` - Segments still use `totalWordsIntroduced` (stable boundaries)
- `src/services/db.js` - `normalizeStudyState()` already spreads `DEFAULT_STUDY_STATE`
- `processTestResults()` - Kept as-is (just updates PASSED/FAILED)
- Test components - No changes needed

### Future Enhancements (Not Yet Implemented)

1. **Graduation Feedback UI** - Show user how many words graduated after review test
2. **Dashboard Mastered Count** - Add mastered word count alongside "Learned" count
3. **Progress Visualization** - Progress ring showing New → Active → Mastered percentages

---

## Phase 5: Session Fragility Fixes

**Date:** 2026-01-09

### Problem Statement

Sessions were fragile due to three interrelated issues:

1. **Attempt writes could fail silently** - Network failures during test submission could lose student work
2. **CSD/TWI could drift from reality** - `class_progress` fields could become inconsistent with actual attempt history
3. **Mid-session crashes lost progress** - If a student completed the new word test but crashed before review, they'd restart from scratch

### Solution Overview

Implemented three fixes from `session_fragility_fix_proposal.md`:

| Solution | Purpose | Key Mechanism |
|----------|---------|---------------|
| #3: Bulletproof Attempt Writing | Prevent data loss on network failures | Retry with exponential backoff |
| #1: CSD/TWI Reconciliation | Self-healing progress tracking | Derive CSD/TWI from attempts on load |
| #2: Init-Based Phase Detection | Resume mid-session | Check attempts to determine starting phase |

---

### Solution #3: Bulletproof Attempt Writing

#### Problem
Firebase writes can fail due to transient network issues. Without retry logic, a student could complete a test, have the submission fail, and lose all their work.

#### Implementation

**New helpers in `db.js`:**

```javascript
// Identify retryable errors (network, unavailable, etc.)
function isTransientError(error) {
  const transientCodes = [
    'unavailable', 'resource-exhausted', 'deadline-exceeded',
    'cancelled', 'unknown', 'internal', 'aborted'
  ];
  return transientCodes.includes(error?.code);
}

// Add ±25% jitter to prevent thundering herd
function addJitter(baseDelayMs) {
  const jitter = baseDelayMs * 0.25 * (Math.random() * 2 - 1);
  return Math.max(0, baseDelayMs + jitter);
}

// Generic retry wrapper with exponential backoff
async function withRetry(fn, options = {}, loggingContext = {}) {
  const { maxRetries = 3, totalTimeoutMs = 15000 } = options;
  // Retries with 1s, 2s, 4s delays (with jitter)
  // Logs success after retry or final failure to system_logs
}
```

**System logging helper:**

```javascript
export async function logSystemEvent(eventType, data, severity = 'warning') {
  // Writes to system_logs collection for anomaly monitoring
  // Fire-and-forget (doesn't block on errors)
}
```

**Test component changes (MCQTest.jsx, TypedTest.jsx):**

1. Wrap `submitTestAttempt()` / `submitTypedTestAttempt()` with `withRetry()`
2. Add `submitError` state for error UI display
3. Show "Try Again" button when submission fails after all retries
4. Add `beforeunload` handler to warn before leaving with unsaved answers

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/db.js` | Added `isTransientError()`, `addJitter()`, `withRetry()`, `logSystemEvent()` |
| `src/services/db.js` | Added `listId` parameter to submit functions |
| `src/pages/MCQTest.jsx` | Retry wrapper, error UI, exit confirmation |
| `src/pages/TypedTest.jsx` | Retry wrapper, error UI, exit confirmation |

---

### Solution #1: CSD/TWI Reconciliation

#### Problem
`class_progress` stores `currentStudyDay` (CSD) and `totalWordsIntroduced` (TWI). These could drift from reality if:
- Session completion failed mid-write
- Race conditions between concurrent requests
- Bugs in progression logic

#### Implementation

**New query in `db.js`:**

```javascript
export async function getRecentAttemptsForClassList(userId, classId, listId, maxResults = 8) {
  // Query attempts collection by studentId, classId, listId
  // Order by submittedAt desc, limit to maxResults
  // Returns array of attempt documents
}
```

**New reconciliation logic in `progressService.js`:**

```javascript
function calculateCSDAndTWIFromAttempts(attempts) {
  // Find highest studyDay among attempts
  const highestStudyDay = Math.max(...attempts.map(a => a.studyDay || 0));

  // Day 1: CSD = 1 if new test passed, else 0
  // Day 2+: CSD = studyDay if review test exists, else studyDay - 1

  // TWI = newWordEndIndex + 1 from new test where studyDay === CSD
  // (endIndex is 0-based, TWI is count)

  return { csd, twi };
}
```

**Modified `getOrCreateClassProgress()`:**

```javascript
export async function getOrCreateClassProgress(userId, classId, listId) {
  // Get or create progress document (existing logic)

  // NEW: Always verify against attempts
  const attempts = await getRecentAttemptsForClassList(userId, classId, listId, 8);
  const { csd, twi } = calculateCSDAndTWIFromAttempts(attempts);

  // If mismatch, reconcile and log
  if (csd !== storedCSD || twi !== storedTWI) {
    logSystemEvent('csd_twi_reconciled', { stored, calculated, attemptCount });
    await updateDoc(progressRef, { currentStudyDay: csd, totalWordsIntroduced: twi });
  }

  // Return both progress and attempts (attempts reused by Solution #2)
  return { progress, attempts };
}
```

#### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Query limit | 8 attempts | Covers 4 days of new+review pairs |
| TWI calculation | `newWordEndIndex + 1` | endIndex is 0-based, TWI is count |
| Reconciliation timing | On every progress load | Self-healing without manual intervention |
| Return format | `{ progress, attempts }` | Allows Solution #2 to reuse attempts |

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/db.js` | Added `getRecentAttemptsForClassList()` |
| `src/services/progressService.js` | Added `calculateCSDAndTWIFromAttempts()`, modified `getOrCreateClassProgress()` |
| `src/services/studyService.js` | Updated caller to destructure `{ progress, attempts }` |
| `src/pages/MCQTest.jsx` | Updated caller to destructure `{ progress }` |
| `src/pages/TypedTest.jsx` | Updated caller to destructure `{ progress }` |

---

### Solution #2: Init-Based Phase Detection

#### Problem
If a student completes the new word test on Day 2+ but crashes/closes browser before review:
- CSD hasn't incremented yet (review test completes the day)
- On return, `initializeDailySession()` treats it as a fresh start
- Student sees new word study phase again instead of resuming at review

#### Implementation

**New phase detection in `studyService.js`:**

```javascript
function determineStartingPhase(attempts, dayNumber) {
  const dayAttempts = attempts.filter(a => a.studyDay === dayNumber);
  const newTest = dayAttempts.find(a => a.sessionType === 'new');
  const reviewTest = dayAttempts.find(a => a.sessionType === 'review');

  // Day 2+: mid-session (new passed, no review) -> resume at review
  if (dayNumber > 1 && newTest?.passed && !reviewTest) {
    return { phase: SESSION_PHASE.REVIEW_STUDY, newWordScore: newTest.score };
  }

  // Day 1 with passed new test -> complete (impossible after reconciliation, log it)
  if (dayNumber === 1 && newTest?.passed) {
    logSystemEvent('impossible_phase_detected', { dayNumber, reason: 'day1_with_passed_new_test' });
    return { phase: SESSION_PHASE.COMPLETE, newWordScore: newTest.score };
  }

  // Day 2+ with both tests -> complete
  if (dayNumber > 1 && newTest?.passed && reviewTest) {
    return { phase: SESSION_PHASE.COMPLETE, newWordScore: newTest.score, reviewScore: reviewTest.score };
  }

  // Normal: fresh start
  return { phase: SESSION_PHASE.NEW_WORDS_STUDY };
}
```

**Updated `initializeDailySession()` return:**

```javascript
return {
  // ... existing fields ...

  // Phase detection for session recovery
  startPhase: phaseInfo.phase,
  recoveredNewWordScore: phaseInfo.newWordScore,
  recoveredReviewScore: phaseInfo.reviewScore
};
```

**Updated `DailySessionFlow.jsx` init effect:**

```javascript
// Handle session recovery based on startPhase from attempt history
if (config.startPhase === SESSION_PHASE.COMPLETE) {
  // Session already complete - show completion screen
  setNewWordTestResults({ score: config.recoveredNewWordScore });
  setReviewTestResults({ score: config.recoveredReviewScore });
  setPhase(PHASES.COMPLETE);
  return;
}

if (config.startPhase === SESSION_PHASE.REVIEW_STUDY) {
  // Mid-session recovery: new word test passed, need to do review
  const segmentWords = await getSegmentWords(user.uid, listId, config.segment.startIndex, config.segment.endIndex);
  setReviewQueue(segmentWords);
  setReviewQueueCurrent(segmentWords);
  setNewWordTestResults({ score: config.recoveredNewWordScore });
  setPhase(PHASES.REVIEW_STUDY);
  return;
}

// Normal flow continues...
```

#### Phase Detection Logic

| Day | New Test | Review Test | Result |
|-----|----------|-------------|--------|
| 1 | None | N/A | `NEW_WORDS_STUDY` (fresh start) |
| 1 | Passed | N/A | `COMPLETE` (impossible, log it) |
| 2+ | None | None | `NEW_WORDS_STUDY` (fresh start) |
| 2+ | Passed | None | `REVIEW_STUDY` (mid-session resume) |
| 2+ | Passed | Exists | `COMPLETE` (already done) |

#### Files Modified

| File | Changes |
|------|---------|
| `src/services/studyService.js` | Added `determineStartingPhase()`, updated `initializeDailySession()` return |
| `src/pages/DailySessionFlow.jsx` | Added startPhase handling in init effect |

---

### Solution #4: System Logging

System logging was implemented as part of Solutions #1-3:

| Event Type | Location | Trigger |
|------------|----------|---------|
| `attempt_retry_succeeded` | `withRetry()` | First attempt failed, retry succeeded |
| `attempt_write_failed` | `withRetry()` | All retries exhausted |
| `csd_twi_reconciled` | `getOrCreateClassProgress()` | CSD/TWI mismatch detected and fixed |
| `impossible_phase_detected` | `determineStartingPhase()` | Day 1 with passed new test found |

All events written to `system_logs` collection with timestamp and severity.

---

### Testing Checklist

**Solution #3:**
- [ ] Submit test normally - should succeed without retry
- [ ] Simulate network failure (offline mode) - should retry and show error UI
- [ ] Check answers preserved after failure - retry should work
- [ ] Try to navigate away with error - should show warning

**Solution #1:**
- [ ] Check console for reconciliation logs
- [ ] Manually corrupt CSD in Firestore - should auto-fix on next load
- [ ] Verify TWI matches after reconciliation

**Solution #2:**
- [ ] Complete new word test on Day 2+, close browser mid-session
- [ ] Reopen - should resume at REVIEW_STUDY phase
- [ ] Complete Day 1 - refresh should show COMPLETE

**Solution #4:**
- [ ] Check `system_logs` collection in Firebase Console
- [ ] Verify logs only appear for anomalies, not normal operations

---

## Bug Fixes: Session Fragility Code Review

**Date:** 2026-01-09

### Bug #4: CSD/TWI Regression on Empty Query Results

**Problem:** If `getRecentAttemptsForClassList()` fails or returns an empty array, `calculateCSDAndTWIFromAttempts()` returns `{csd: 0, twi: 0}`. The reconciliation logic would then overwrite valid stored values with zeros.

**Fix:** Added Math.max safeguard in `progressService.js`:

```javascript
// Use Math.max to prevent regression if query fails or returns incomplete data
const safeCSD = Math.max(storedCSD, csd);
const safeTWI = Math.max(storedTWI, twi);
```

This ensures CSD/TWI can only ever increase through reconciliation, never decrease. If the query fails, stored values are preserved.

**File:** `src/services/progressService.js` (lines 117-119)

---

### Bug #6: Undefined `combinedWords` in Test Recovery

**Problem:** The test crash recovery code in `DailySessionFlow.jsx` referenced `combinedWords` variable which was never defined in that scope. This would silently evaluate to `undefined`, then `combinedWords || []` would return an empty array - effectively breaking word recovery.

**Fix:** Changed to use `testRecovery.localState?.wordPool` which contains the word pool saved to localStorage when the test started:

```javascript
// Before (broken):
newWords: combinedWords || [],
wordPool: testRecovery.phaseType === 'new' ? (combinedWords || []) : null,

// After (fixed):
const recoveredWordPool = testRecovery.localState?.wordPool || []
newWords: recoveredWordPool,
wordPool: testRecovery.phaseType === 'new' ? recoveredWordPool : null,
```

**File:** `src/pages/DailySessionFlow.jsx` (lines 696, 713)

---

### Bug #7: `cardsReviewed` Not Reset on REVIEW_STUDY Recovery

**Problem:** When recovering to REVIEW_STUDY phase, the `cardsReviewed` state was not reset. If the student had reviewed cards in a previous session, the count would persist and show incorrect progress.

**Fix:** Added `setCardsReviewed(0)` to the REVIEW_STUDY recovery block:

```javascript
setReviewQueue(segmentWords)
setReviewQueueCurrent(segmentWords)
setReviewDismissed(new Set())
setCurrentIndex(0)
setIsFlipped(false)
setCardsReviewed(0)  // NEW: Reset card count for fresh recovery
```

**File:** `src/pages/DailySessionFlow.jsx` (line 633)

---

### Bug #8: No Error Handling for `getSegmentWords` in REVIEW_STUDY Recovery

**Problem:** If `getSegmentWords()` throws an error during REVIEW_STUDY recovery, the error would bubble up unhandled, potentially leaving the user stuck on a loading screen.

**Fix:** Wrapped the `getSegmentWords()` call in try-catch with user-friendly error display:

```javascript
if (config.startPhase === SESSION_PHASE.REVIEW_STUDY) {
  try {
    const segmentWords = await getSegmentWords(/* ... */);
    // ... recovery logic ...
  } catch (err) {
    console.error('Failed to load segment words for REVIEW_STUDY recovery:', err)
    setError('Failed to load review words. Please refresh and try again.')
    return
  }
}
```

**File:** `src/pages/DailySessionFlow.jsx` (lines 620-645)
| 2026-03-06 | `scripts/export-typed-test-answers.js` | Created script to export all typed test attempts with full answers array (including AI reasoning, challenge data) for accuracy analysis |
| 2026-03-06 | `scripts/build-ai-benchmark.js` | Created script to build AI grading benchmark dataset - enriches exported attempts with Korean definitions from Firestore, outputs in Cloud Function input format with current AI grades as baseline |
| 2026-03-07 | `functions/index.js` | Switched AI grader from GPT-4o-mini to Claude Haiku (3.55% → 0.96% error rate); added `?` to blank filter; added 3 prompt rules (#9 Korean def matching, #10 part-of-speech tolerance, #11 partial answers) |
| 2026-03-07 | `functions/package.json` | Replaced `openai` dependency with `@anthropic-ai/sdk` |
| 2026-03-07 | `functions/index.js` | Refactored grading prompt: replaced 11-rule prompt with 3 failure conditions + 8 few-shot examples from audit data; added `isSelfReferencing()` pre-filter; switched to JSON input format with explicit count instruction; moved grading philosophy to system message |
| 2026-03-09 | `package.json` | Added `@playwright/test` dev dependency and `test:e2e` / `test:e2e:ui` scripts |
| 2026-03-09 | `playwright.config.js` | Created Playwright config with Chromium, Vite dev server integration, HTML reporter |
| 2026-03-09 | `e2e/app.spec.js` | Created sample e2e test that verifies app loads |
| 2026-03-09 | `.gitignore` | Added Playwright artifact directories |
| 2026-05-30 | `audit_findings_persistence.md` | Created merged persistence/stability audit (Claude + Codex) with verification table and recommended fix order |
| 2026-05-30 | `firestore.rules` | C1: scoped `{path=**}/class_progress/{docId}` collection-group rule to `allow read: if isAuthenticated() && isTeacher()` (was `allow read, write` for any auth user, allowing arbitrary cross-student progress corruption) |
| 2026-05-30 | `firestore.rules` | C3: scoped student-side `attempts` update to `affectedKeys().hasOnly(['answers'])` so students can only mutate the answers array (for submitChallenge), no longer can rewrite score/passed/credibility; teacher-side update now also requires `isTeacher()` |
| 2026-05-30 | `firestore.rules` | C2: documented TODO on `/users/{userId}/{subcollection}/{docId}` write rule — teacher-any-student writes left in place to preserve reviewChallenge functionality; flagged for follow-up to move that write to a Cloud Function with Admin SDK and tighten the rule to `isOwner(userId)` |
| 2026-05-30 | `src/utils/testRecovery.js` | Added `getOrCreateAttemptNonce(testId)` and extended `clearTestState` to also remove the nonce key. Provides a stable per-session nonce for idempotent attempt-doc IDs so withRetry replays cannot create duplicate `attempts` documents |
| 2026-05-30 | `src/services/db.js` | `submitTestAttempt` + `submitTypedTestAttempt`: added optional `attemptDocId` parameter; switched from `addDoc` to `setDoc(doc(attemptsCol, attemptDocId))` when supplied so withRetry replays are idempotent overwrites of identical data (fix #5) |
| 2026-05-30 | `src/pages/MCQTest.jsx` | Fixed #1 + #3 + #4 + #5: reordered handleSubmit so the attempt doc is written FIRST and processTestResults (study_state mutations) runs only AFTER submit succeeds; clearTestState moved to after both writes; added resultsProcessedRef so Try-Again does not re-increment timesTestedTotal within the same mount; pass deterministic attemptDocId built from `${user.uid}_${testId}_${attemptNonce}` |
| 2026-05-30 | `src/pages/TypedTest.jsx` | Fixed #2 + #3 + #4 + #5: same reorder as MCQTest. clearTestState now runs only after AI grading + attempt write + processTestResults all succeed (was wiping local recovery before the 90s-per-attempt OpenAI call, losing 15-20 min of typing on any mid-flow failure) |
| 2026-05-30 | `change_action_log.md` | (this file) Logged the persistence audit and the rules + service + test-page fixes. #17 Dashboard hook-order DEFERRED to a dedicated follow-up PR: clean fix requires extracting StudentDashboardBody into a child component (~600 lines + 7 hooks + 5 helpers); mixing it into a persistence-focused PR creates regression risk on the very dashboard we're stabilizing |
| Date | File | Change |
| --- | --- | --- |
| 2026-05-31 | src/services/studyService.js | Fix B27-F01 BLOCKER: buildReviewQueue now excludes MASTERED (retired) words before selectReviewQueue, so words within their 21-day rest window no longer reappear in review tests and get re-tested/downgraded. |
| 2026-06-09 | src/pages/DailySessionFlow.jsx + src/services/studyService.js | Fix Day-2+ new-word test bypass: a student who FAILED the Day-2+ new-word test could be carried into the review phase and complete/advance the day without passing the gate (Day 1 correctly holds on failure; Day 2+ did not). (1) Resume guard in DailySessionFlow: only resume into review-study/review-test if `existingState.newWordsTestScore >= retakeThreshold`. (2) Backstop in completeSessionFromTest: for Day 2+, if `newWordScore < threshold`, block completion (skip recordSessionCompletion / CSD advance) and return `requiresNewWordRetake`. Root cause: handleReturnFromTest/resume moved Day-2+ to review unconditionally, and completion was gated only on the review test (which always passes). NEEDS staging/emulator test before deploy. Scan found 9 already-advanced (8×25WT, 1×26SM Ryan Han) + 2 mid-bug. |
| 2026-06-02 | src/services/studyService.js | Fix newWordsTestScore unit bug on Day-2 session resume. `determineStartingPhase` re-seeded recovered new-word/review scores straight from the attempt doc (stored as percent 0-100), but session_state.newWordsTestScore + all consumers (teacher roster "Current Session" cell, student resume banner) expect a fraction (0-1) and render ×100, so resumed students showed e.g. "9700%". Added `toFraction(s) = s>1 ? s/100 : s` (matches existing convention at line ~1139) and wrapped the three score-returning branches. Display-only: pass/fail gate and gradebook (read attempts directly) unaffected; bad values self-heal on day completion, no backfill needed. |
| 2026-06-10 | src/services/studyService.js | Patch v2 Change A: `determineStartingPhase` now picks the BEST new-word attempt for the day (prefer passed=true, then highest score) instead of `.find()` returning the first match. Fixes Day-2+ fail→retake→PASS students being bounced back to the new-word test on re-entry because the earlier FAILED attempt was inspected (e.g. 유지웅 87→100, JW Han 93 — 26SM Inter B2). |
| 2026-06-10 | src/services/studyService.js | Patch v2 Change C (urgent companion to the deployed Day-2+ completion gate): `completeSessionFromTest` now reads the attempt's authoritative `passed` flag (computed server-side against the class's real passThreshold, covers teacher manual overrides) and the gate only blocks when `newWordAttemptPassed !== true AND score < threshold`. Fixes 92–94% passers in 92%-threshold classes being silently blocked from completing the day (gate compared against wrong 0.95 default). |
| 2026-06-10 | src/services/studyService.js + src/pages/DailySessionFlow.jsx | Patch v2 Change D: fixed the retake-threshold fallback chain in 4 sites — `assignment.newWordRetakeThreshold` is never stored, so all settings builders fell back to the 0.95 default; now derive from the class's real `passThreshold` (percent / 100) before falling back. Fixes resume guard, `session_state.newWordsTestPassed` writes, and the completion-gate fallback. |
| 2026-06-10 | src/pages/DailySessionFlow.jsx | Patch v2 Change B (defense-in-depth): the `existingState` resume block now also honors attempt-derived state (`config.startPhase === REVIEW_STUDY`), so a stale session pointer (`phase: new-words-study`) can never bounce a confirmed passer back to the new-word test. |
| 2026-06-10 | src/pages/DailySessionFlow.jsx | Patch v2.1 Change E-1/E-2: both resume paths into review now detect an EMPTY review segment (all words MASTERED & resting after excludeRetiredMastered) and show the designed "all mastered" success modal → completeSession(), instead of pushing the student into a 0-word review test ("No Test Content" dead end). Live impact 2026-06-10: 4 top scorers blocked daily (정아영/Paige Lim/Ryan Kim day 6, 손지우 day 7). |
| 2026-06-10 | src/pages/DailySessionFlow.jsx | Patch v2.1 Change E-4/E-4b: `handleNoReviewModalClose` now writes an idempotent marker review attempt (deterministic doc id `..._day{N}_review_automarker`, score 100/passed/autoCompleted, explanatory note) so CSD reconciliation (`getOrCreateClassProgress`, which requires a day-N review attempt) does not REVERT the auto-completed day on next entry. Added `setDoc, Timestamp` to the firestore import (without them the ReferenceError would be swallowed by the try/catch). |
| 2026-06-10 | src/pages/MCQTest.jsx + src/pages/TypedTest.jsx | Patch v2.1 Change E-3: fixed misleading "No Test Content" copy — was "Your teacher hasn't assigned enough words yet." (false teacher-misconfiguration implication); now explains no words are available and points the student back to the dashboard. |
| 2026-06-15 | src/pages/DailySessionFlow.jsx | HOTFIX (Change E loading modal): render the No-Review "all mastered!" ConfirmModal inside the `phase === PHASES.LOADING` early-return. The empty-review auto-complete (Change E-1/E-2) fires during init while phase is still LOADING, but the loading early-return rendered before the modal JSX at the bottom of the component, so pool-collapse students resuming mid-day were stuck on an infinite "Preparing your session..." spinner. On OK, handleNoReviewModalClose runs completeSession + E-4 marker write and advances to the completion screen. |
| 2026-06-21 | src/services/db.js | CSD observability (v5, log-and-monitor): `getMostRecentPassedNewTest` now returns a DISCRIMINATED result `{status:'found',attempt}` / `{status:'none'}` / `{status:'query-error',error}` instead of `attempt\|null`, so callers can tell "no passed test exists" apart from a transient/index query failure. Error stringified (message/code/stack) for Firestore-safe logging. Single caller (progressService) updated. No reconciliation behavior change. |
| 2026-06-21 | src/types/studyTypes.js | CSD observability (v5): added `implausibleStudyDayThreshold(...)` — conservative looser-of-(calendar,TWI)+slack(7) ceiling, returns null when not computable. LOGGING ONLY (decides whether to emit `csd_implausible`); not a clamp. |
| 2026-06-21 | src/services/progressService.js | CSD observability (v5): `getOrCreateClassProgress` classifies the anchor (found/none/invalid-anchor/query-error) and emits logs WITHOUT auto-correcting CSD/TWI (reconciliation byte-for-byte unchanged): `csd_anchor_query_error` (transient — never treated as no-progress), `csd_anchor_invalid` (legacy malformed anchor — student has progressed), `csd_implausible` only for a clean `none` with stored CSD above a settings-gated threshold (legit no-anchor CSD≈0). Settings fetched only in the suspicious path; unavailable → skip. Plan: CSD_RECONCILIATION_CLAMP_PLAN.md. |
| 2026-06-21 | src/services/db.js | Dashboard audit Fix A: `fetchUserAttempts` no longer overwrites an attempt's authoritative `classId`/`listId` with parsed/guessed values. New-format `testId` regex now captures classId; classId precedence = doc.classId (guarding the backfill `'no_class'` sentinel) → testId-parsed → list→class lookup; listId precedence = doc.listId → testId-parsed (Codex follow-up: a missing/malformed testId must not null a stored listId). Fixes wrong per-class attribution for students dual-enrolled in two classes sharing a list. Read-only; single caller (Dashboard). Plan: DASHBOARD_AUDIT_FIX_PLAN.md. |
| 2026-06-21 | src/pages/Dashboard.jsx | Dashboard audit Fixes B/C/D/E. B: `getPrimaryFocus` now resolves saved focus by primaryFocusClassId+ListId (3-tier guarded chain: exact class+list → legacy list-only → auto-select); dropdown highlight compares classId+id. C: deleted dead `dailyStatus`/`testCompletedToday`/`sessionCompletedToday` (+ dead helpers `hasSessionToday`/`hasTestToday`/`getStartOfToday`); preserved the live list-scoped `listAttempts`/`phase` block. D: replaced redesign-introduced + in-zone raw colors (hero, list selector, student error banner) with design tokens (`bg-btn-success` check, `bg-muted`/`bg-brand-primary-10`, `border-border-error`/`text-text-error`, `text-white/70-80`); pre-existing raw colors elsewhere in file deferred to a follow-up. E: null-date list fallback now selects the FIRST list, not last. Plan: DASHBOARD_AUDIT_FIX_PLAN.md. |
| 2026-06-22 | Firebase (attempts, session_states) | **강민서 (MINSEO KANG)**: Created manual Day 6 new typed attempt (score 93%, 28/30, passed=true) because AI grading API failed at runtime. Updated session_states to phase=review-study, newWordsTestPassed=true. Student can now proceed with Day 6 review. |
| 2026-06-22 | Firebase (session_states) | **손지우**: Fixed corrupt session state. Was CSD=16, phase=review-study, newWordsTestPassed=false (impossible state). Changed phase to new-words-study so she can take the Day 16 new words test. |
| 2026-06-22 | Firebase (attempts, session_states) | **서준혁 (ADV A1)**: Created manual Day 1 new typed attempt (score 97%, 29/30, passed=true) after connection error. Wrong word: postmodern. Student can proceed with Day 1 review. |
| 2026-06-23 | src/pages/DailySessionFlow.jsx | **Fix 1 (typed-grading malform root cause)**: the test-phase crash-recovery marker written in `navigateToTest` (~L1168 via `saveLocalSessionState`) was thinning the word pool to `{id, word}`, dropping `definition`/`definitions`. On crash/reload mid-test, recovery rebuilt the test from that thin pool (PATH B) → grade payload had `correctDefinition=undefined` for EVERY word → `gradeTypedTest` rejected the whole batch as malformed (`invalid-argument`, "Grading Failed" loop). This is the ONLY recovery marker that fires for the test phase (the two autosave effects at L362/L401 — already patched to keep definitions — never run on the separate test route). Now persists `definition`/`definitions`/`partOfSpeech`, mirroring those siblings. Hit 14 real 26SM students on 2026-06-22 (230 rejections, all-or-nothing). Not committed/deployed. Plan: PLAN_typed_grading_malform_fix_v1.md (v2). 3-agent audited. |
| 2026-06-23 | functions/index.js | **Fix 2/2b/3 (server, typed-grading hardening — PLAN v5)**. (2) `gradeTypedTest`: server-authoritative answer key — new `resolveAnswerDefinitions(listId, answers)` backfills canonical `correctDefinition`/`koreanDefinition` from `lists/{listId}/words/{wordId}` (one `getAll`), gated by `callerMayResolveList(uid, classId, listId)` (enrollment + list-assignment; skip-resolution-not-block on denial → anti-oracle). `gradeAnswers` is now the single canonical array for ALL downstream use (finishGrading rows, malformed check, blank/self-ref filters, final ordering, post-grade validation). (3) Softened all-or-nothing: unresolved rows auto-marked incorrect (`malformedResults`) and the rest graded; throw only if EVERY row is unprocessable. (2b) `submitVocabAttempt`: `assertCanWriteAttempt` (factored from `writeAttemptTxn`) runs BEFORE `sanitizeStoredRows` (Admin-SDK reads stay post-authorization); `sanitizeStoredRows(listId, rows)` backfills `correctAnswer` for clients on an OLD thin recovery marker + coalesces all stored fields to non-undefined (covers typed + mcq). `buildTypedAttemptAnswers` also coalesced. node --check OK. Not committed/deployed. |
| 2026-06-23 | src/pages/TypedTest.jsx | **Fix 4/5/6 (client — PLAN v5)**. (4) grade call now sends `listId` + `classId` (server resolution + authz). (5) write-failure UX: extracted `doWriteAndFinalize` closure + `finalizeResultsView` helper from `handleSubmit`; on durable-write failure the closure is stashed in `pendingSaveRef` and a NEW standalone modal (`{submitError && !isSubmitting}`, replacing the dead nested one) offers **"Retry Save"** → re-runs the write ONLY via the stashed closure (never re-grades/re-bills AI). (6) `attempt_write_failed_client` logged in the write catch (closes the observability gap; distinct event name avoids double-count w/ withRetry). esbuild parse OK. Not committed/deployed. |
| 2026-06-23 | src/pages/MCQTest.jsx | **Fix 6 (client — PLAN v5)**: log `attempt_write_failed_client` in the server-write catch (same observability gap as typed). esbuild parse OK. Not committed/deployed. |
| 2026-06-23 | functions/index.js | **Codex r4 hardening (HIGH)**: `assertCanWriteAttempt` now actually enforces list-assignment — was `(assignments||{})[listId] || {}` (missing assignment fell through to default passThreshold, letting an enrolled student write/sanitize-read for an arbitrary listId under a real class). Now throws `failed-precondition` unless `assignments[listId]` OR legacy `assignedLists.includes(listId)`. Same assigned-list check added to `callerMayResolveList` (grade path). Verified the live 26SM class has both shapes populated → no live-write regression. node --check OK. |
| 2026-06-23 | functions/index.js | **Orphan-safe revision of r4 hardening (pre-deploy scan finding)**: a read-only scan of 4348 recent attempts found 11 (2 students, class teKHajON / list 7Is5UdS4P4) writing to a list NOT assigned to their class — the known list-unassign-orphan pattern. The hard `failed-precondition` reject would have newly blocked them. Changed `assertCanWriteAttempt` to NOT reject unassigned lists (enrollment still gates who can write); instead it returns an `assigned` flag and `submitVocabAttempt` gates ONLY the sanitize backfill reads on it (`sanitizeStoredRows(assigned ? listId : null, …)`). Closes Codex's read/cost-abuse path without breaking orphans; mirrors the grade path's skip-don't-block. Logic preflight 13/13 vs real data (incl. non-enrolled still rejected). node --check OK. |
| 2026-06-23 | functions/index.js | **Three-state list authz (Codex r5 — final posture)**. `assertCanWriteAttempt` now: assigned (assignments/assignedLists) → allow + backfill; orphan-eligible (NOT assigned but prior class_progress OR prior attempt for this uid/classId/listId) → allow + backfill (logs `unassigned_attempt_allowed` w/ orphanReason); neither → reject `failed-precondition` BEFORE any sanitize reads. Closes the "write/force-reads for an arbitrary unassigned list" path while preserving legitimately-orphaned students (verified: real orphan W3MUFXDb allowed via prior_attempt; arbitrary-unassigned rejected; non-enrolled rejected). `submitVocabAttempt` reverts to always backfilling `context.listId` (assert now guards entitlement). Added `passThresholdFallback` log when an unassigned/orphan write defaults to 95 (no server-side source for original threshold). Grade-path `callerMayResolveList` left assigned-only (skip-don't-block; orphan thin-marker grading is a rare pre-existing edge). DEFERRED (R7): client-supplied `isCorrect` still trusted on the write — broader forgeable-attempts concern, tracked separately. Logic preflight 14/14 vs real data. node --check OK. |
| 2026-06-23 | functions/index.js | **Codex r5 nits**: (1) updated stale `assertCanWriteAttempt` docblock to describe the three-state (assigned-or-orphan) check + new return shape. (2) `writeAttemptTxn(uid, ctx, attemptAnswers, auth?)` now accepts the pre-computed auth result; `submitVocabAttempt` passes it through to avoid a duplicate class-doc/orphan read per write. `gradeTypedTest.finishGrading` still calls without auth → self-authorizes (fallback). node --check OK; preflight 14/14. |
| 2026-06-23 | functions/index.js | **Codex r6 (HIGH): orphan gate used client-forgeable evidence**. The three-state gate queried `users/{uid}/class_progress` / `attempts` as orphan proof, but firestore.rules let a student write those docs → an enrolled student could mint their own "orphan" evidence for an arbitrary unassigned list. Replaced the live query with a static, server-trusted `KNOWN_ORPHAN_WRITES` allowlist (uid|classId|listId). Built from a FULL-collection census of all 7667 attempts → exactly 2 tuples (W3MUFXDb + fc8sBxnz, both teKHajON/7Is5UdS4P4, last active 2026-06-18) are the complete orphan set, so no real orphan is rejected. Now: assigned → allow+backfill; allowlisted orphan → allow+backfill (logs known_orphan_allowlist); everything else (incl. forged evidence) → reject failed-precondition before any reads. Preflight 15/15 incl. forgery-guard (non-allowlisted student on the orphan list rejected). node --check OK. Long-term: server-owned assignment-history model. |
| 2026-06-27 | dsg-edits/RUNBOOK_question_editing.md | **Documented answer-key edits (§4b).** Folded the answer-change procedure (previously only in `edit-t07.mjs`/`edit-t08.mjs`) into the runbook: per-choice checkbox + score dual-write, score `59` correct / `0` wrong (hardcoded, stays `59`), Vue native-setter + input/change dispatch, 4×4 exactly-count safety bail, and reload-verify of BOTH checkbox states (`keyCbOk`) and scores (`keyScOk`). Cross-linked §7.5 and added the two edit-tNN scripts to the §8 reference list. Doc-only. |
| 2026-06-27 | functions/index.js | **Lockdown W1 (PLAN_attempt_write_lockdown.md): server-side `submitChallenge` callable.** New `onCall` that moves challenge submission server-side so the function becomes the ONLY writer of `attempts.answers` (closes NEED_TO_FIX #1c: student could forge `answers[].isCorrect` via direct write → `reviewChallenge` launders it to a pass). One Admin-SDK `runTransaction` over `users/{uid}.challenges.history` (append) + `attempts/{id}.answers[i]` (set `challengeStatus`/`challengeNote` ONLY — never `isCorrect`); uid = `request.auth.uid` (server-trusted). All gates INSIDE the txn: ownership (`studentId===uid`), already-pending idempotency no-op, server-side token re-check via new `availableChallengeTokens()` helper (byte-parity port of client `getAvailableChallengeTokens`, db.js:177 — active rejections, `.toMillis()` safe-nav, max 5). Same history-entry shape as the old client write (`attemptId,wordId,challengedAt,replenishAt,status`). node --check OK. Not committed/deployed. Deploy choreography: fn first → flip `SERVER_CHALLENGE_WRITE` ON + rebuild → validate → W3 rules. |
| 2026-06-27 | src/config/featureFlags.js | **Lockdown W1: add `SERVER_CHALLENGE_WRITE` flag (default OFF).** Gates the client `submitChallenge` between the new server callable (ON) and the legacy client write (OFF, fallback until validated). Mirrors the `SERVER_ATTEMPT_WRITE` rollout pattern. esbuild unavailable in container (win32 binary); ESM `node --check` OK. Not committed/deployed. |
| 2026-06-27 | src/services/db.js | **Lockdown W1: `submitChallenge` → flag-gated wrapper.** When `SERVER_CHALLENGE_WRITE` is ON, calls the `submitChallenge` Cloud Function (`httpsCallable(getFunctions(),'submitChallenge')({attemptId,wordId,note})`, returns `.data`); when OFF, runs the unchanged legacy client body (two `updateDoc`s) as fallback. Signature `(userId, attemptId, wordId, note)` unchanged → call sites (`TestResults.jsx:61`, `Gradebook.jsx:446`) untouched; the callable uses `request.auth.uid`, not the passed `userId`. Added imports: `getFunctions, httpsCallable` (firebase/functions), `SERVER_CHALLENGE_WRITE` (config/featureFlags). ESM `node --check` OK. Not committed/deployed. |
| 2026-06-27 | dsg-edits/recon-t09t10.mjs, diff-t09-sample.mjs, full-diff.mjs (new, read-only) | **T09/T10 replacement prep — recon only, NO live writes.** Refreshed expired auth.json (login_save). Reconciled 26smt09/t10 QID map (162 tags, all single-copy 1182xx–1184xx, no dual-copy) against the two content sheets (45 rows/test, M01:13/M2L:16/M2U:16; every row maps to a QID). Found: (1) live questions already largely contain the sheet content/key/difficulty; (2) live editor has NO "Graphs and Tables" passage-type radio (only Lit/Hum/Sci/Empty) — per user, leave those 5 untouched, no Empty-enabler; (3) **7 contaminated passages in the "final" sheets** — 4× `nf-voc` leading line, 2× trailing `source:` URL (T09 M2U Q5, T10 M2U Q1), 1× full generator debug block lines 0–25 (T09 M2L Q12). Built cleanPassage() + ran full read-only sheet-vs-live diff to size genuine deltas before any write. |
| 2026-06-27 | functions/index.js | **G2 (PLAN_server_authoritative_grading.md): typed correctness authority via gradeToken + `correctnessSource`.** Added `crypto` + `GRADE_TOKEN_SECRET` (`defineSecret`) + `canonicalGradeArtifact`/`signGradeArtifact`/`verifyGradeToken` (HMAC-SHA256, constant-time, signs ONLY the grade-bearing subset `{wordId,studentResponse,isCorrect,aiReasoning}` + binding context `{uid,attemptDocId,classId,listId,testId,testType,totalQuestions,createdAt}`, rows sorted by wordId so order-independent). `gradeTypedTest`: `secrets += gradeTokenSecret`; accepts `gradeContext`; `finishGrading` mints+returns `gradeToken`/`gradeTokenCreatedAt` (both grade-only and write paths) and stamps `correctnessSource:'server-ai'` on its own write. `writeAttemptTxn(…, opts)`: stamps top-level `correctnessSource` (server-set; null for MCQ/legacy — no `server-mcq` until Phase E). `submitVocabAttempt`: `secrets += gradeTokenSecret`; for `testType:'typed'` verifies the token → on valid sets `correctnessSource:'server-ai'` + `sanitizeStoredRows(...,{overwrite:true})` (authoritative reconstruct of word/correctAnswer, ignore client values); enforcement staged behind `GRADE_TOKEN_ENFORCED=false` (when off: behaves exactly as today, no rejection/marker). `sanitizeStoredRows` gained an `{overwrite}` mode. node --check OK. Not committed/deployed; ENFORCEMENT OFF pending Codex pass + validation. |
| 2026-06-27 | src/pages/TypedTest.jsx | **G2 client thread.** `gradeWithRetry(answersToGrade, gradeContext)` passes `gradeContext` to `gradeTypedTest` (binds the token to the deterministic `attemptDocId`, `totalQuestions=words.length`); the `submitVocabAttempt` call now forwards `gradeToken`/`gradeTokenCreatedAt` from the grade response. No behaviour change while `GRADE_TOKEN_ENFORCED` is off (token ignored server-side). JSX — no container parser; owner build validates. Not committed/deployed. |
| 2026-06-27 | functions/index.js | **Lockdown W2: `markReviewComplete` callable.** Server-side write of the empty-review automarker (was the client `setDoc` at DailySessionFlow.jsx:962) so Day-2+ completion survives W3 `create:false`. Auth + `assertCanWriteAttempt` entitlement; deterministic id `${uid}_${classId}_${listId}_day${N}_review_automarker` → idempotent (existing+owned → no-op); same fields as the old marker + `writtenBy:'cloud-function'`; guards `dayNumber>1`. node --check OK. Not committed/deployed. |
| 2026-06-27 | src/config/featureFlags.js | **Lockdown W2: add `SERVER_REVIEW_MARKER` flag (default OFF).** Gates the empty-review marker between the new `markReviewComplete` callable (ON) and the legacy client `setDoc` (OFF). ESM node --check OK. Not committed/deployed. |
| 2026-06-27 | src/pages/DailySessionFlow.jsx | **Lockdown W2: automarker cutover.** `handleNoReviewModalClose` now flag-gates the empty-review marker write: `SERVER_REVIEW_MARKER` ON → `httpsCallable('markReviewComplete')({classId,listId,dayNumber})`; OFF → unchanged legacy client `setDoc` fallback. Added imports (`getFunctions,httpsCallable`, `SERVER_REVIEW_MARKER`). JSX — owner build validates. Not committed/deployed. |
| 2026-06-27 | firestore.rules | **[⚠️ SUPERSEDED same day — this edit was REVERTED; see the "W3 deploy-safety revert" row below. The live `firestore.rules` does NOT contain the lockdown — it was restored to pre-lockdown state and W3 moved to `docs/plans/W3_attempts_lockdown.rules.md`.]** ~~Lockdown W3: attempts write lockdown — `create: if false`; removed student `answers`-update branch; teacher update + student delete unchanged.~~ Not committed/deployed. |
| 2026-06-27 | functions/index.js | **G2/W2 Codex round-2 hardening (5 fixes, pre-deploy).** (1) CRITICAL — gradeToken could certify a client-supplied answer key: `resolveAnswerDefinitions` now returns `{answers, allResolved}`; gradeTypedTest computes `serverGraded = mayResolve && allResolved` and **mints the token / allows server-ai ONLY when serverGraded** (unauthorized-list or any-unresolved-row grading → no token, not certifiable). (2) CRITICAL — `markReviewComplete` always failed authz: it called `assertCanWriteAttempt(uid,{classId,listId})` but that requires a full ctx (studentId/attemptDocId/testType/sessionType) → now passes the marker's full ctx (markerId computed first). (3) HIGH — typed overwrite reconstruction fell back to client `word`/`correctAnswer` for missing word docs (`listVal ?? clientVal`): overwrite mode now **rejects** (`failed-precondition`) if any wordId is unresolved; never uses client display values. (4) MEDIUM — `correctnessSource:'server-ai'` was stamped whenever the token verified, even with enforcement off: now gated on `GRADE_TOKEN_ENFORCED` in BOTH the gradeTypedTest direct-write and submitVocabAttempt (no trusted markers before the W3 lockdown is live). (5) MEDIUM — signed `createdAt` wasn't age-checked: submitVocabAttempt now enforces a 24h TTL (+~1m future-skew reject) before accepting a token. node --check OK. Not committed/deployed; GRADE_TOKEN_ENFORCED still OFF. |
| 2026-06-27 | functions/index.js | **G2 Codex round-3 (2 fixes, pre-deploy).** (HIGH) gradeToken could be minted for one list while grading against another (resolution used `request.data.listId`, token bound `writeContext||gradeContext`): now derive ONE canonical `bindCtx` (writeContext||gradeContext) used as the SOLE source of listId/classId for BOTH resolution and token binding; top-level listId/classId are a fallback only when no bindCtx; `serverGraded` additionally requires `!ctxMismatch` (refuse if top-level values are sent AND differ from bindCtx). finishGrading reuses the outer bindCtx (removed its local re-derivation). (MEDIUM) made `GRADE_TOKEN_ENFORCED=false` a true no-op: overwrite reconstruction in submitVocabAttempt is now gated on `tokenOk && GRADE_TOKEN_ENFORCED` (was `tokenOk`), so before enforcement the typed write behaves exactly as today. node --check OK. Not committed/deployed; enforcement OFF. |
| 2026-06-27 | functions/index.js | **G2 Codex round-4 (deploy-safety, pre-deploy).** (HIGH) token minting touched `GRADE_TOKEN_SECRET.value()` on the live typed path even with enforcement off (client now sends gradeContext), making the secret a hard runtime dependency that could break grading if unset. Fix: added `GRADE_TOKEN_MINT` flag (default OFF); minting now requires `mintTokens = GRADE_TOKEN_MINT || GRADE_TOKEN_ENFORCED` — with both off, grading never calls `.value()` (no secret dependency). Enforcement implies minting (can't desync into rejection). Wrapped the mint in try/catch (mint failure → grade still returned, token absent) and the submitVocabAttempt verify `.value()` in try/catch (secret problem → tokenOk=false, never throws past). **Pre-deploy requirement documented:** create `GRADE_TOKEN_SECRET` in Secret Manager before deploying (the functions declare it; deploy needs it to exist) — but live grading stays dormant w.r.t. it until `GRADE_TOKEN_MINT` is flipped. node --check OK. Not committed/deployed. |
| 2026-06-27 | functions/index.js | **W1/G2 Codex round-5 (HIGH, pre-deploy): strip client challenge metadata on attempt create.** `sanitizeStoredRows` spread `...a`, so a caller could include `challengeStatus:'pending'`/`challengeNote`/`challengeReviewedBy`/`challengeReviewedAt` in `attemptAnswers` and have them persisted on a NEW attempt — forging a pending challenge and bypassing the W1 `submitChallenge` token+history workflow (and reviewChallenge reads `answers[i].challengeStatus`). Fix: explicitly normalize all four challenge fields to `null` in `sanitizeStoredRows` output (covers typed-retry AND MCQ server writes); only `submitChallenge`/`reviewChallenge` add challenge metadata later. (Other unrecognized client row fields are inert — not read — so left as-is.) node --check OK. Not committed/deployed. |
| 2026-06-27 | docs/plans/*.md | **Downstream-plan consistency sweep (doc-only).** Reconciled the now-settled scope across the 4 grading/provenance plans: MCQ correctness authority is **Phase E** (server-owned option token / test-init snapshot), NOT a "fast-follow after Phase D" and NOT closeable by the forgeable `selectedOptionId`. Updated PLAN_grading_writepath_program.md (§1 Phase D, §6 out-of-scope, §7-G) + PLAN_teacher_grade_override.md (§0.5 per-answer gate) to say "Phase E"; marked the server-auth plan's §7-G reconciliation note ✅ done. Other scanned refs (server-mcq=no-trusted-marker, G2-only typed authority, deferred denominator/anchor) already consistent. No code change. |
| 2026-06-27 | firestore.rules | **W3 deploy-safety revert (Codex-High): keep live rules deploy-safe; stage W3 separately.** The W3 attempts lockdown (`create:false` + student `answers`-update removed) was applied directly to `firestore.rules`, but the client cutover flags (`SERVER_CHALLENGE_WRITE`/`SERVER_REVIEW_MARKER`) are still OFF — so any routine `firebase deploy` would ship the lockdown prematurely and deny the client's still-live fallback writes (challenge submit + empty-review marker). Reverted the `attempts` block to its current safe state (a ⚠️ comment now points to the staged file). W3 moved to **`docs/plans/W3_attempts_lockdown.rules.md`** (the exact block + preconditions + apply-last instructions + rollback). Net: repo's `firestore.rules` is deployable any time; W3 is applied deliberately as the final step after the flags are ON + validated. Not committed/deployed. |
| 2026-06-27 | LIVE digitalsat.co.kr T09/T10 question bank (48 questions) + dsg-edits/edit-t09t10.mjs, chart-insert.mjs (new) | **T09/T10 replacement executed on live.** 44 text-row writes via edit-t09t10.mjs (content overwrite + key/diff/passage-type only-if-differ; VOC Empty-enabler; G&T passage-type untouched). Result: 44/44 save:ok, 0 blocked, key/diff/PT all ✓; 6 rows showed passage/question ✗ that were FALSE POSITIVES (TinyMCE encodes accented chars → `&oacute;` etc.; re-verified ✓ with full entity decoder). 4 SVG-chart questions (118271/118255/118398/118381) were broken on live (chart flattened to text — platform strips inline SVG) → fixed via chart-insert.mjs: replace `<p><svg></p>` with centered PNG (from 26sm-t09-t10-images/, base64→`ed.uploadImages()`→hosted blob) + `<br><br>` + prose; all 4 img:✓ hosted:✓ save:ok, visually verified. Per-question backups in backups_t09t10/. Passages cleaned of generator contamination (nf-voc / trailing source: URL / full debug block). T10_M01_Q12 table question already correct, untouched. |
| 2026-06-27 | functions/index.js | **G2 Codex round-6 (CRITICAL, pre-deploy): writer-API guard in writeAttemptTxn.** Previously the `correctnessSource` was only *stamped*, not *required* — so under enforcement two paths could still persist a typed grade from unresolved/client definitions: (a) any caller of writeAttemptTxn omitting correctnessSource, and (b) gradeTypedTest's direct-write path when `serverGraded=false` (writes with null marker). Fix (§8.4): the one true writer now **refuses** a TYPED grade-bearing write when `GRADE_TOKEN_ENFORCED && correctnessSource !== 'server-ai'` (`permission-denied`). Covers BOTH the gradeTypedTest direct-write and submitVocabAttempt paths structurally. MCQ exempt (correctness authority is Phase E — no marker yet). node --check OK. Not committed/deployed. |
| 2026-06-27 | change_action_log.md | **Audit-accuracy fix (Codex):** marked the earlier "Lockdown W3: attempts write lockdown" row [SUPERSEDED] — that edit to firestore.rules was reverted same-day (W3 staged in docs/plans/W3_attempts_lockdown.rules.md); the live rules do NOT contain the lockdown. Reconciles the record. |
| 2026-06-27 | dsg-edits/verify-t09t10.mjs (new, READ-ONLY) | **Read-only re-verification of all 90 T09/T10 questions — NEVER saves** (no save/click/upload; nav + read getters only; full HTML-entity decoder per §4e; chart-aware: expects hosted <img>+prose for SVG rows, not an SVG match). Result: 80/90 pass; ALL 90 correct on content fields / answer key / difficulty; 4 charts + 1 table verified. 10 "failures" are passage-type only: VOC rows (118297,118296,118284,118280,118268,118266,118265,118422,118406,118390) read passage-type (none) on live vs expected Empty — root cause: full-diff.mjs's unreliable pt-detector wrongly classed them "already correct" so they were excluded from the write batch (NOT write failures; never touched). Per user decision 2026-06-27: **leave the 10 as-is** (content/key/difficulty all correct; passage-type metadata intentionally left unset). Report: dsg-edits/verify_report.json. |
| 2026-06-27 | firestore-tests/attempts_lockdown.rules.test.js (new) | **Tests: W3 rules-unit (security core).** `@firebase/rules-unit-testing` + node:test specs proving forgery is denied at the rule boundary: student create → denied, student answers/score update → denied, student own-delete → allowed, teacher-of-record update → allowed (other teacher denied), reads scoped to owner/teacher-of-record. Loads `firestore.rules` as-is → run AFTER applying the staged W3 block (run-before-W3 failures are the correct "not-applied-yet" signal). Needs `npm i -D @firebase/rules-unit-testing` + firestore emulator. ESM syntax OK. |
| 2026-06-27 | e2e/lockdown_g2.spec.js (new) | **Tests: Playwright E2E (legit flows).** Matches the existing harness (seeded_accounts.json / env creds, login helper, step+console logging). Covers login smoke, typed-grade round-trip (G2 no-regression), challenge submission (W1 callable path), empty-review Day-2+ completion (W2) — asserts user-visible OUTCOMES (resilient to flag on/off) + no grading/permission console errors. Daily-flow selectors are best-effort (authored without execution) — confirm on first run. Run: `npm run test:e2e -- lockdown_g2` with flags ON + dev server. ESM syntax OK. |
| 2026-06-27 | docs/plans/TEST_PLAN_lockdown_g2.md (new) | **Test plan/runbook** tying the two layers together (rules-unit first = strongest security signal, no deploy; Playwright E2E for flows), with setup commands, flag preconditions, and the manual deploy-time checks (data-integrity-sweep, live denial spot-check). Functions-logic unit tests flagged as a follow-on (need helper exports + functions-test mocking). |
| 2026-06-27 | dsg-edits/generate-lecture-pdf.mjs (new) + lecture_T09.pdf, lecture_T10.pdf | **Lecture-print PDFs for T09 & T10.** One PDF per test, all 3 modules combined (M01/M2L/M2U), built from cleaned sheet content (cleanPassage strips nf-voc/source/debug; SVG charts + table kept as rendered HTML), rendered Letter via Chromium page.pdf with footer page numbers. Each question shows module·Q# + type/passage-type meta, passage, stem, boxed A–D choices (no answers inline). Answer key on its own page at end: 1 row/question, columns Module | Q# | Answer | Difficulty(Easy/Med/Hard) | Question Type(VOC/PUR/PP/COM/QT/SUC/LOC) | Passage Type(— for VOC). 45 q each; line chart (T09), bar chart + table (T10) all render. Read-only on data; no dsg-site access. |
