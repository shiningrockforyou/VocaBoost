# Codex independent issue investigation — DEEPFIX Task 1.3

Target: `DEEPFIX_TASK1_ISSUES` round 1  
Primary inputs read: `claude_to_codex_deepfix_task1_001.md`, `MASTER_TASK_PLAN.md`, `TA_CHATLOG_2026-06-30_to_07-13.md`, `SESSION_CONTEXT_2026-07-13.md`, `TA_CHATLOG_TRIAGE_2026-07-13.md`, `NEED_TO_FIX.md`, `SUPPORT_RUNBOOK.md`, and current code.

## North star

A well-built VocaBoost should model vocabulary progress as student-owned progress through an explicit list sequence. Classes should grant access and policy, not own a student's position. Day completion should be idempotent, tied to a durable session/attempt identity, and able to represent all valid states: new+review, review-only, finished-list, retake, restart/cycle, and cross-class continuation. Teacher-facing corrections should be server-authoritative and auditable. Every UI should read from query shapes that match its filter semantics, not page-limited post-filters.

## Structural root 1 — progress identity is still class-attached, with list-scoped reconciliation as an overlay

### Issue 1 — the data model still stores progress as `{classId}_{listId}`, so cross-class carry remains an overlay rather than the source of truth

- Symptom: the TA log repeatedly reports class-promotion/cross-class carry tickets: Park Juha / Son Jinwook / Nam Sei / Kaila / Lucy / An Yiyeon / Yoo Hyejun. [V-log 2026-07-02, 2026-07-08, 2026-07-13]
- Evidence:
  - Progress doc ids are still built as `classId_listId`, not `studentId_listId`: [V-code `src/services/progressService.js:33`].
  - Session initialization reads/writes the class-scoped progress doc through `getOrCreateClassProgress(userId, classId, listId)`: [V-code `src/services/studyService.js:156-158`].
  - Reconciliation tries to compensate by finding the best passed-new anchor across the student's whole list when `LIST_SCOPED_RECON` is on: [V-code `src/services/db.js:3250-3275`].
  - The current flag is ON in source: [V-code `src/config/featureFlags.js:30-41`].
- Layer: data model / service.
- Related `NEED_TO_FIX`: #6, #12.
- Ideal convergence: replace class-owned progress with a true `users/{uid}/list_progress/{listId}` record; class-specific `class_progress` should become either a compatibility view or be removed after migration. Reconciliation should not be an opportunistic repair on session entry; it should be the normal read model.
- Open questions:
  - Are any teacher surfaces still reading `class_progress` as authority after the list-scoped flag turns on?
  - What is the migration rule for conflicting same-list progress across classes when CSD and TWI disagree?

### Issue 2 — cross-class CSD is non-demoting, but CSD is still a class-local session counter, so "day" can become policy-dependent rather than list-position-dependent

- Symptom: chat/runbook examples include cross-pace day confusion: Oh Halyn expected 660 but correct continuation was 640; Jo Junmo was carried to Inter A2 Day 9 even though that credited 40 extra words under the faster class pace. [V-log 2026-07-13 10:34; V-doc `SUPPORT_RUNBOOK.md` CS-2026-07-07b]
- Evidence:
  - TWI is anchor-authoritative, but CSD is explicitly non-demoting under `LIST_SCOPED_RECON`: [V-code `src/services/progressService.js:223-236`].
  - Daily pace comes from the launching class assignment, not the progress record: [V-code `src/services/studyService.js:175-182`].
- Layer: data model / pedagogy semantics.
- Related `NEED_TO_FIX`: #6, #12.
- Ideal convergence: make word position the durable truth; make displayed "day" a derived view for the launching class policy, with explicit UX copy for cross-pace transitions.
- Open questions:
  - Should CSD remain stored at all in the student-owned model, or should it be computed from completed sessions/lap history?
  - Should cross-pace moves preserve exact next word or requested class-day number when those conflict?

### Issue 3 — reset semantics are incoherent under list-scoped carry

- Symptom: the registry already notes per-class reset becomes a no-op when another class's same-list anchor survives. [V-doc `NEED_TO_FIX.md` "Known flag-ON consequence"]
- Evidence:
  - `resetStudentProgress` deletes one class/list progress doc: [V-code `src/services/db.js:2899-2904`].
  - It operates under a `{classId}_{listId}` identity: [V-code `src/services/db.js:2900-2901`].
  - But the list-scoped anchor reader ignores classId under flag-on: [V-code `src/services/db.js:3267-3275`].
- Layer: data model / product UX.
- Related `NEED_TO_FIX`: known flag-ON consequence, #6.
- Ideal convergence: define reset as a list-progress epoch/lap reset. It must reset or partition all attempts/study states that can act as anchors for the same list, not just one class doc.
- Open questions:
  - Who is allowed to perform a true list reset: student, teacher, or admin only?
  - Should reset preserve gradebook history while excluding old attempts from future anchors via an epoch field?

### Issue 4 — list assignment/removal is access control, but the app historically treated it like progress state

- Symptom: the chat and runbook show students stranded when a list is unassigned/swapped; F03 fixed the warning text, but not the underlying ability to strand. [V-doc `SUPPORT_RUNBOOK.md` CS-2026-06-23b]
- Evidence:
  - Unassign deletes `assignments.{listId}` and removes the list from `assignedLists`: [V-code `src/services/db.js:823-842`].
  - The UI now warns that students lose access until re-assigned: [V-code `src/pages/ClassDetail.jsx:387-395`].
  - The warning is warn-only; the operation still proceeds: [V-code `src/pages/ClassDetail.jsx:393-401`].
- Layer: product UX / data model.
- Related `NEED_TO_FIX`: #6 / F03 class of issue.
- Ideal convergence: unassign should be modeled as revoking access while preserving progress visibility and offering migration/alternate-list choices for affected students. At minimum, teacher should see an affected-student count and active-progress list.
- Open questions:
  - Does the teacher UI have enough loaded progress to warn precisely, or does it need a server-side affected-students query?

## Structural root 2 — the session/day state machine still cannot naturally represent all valid terminal and review-only states

### Issue 5 — review-only/list-end completion is fixed in the working tree, but live behavior remains broken until deploy

- Symptom: 2026-07-13 reports repeatedly show "Day not complete — pass the new-word test first" at list end; scan found 169 review-only wall students. [V-log 2026-07-13; V-doc `SUPPORT_RUNBOOK.md` CS-2026-07-13c/d/e/f]
- Evidence:
  - Current working tree has the review-only guard: `reviewOnlyDay` is only true for finite `newWordCount <= 0` plus confirmed reason: [V-code `src/services/studyService.js:1310-1335`].
  - It clamps `wordsIntroduced` to 0 for review-only days: [V-code `src/services/studyService.js:1336-1342`].
  - It skips the Day-2+ passed-new gate only on review-only days: [V-code `src/services/studyService.js:1426-1439`].
  - The UI has a finished-list hero state: [V-code `src/pages/Dashboard.jsx:1559-1695`].
  - Context says the fix is local-only, uncommitted, not deployed: [V-doc `SESSION_CONTEXT_2026-07-13.md` §2].
- Layer: service / deploy state / product terminal.
- Related `NEED_TO_FIX`: #11.
- Ideal convergence: ship the review-only fix as part of a larger terminal-state model: finish list → choose/recommend next list or start-over cycle; no "phantom review-only day" should be needed as an operational workaround.
- Open questions:
  - Does the final deployed behavior record a completion for list-end review days, or should list-end route to a terminal without incrementing CSD?
  - Should the data-integrity sweep be updated first or in the same deploy, since legitimate review-only days will otherwise look anomalous?

### Issue 6 — chronic low reviews are allowed to "pass" while also feeding intervention into a dead-end

- Symptom: Junseo's low reviews drove full intervention and a zero-new review-only day; review scores like 13%, 20%, 27%, 10%, 40% appear in triage/runbook. [V-doc `TA_CHATLOG_TRIAGE_2026-07-13.md` N4; V-doc `SUPPORT_RUNBOOK.md` CS-2026-07-13c]
- Evidence:
  - Attempts are marked `passed=true` for all review tests in the server writer: [V-code `functions/index.js:371-377`].
  - Client test pages also mark review tests passed regardless of score: [V-code `src/pages/TypedTest.jsx:815-818`; `src/pages/MCQTest.jsx:528-529` from rg output].
  - Intervention is computed from recent session review scores at session initialization: [V-code `src/services/studyService.js:166-182`].
  - Before the review-only fix, zero-new days could not record the high review that would lower intervention; the fix addresses the deadlock but not the pedagogical signal. [V-code `src/services/studyService.js:1311-1327`].
- Layer: pedagogy/product / service.
- Related `NEED_TO_FIX`: #11, #15.
- Ideal convergence: review score should have a coherent product meaning. Either reviews are non-gating practice with teacher-visible intervention alerts, or they are retakable/gated when extremely low. The current model lets a 2% review both advance and become permanent.
- Open questions:
  - What score should trigger teacher intervention, and where should it surface?
  - Should review retakes replace or coexist with the first review attempt?

### Issue 7 — no review-retake path means accidental/garbage review submissions are permanent

- Symptom: Park Seojun accidentally submitted a Day-7 review with 2% and wanted a retake; teachers asked about rollback after a below-cutline review advanced a student. [V-log 2026-07-07 12:21; 2026-07-06 20:52]
- Evidence:
  - Review attempts are always passed by server/client as above: [V-code `functions/index.js:371-377`; `src/pages/TypedTest.jsx:815-818`].
  - Current review state completion writes session summary and `recentSessions`; no reviewed score threshold is used as a gate after review completion. [V-code `src/services/studyService.js:1460-1475`; `src/services/progressService.js:454-470`].
- Layer: product UX / service.
- Related `NEED_TO_FIX`: #15.
- Ideal convergence: reviews need an explicit retake/void mechanism with auditable policy. If reviews are non-gating, the UI should say so and allow teachers to mark a mistaken submission as invalid.
- Open questions:
  - Should invalidated review attempts remain in gradebook with a superseded marker?

## Structural root 3 — test generation and completion still depend on multiple client paths and stale context

### Issue 8 — wrong-sized tests at boundaries are plausible from multiple test-generation paths

- Symptom: Hyeseong got Day-1 totalQ=10 while class config was 30; Ho Hyeong promotion retake was out of 30 instead of 35; Lee Seohyun got a 15-question duplicate/re-serve. [V-log 2026-07-07 11:26, 17:41; 2026-07-09 12:46]
- Evidence:
  - The main `buildTestConfig` path takes assignment `testSizeNew` and applies `selectTestWords`: [V-code `src/utils/testConfig.js:29-45`].
  - Typed and MCQ standalone/smart paths independently fetch assignment settings and initialize sessions instead of only consuming a sealed launch config: [V-code `src/pages/TypedTest.jsx:347-380`; `src/pages/MCQTest.jsx:286-321`].
  - Retake regenerates from `originalWords` and `configuredTestSize`, which depends on the previous page state being correct: [V-code `src/pages/TypedTest.jsx:1122-1125`; `src/pages/MCQTest.jsx:842-844`].
  - `selectTestWords` legitimately returns fewer questions when the eligible pool is smaller than `testSize`: [V-code `src/utils/studyAlgorithm.js:391-410`]. That explains list-end remainders but not Day-1 10/30 if the pool had sufficient new words.
- Layer: client / session state / test generation.
- Related `NEED_TO_FIX`: #13.
- Ideal convergence: the test should be launched from one immutable server/client session descriptor containing classId, listId, policy, word ids, expected count, and attempt identity. Retakes should reuse that descriptor or request a new sealed descriptor, never recompute from ambient class state.
- Open questions:
  - For Hyeseong, was `wordPool` or `testConfig` path used? Without read-only attempt/session artifacts, the code only shows plausible roots.
  - Are there duplicated routes that bypass `buildTestConfig` under recovery/resume?

### Issue 9 — client result cards still recompute pass/fail from local threshold state instead of trusting the stored/server verdict

- Symptom: prior threshold tickets included 93% shown as fail while server considered class threshold lower; current code partly fixed threshold resolution but still recomputes the visible verdict. [V-log 2026-07-03 14:08, 14:53]
- Evidence:
  - Typed result card computes `passed = score >= retakeThreshold`: [V-code `src/pages/TypedTest.jsx:1303-1333`].
  - MCQ result card does the same: [V-code `src/pages/MCQTest.jsx:1038-1070`].
  - Legacy typed path now tries to resolve class threshold before falling back to 95: [V-code `src/pages/TypedTest.jsx:310-325`].
  - The durable server writer computes `passed` using class assignment `passThreshold`: [V-code `functions/index.js:340-377`].
- Layer: client / product.
- Related `NEED_TO_FIX`: #5.
- Ideal convergence: result screens should display the authoritative attempt `passed` result. Local threshold state may be shown as explanation, but should not determine the verdict after a persisted attempt exists.
- Open questions:
  - Does `submitVocabAttempt` return enough attempt payload to render from server verdict on every path?

### Issue 10 — attempt day stamping still has fallback complexity that can hide route/session identity bugs

- Symptom: same-day/cross-class/recovery tickets are hard to pin because tests can derive `studyDay` after losing launch context. [?]
- Evidence:
  - Typed test derives `studyDay` from `getOrCreateClassProgress` if `sessionContext.dayNumber` is missing: [V-code `src/pages/TypedTest.jsx:819-839`].
  - It then corrects "clearly invalid" provided day numbers by reading class progress and querying the new attempt: [V-code `src/pages/TypedTest.jsx:845-860`].
  - The same pattern exists in MCQ by rg around the corresponding lines: [V-code `src/pages/MCQTest.jsx:537-579` from rg output].
- Layer: client/session identity.
- Related `NEED_TO_FIX`: #9, #10, #13.
- Ideal convergence: tests should not infer identity from mutable progress. A launched test should carry a sealed attempt/session descriptor; if that descriptor is stale, fail closed with a rebuild, not silently re-stamp.
- Open questions:
  - Are fallback logs (`attempt_day_fallback`, `attempt_day_context_invalid`) high-volume in production?

## Structural root 4 — teacher corrections and student challenges are still not fully server-authoritative

### Issue 11 — role trust is still based on a self-writable user document

- Symptom: teacher-only operations depend on `users/{uid}.role`, but owner writes can modify the whole user document. This blocks safe teacher override and other teacher-gated actions. [?]
- Evidence:
  - Rules permit owner write to their own `users/{userId}` doc without a role-field whitelist: [V-code `firestore.rules:31-37`].
  - Rule-level `isTeacher()` reads `getUserData().role`: [V-code `firestore.rules:14-20`].
  - Client auth context also reads role from the user doc: [V-code `src/contexts/AuthContext.jsx:32-43`].
  - `renameStudent` server callable checks caller doc `role === "teacher"`: [V-code `functions/index.js:1847-1850`].
- Layer: security/authz.
- Related `NEED_TO_FIX`: #1b.
- Ideal convergence: teacher authority should be a custom claim or a server-maintained immutable field. Owner self-writes must whitelist profile/settings only.
- Open questions:
  - Are any legitimate profile update paths currently writing the entire user doc and would break under a whitelist?

### Issue 12 — attempt creation/update lockdown is not complete in live rules, even though server writers exist

- Symptom: attempt forgery remains possible through direct client create/update until W3 rules deploy; challenge write is also client-fallback because the client flag is OFF. [?]
- Evidence:
  - Rules allow any authenticated user to create an attempt with their own `studentId`: [V-code `firestore.rules:101-107`].
  - Rules allow student updates to the entire `answers` array if only that top-level field changes: [V-code `firestore.rules:109-118`].
  - Client flag keeps server challenge write OFF: [V-code `src/config/featureFlags.js:12-20`].
  - Server-side `submitChallenge` callable exists and only mutates challenge metadata, not `isCorrect`: [V-code `functions/index.js:615-678`].
  - Legacy client path still updates `attempts.answers`: [V-code `src/services/db.js:2557-2638`].
- Layer: security / Cloud Function rollout.
- Related `NEED_TO_FIX`: #1c, #1.
- Ideal convergence: all attempt creation and challenge mutation should go through callable/server writers; rules should deny client attempt create and deny client answer-array updates.
- Open questions:
  - Are all client attempt-create paths now switched to `submitVocabAttempt`, including empty-review automarkers?
  - Has the W3 rules file been applied anywhere outside the repo?

### Issue 13 — teacher challenge review still recomputes scores from mutable attempt answers

- Symptom: a forged `answers[].isCorrect` can be laundered when a teacher reviews any pending challenge; this is the same structural reason grade override cannot safely ship until attempts are locked down. [?]
- Evidence:
  - `reviewChallenge` reads the existing `answers` array from the attempt: [V-code `src/services/db.js:2670-2686`].
  - It sets one challenged answer correct only if accepted, but recomputes `correctCount` from all `updatedAnswers.isCorrect`: [V-code `src/services/db.js:2693-2706`].
  - It writes top-level `score` and `passed`: [V-code `src/services/db.js:2722-2731`].
  - Student rules still allow whole-answer-array update as noted above: [V-code `firestore.rules:109-118`].
- Layer: security / teacher workflow.
- Related `NEED_TO_FIX`: #1c, #14.
- Ideal convergence: challenge review must be a server callable that recomputes from trusted stored grading rows or immutable original grade artifacts. Teacher override must stamp exactly what changed, who changed it, and why.
- Open questions:
  - Is `reviewChallenge` still reachable in production after the server-side submitChallenge work? Gradebook imports and calls it client-side. [V-code `src/pages/Gradebook.jsx:18`; rg lines 1366-1401]

### Issue 14 — challenge tokens are a punitive 30-day rejection window, not the "weekly reset" operationally described to TAs

- Symptom: TAs told students challenge tokens reset next week, but code uses active rejected challenges until `replenishAt`, and both client and server set replenish to +30 days. [V-log 2026-07-01 14:05; V-doc `TA_CHATLOG_TRIAGE_2026-07-13.md` N2]
- Evidence:
  - Client token availability counts active rejected history entries whose `replenishAt` is in the future: [V-code `src/services/db.js:175-184`].
  - Legacy client challenge sets `replenishAt = now + 30 days`: [V-code `src/services/db.js:2611-2618`].
  - Server challenge callable uses the same 30-day replenish constant: [V-code `functions/index.js:638-665`].
- Layer: product policy / UX / support docs.
- Related `NEED_TO_FIX`: #14.
- Ideal convergence: make challenge policy explicit in UI and TA runbook. If the goal is abuse prevention, distinguish accepted, pending, and rejected usage; if the goal is learning support, add teacher override/regrade so token exhaustion cannot strand a correct student.
- Open questions:
  - Should accepted challenges consume quota?
  - Should a teacher-accepted false-negative restore a token?

### Issue 15 — no teacher grade override means deterministic grader false-negatives become permanent-fail states

- Symptom: chat reports a student writing the correct answer but being marked wrong every time; token exhaustion blocks challenge; TAs resort to manual grading outside VocaBoost. [V-log 2026-07-08 14:00-14:15]
- Evidence:
  - There is a challenge workflow, but no general teacher "mark answer/day passed" callable/UI in current code discovered by rg; `reviewChallenge` only operates on existing pending challenges and one wordId: [V-code `src/services/db.js:2644-2651`].
  - Server graded typed attempts require AI grading/token provenance for typed write trust: [V-code `functions/index.js:474-514`].
  - No override path exists in `NEED_TO_FIX` except as proposed future work: [V-doc `NEED_TO_FIX.md` #1].
- Layer: product / backend / teacher workflow.
- Related `NEED_TO_FIX`: #1, #2, #14.
- Ideal convergence: add a teacher-authorized server override that edits specific items or marks a day passed using the same anchor-validating server write path as normal attempts. It must not trust client `answers[]`.
- Open questions:
  - What is the minimal override: per-answer accept, regrade whole attempt, or mark-day-passed?

## Structural root 5 — operational surfaces hide real data because queries and provenance are not aligned with UI claims

### Issue 16 — gradebook Name filter is page-limited post-processing, so inactive students show "no results"

- Symptom: Lee Jihoo showed Day 8 on Students but no results in Grades/Gradebook. [V-log 2026-07-09 14:29; V-doc `SUPPORT_RUNBOOK.md` CS-2026-07-09b]
- Evidence:
  - Name filters map to student ids, but the Firestore query starts as `teacherId == teacherId orderBy submittedAt desc`: [V-code `src/services/db.js:1878-1928`].
  - Class and date filters are applied at query level; student/name filter is not: [V-code `src/services/db.js:1930-1943`].
  - Only after fetching one page does the code post-filter `filterStudentIds`: [V-code `src/services/db.js:1960-1984`].
  - Attempts with unrecognized `testId` format are dropped before filtering: [V-code `src/services/db.js:1964-1977`].
- Layer: client query / data access.
- Related `NEED_TO_FIX`: #8.
- Ideal convergence: query by studentId server-side when the UI says "show this student's grades." Pagination should operate over the filtered result set, not over teacher-wide recency.
- Open questions:
  - Which composite indexes are needed for `teacherId + studentId + submittedAt` and optional class/list filters?

### Issue 17 — class `assignedLists: []` split-brain is still present in code paths

- Symptom: Run L found a class with assignments but empty `assignedLists`, making the student dashboard unstudyable. [V-doc `NEED_TO_FIX.md` #7]
- Evidence:
  - `getStudentClasses` uses `classData.assignedLists || Object.keys(assignments)`; `[]` is truthy, so it suppresses the assignments fallback: [V-code `src/services/db.js:495-503`].
  - `getAssignedListsForClass` has the same pattern: [V-code `src/services/db.js:1435-1439`].
  - Similar assignment list reads appear in other code paths by rg: [V-code `src/services/db.js:1531`, `src/services/db.js:1808`, `src/services/db.js:2314` from rg output].
- Layer: data compatibility / client query.
- Related `NEED_TO_FIX`: #7.
- Ideal convergence: normalize class assignment state to one canonical representation. Until migration, every reader should treat empty `assignedLists` plus non-empty `assignments` as "derive from assignments."
- Open questions:
  - Are there live 26SM classes with this split-brain after ensure-all-lists?

### Issue 18 — deploy provenance remains an operational risk if version/flag endpoint is not live

- Symptom: previous grader fixes existed in repo but production behaved as stale; current source has multiple flag-gated fixes whose live status matters. [V-doc `NEED_TO_FIX.md` #4]
- Evidence:
  - Critical behavior is gated by local source flags: `SERVER_ATTEMPT_WRITE=true`, `SERVER_CHALLENGE_WRITE=false`, `SERVER_REVIEW_MARKER=false`, `LIST_SCOPED_RECON=true`: [V-code `src/config/featureFlags.js:1-41`].
  - Functions source has grading token enforcement/mint flags: [V-code `functions/index.js:52-71`].
  - `version` function is present and returns flag state by rg: [V-code `functions/index.js:1905-1906`].
- Layer: ops / deploy process.
- Related `NEED_TO_FIX`: #4.
- Ideal convergence: every support diagnosis should start with a live `/version`/callable check showing commit, build time, dirty flag, and runtime flags for client/functions/rules.
- Open questions:
  - Is the `version` function deployed on production now, and is Netlify exposing the matching client build id?

## Current-code corrections to context docs

1. **#9 cross-class review completion is no longer absent in the current working tree.** The current code zeroes `newWordCount` on `REVIEW_STUDY` resume and preserves the day anchor range: [V-code `src/services/studyService.js:240-274`]. It also list-scopes review lookup and pairs by exact anchor range after anchor submittedAt: [V-code `src/services/db.js:3402-3443`]. If production lacks this, that is a deploy-state issue, not a current-code absence.
2. **#10 self-race is fixed in current Typed and MCQ code.** Both test pages now snapshot progress with pure `getClassProgress` under `LIST_SCOPED_RECON`, not reconciling `getOrCreateClassProgress`: [V-code `src/pages/TypedTest.jsx:976-985`; `src/pages/MCQTest.jsx:714-724`]. Treat any doc still describing it as live in current source as stale unless production differs.
3. **F02/F03 are present in current code.** Dashboard progress-prefers active lists before newest-assigned: [V-code `src/pages/Dashboard.jsx:1085-1109`], and unassign warning honestly states access loss: [V-code `src/pages/ClassDetail.jsx:387-395`].
4. **#1c is partially implemented but not closed.** A safe `submitChallenge` callable exists: [V-code `functions/index.js:615-678`], but `SERVER_CHALLENGE_WRITE=false` [V-code `src/config/featureFlags.js:12-20`] and rules still allow client `answers` updates/create [V-code `firestore.rules:101-118`]. The structural vulnerability remains until flag + rules rollout.

## Out of scope / resolved-by-design / non-VocaBoost

- APBoost is out of scope for this deepfix pass.
- Math/Canvas/Skill Mastery textbook issues in the chat are not VocaBoost root causes. [V-log 2026-07-01, 2026-07-03]
- "Adv A2 12/12" at the list boundary is likely a legitimate remainder case, because `selectTestWords` returns the whole eligible pool when smaller than configured test size: [V-code `src/utils/studyAlgorithm.js:405-410`].
- Oh Halyn's 640-vs-660 case appears carry-correct under cross-pace exact-position semantics, not a bug, if the intended source position really was 640. [V-log 2026-07-13 10:34-11:06]

DEEPFIX-TASK1-ISSUES done: issues=18 structural-roots=5 doc-contradictions=4
