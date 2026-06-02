# APBoost Platform Boundary Audit

Date: 2026-06-01
Scope: Read-only APBoost review inside the VocaBoost codebase.

## Goal

Assess whether APBoost can run as a parallel platform on the same domain and shared Firebase userbase while keeping APBoost functionality and learning data isolated from VocaBoost and from unrelated AP teachers/classes.

## Executive Verdict

APBoost is structurally mounted as a parallel platform: `/ap` routes live inside the same React app, use the same Firebase Auth/AuthContext, and are supported by the Firebase Hosting SPA rewrite. The basic same-domain, same-login model is viable.

The largest issues are authorization and platform isolation. APBoost uses `ap_`-prefixed collections, which is the right namespace boundary, but the current Firestore rules are too broad for an isolated AP platform. Several rules allow any authenticated user or any teacher to read/write AP data that should likely be scoped by owning teacher, assigned student, class membership, or Admin SDK functions.

Session durability is much stronger than a prototype: APBoost has IndexedDB queuing, duplicate-tab detection, heartbeat takeover checks, stale-session pausing, queue flush before submit, and server-side idempotent submission. The main remaining stability risks are around assignment/class context not being captured server-side and storage security not being verifiable from this repo.

## Evidence Reviewed

- `src/App.jsx`
- `src/apBoost/routes.jsx`
- `src/contexts/AuthContext.jsx`
- `src/apBoost/components/TeacherRoute.jsx`
- `src/apBoost/utils/apTypes.js`
- `src/apBoost/services/*`
- `src/apBoost/hooks/*`
- `src/apBoost/pages/APTestSession.jsx`
- `src/apBoost/pages/APGradebook.jsx`
- `functions/index.js`
- `functions/scoring.js`
- `firestore.rules`
- `firestore.indexes.json`
- `firebase.json`

## What Looks Good

### Same-Domain Routing

APBoost routes are mounted in the main React router through `apBoostRoutes`, and the Firebase Hosting rewrite sends all paths to `index.html`. Direct loads of `/ap`, `/ap/test/:testId`, `/ap/results/:resultId`, and teacher AP routes should work as SPA routes.

Relevant files:

- `src/App.jsx`
- `src/apBoost/routes.jsx`
- `firebase.json`

### Shared Auth/Userbase

APBoost uses the same `AuthContext` and shared `users/{uid}` profile/role data as VocaBoost. This fits the desired model where the same user logs in once and can access separate systems.

Relevant files:

- `src/contexts/AuthContext.jsx`
- `src/apBoost/components/TeacherRoute.jsx`

### Collection Namespacing

APBoost data is mostly isolated by collection name:

- `ap_tests`
- `ap_questions`
- `ap_answer_keys`
- `ap_stimuli`
- `ap_session_state`
- `ap_test_results`
- `ap_classes`
- `ap_assignments`

This is a good baseline for separating APBoost from VocaBoost data.

Relevant file:

- `src/apBoost/utils/apTypes.js`

### Server-Side Test Submission

APBoost uses callable Cloud Functions for session creation and test submission. MCQ scoring is server-side, answer keys are fetched server-side, result IDs are deterministic for idempotency, and session completion/result creation are handled transactionally.

Relevant files:

- `functions/index.js`
- `functions/scoring.js`
- `src/apBoost/services/apScoringService.js`
- `src/apBoost/services/apSessionService.js`

### Session Durability

APBoost has several mechanisms aimed at avoiding lost student work:

- IndexedDB queue for answer/timer/navigation writes.
- Queue flush before result creation.
- Duplicate-tab detection with `BroadcastChannel`.
- Firestore `sessionToken` heartbeat takeover detection.
- Server-side scheduled pause of stale sessions.
- Local pause markers for tab close/background detection.

Relevant files:

- `src/apBoost/hooks/useOfflineQueue.js`
- `src/apBoost/hooks/useTestSession.js`
- `src/apBoost/hooks/useDuplicateTabGuard.js`
- `src/apBoost/hooks/useHeartbeat.js`
- `functions/index.js`

## Findings

### P0: Firestore Rules Are Too Broad For AP Isolation

Current AP rules allow:

- Any authenticated user to read all `ap_tests`.
- Any authenticated user to read all `ap_questions`.
- Any authenticated user to read all `ap_stimuli`.
- Any authenticated user to read all `ap_classes`.
- Any authenticated user to read all `ap_assignments`.
- Any teacher to write all AP tests/questions/stimuli/classes/assignments.
- Any teacher to read all `ap_session_state`.
- Any teacher to read all `ap_test_results`.
- Any teacher to read/write all `ap_answer_keys`.

This is acceptable only if APBoost is intentionally a global shared AP bank with all teachers trusted equally. It is not acceptable if APBoost needs teacher/class/student isolation.

Impact:

- Students can read AP class and assignment roster data.
- Teachers can access other teachers' AP answer keys.
- Teachers can modify/delete other teachers' AP tests/classes/assignments/questions.
- Teachers can read all AP sessions/results, not just their own students.

Relevant file:

- `firestore.rules`

Recommended direction:

- Add rule helpers for AP teacher ownership, class membership, assignment membership, and result ownership.
- Scope teacher reads/writes to `createdBy`, `teacherId`, `assignedBy`, or owned class membership.
- Keep result/session creation server-only.
- Consider moving sensitive AP writes through Cloud Functions.

### P0: AP Class And Assignment Rosters Are Globally Readable To Authenticated Users

`ap_classes` and `ap_assignments` likely contain `studentIds`, class membership, due dates, teacher IDs, and assignment relationships. Current rules allow any authenticated user to read both collections.

Impact:

- Student roster leakage across classes.
- Assignment visibility leakage across unrelated users.
- Potential privacy problem if APBoost is used with real students.

Relevant files:

- `firestore.rules`
- `src/apBoost/services/apTeacherService.js`

Recommended direction:

- `ap_classes`: allow read only for owning teacher, enrolled students, and authorized admins.
- `ap_assignments`: allow read only for assigning teacher, assigned students, and possibly class members.

### P0: Firebase Storage Rules Are Missing Or Not Verifiable

APBoost uploads handwritten FRQ files to paths like:

- `ap_frq_uploads/{userId}/{resultId}/{filename}`
- `ap_frq_graded/{resultId}/graded_{timestamp}.pdf`

No `storage.rules` file was found, and `firebase.json` does not configure storage rules. I cannot verify that students can only access their own uploads or that teachers can only access their own graded PDFs.

Impact:

- Student handwritten work may be overexposed if deployed Storage rules are broad.
- Teachers may be able to access or modify unrelated graded PDFs depending on deployed rules.
- The repository does not document or enforce storage isolation.

Relevant files:

- `src/apBoost/services/apStorageService.js`
- `firebase.json`

Recommended direction:

- Add versioned `storage.rules`.
- Scope student uploads by `request.auth.uid == userId`.
- Scope graded PDFs by the result's owning AP teacher or move graded upload through a Cloud Function.

### P1: Assignment-Level Attempt Limits Are Probably Not Enforced Server-Side

Assignments store `maxAttempts`, defaulting to 3. However, `createSession` enforces `testData.maxAttempts || Infinity`, not assignment-level `maxAttempts`.

Impact:

- A teacher may assign a test with 1, 2, or 3 attempts, but the server may not enforce that assignment limit.
- Client UI may display one limit while Cloud Functions enforce another.
- Students may be able to exceed assignment attempt limits.

Relevant files:

- `src/apBoost/services/apTeacherService.js`
- `functions/index.js`

Recommended direction:

- Resolve the assignment server-side during `createSession`.
- Enforce `assignment.maxAttempts` when a session is assignment-based.
- Decide separate behavior for published/public practice tests.

### P1: Assignment/Class Context Is Not Preserved Into Result Documents

`createSession` stores `assignmentId`, but not `classId`. `buildTestResult` writes `classId: session.classId || null`, so AP results will commonly have `classId: null`.

Impact:

- Gradebook class filters may miss assigned student results.
- Analytics by class can be empty or incorrect.
- Teacher workflows can look broken even when submissions exist.

Relevant files:

- `functions/index.js`
- `functions/scoring.js`
- `src/apBoost/pages/APGradebook.jsx`
- `src/apBoost/services/apAnalyticsService.js`

Recommended direction:

- During `createSession`, validate the assignment and copy `assignmentId`, `classId` or `classIds`, `assignedBy`, and assignment-level policy onto the session.
- During `submitTest`, copy that context onto `ap_test_results`.
- Consider one result per assignment attempt rather than only per `userId_testId_attemptNumber` if the same test can be assigned in multiple classes.

### P1: Published Tests Can Accept An Arbitrary Assignment ID

`createSession` accepts `assignmentId`. For unpublished tests, access is checked through assignments. For published tests, access is allowed immediately and the provided `assignmentId` is not validated against the requesting user/test.

Impact:

- A user could create a session for a public test and attach an unrelated assignment ID.
- Result records could be misattributed to assignments.
- Gradebook/analytics could be polluted if downstream views trust `assignmentId`.

Relevant file:

- `functions/index.js`

Recommended direction:

- If `assignmentId` is supplied, always validate that assignment belongs to the test and contains the student.
- If public practice mode is intended, store `assignmentId: null` unless validation succeeds.

### P1: Analytics Question Lookup May Return Empty Results

`apAnalyticsService.getTestAnalytics()` queries `ap_questions` with `where('testId', '==', testId)`. The rest of the model appears to store question membership in `ap_tests.sections[].questionIds`. Created questions do not appear to receive `testId` by default.

Impact:

- Question-level analytics may be empty even when results exist.
- FRQ/MCQ performance views can underreport or fail.

Relevant files:

- `src/apBoost/services/apAnalyticsService.js`
- `src/apBoost/services/apQuestionService.js`
- `src/apBoost/services/apTestService.js`

Recommended direction:

- Build analytics questions from `test.sections[].questionIds`, using batched `getDoc`/`getAll`-style reads.
- Avoid relying on `ap_questions.testId` unless the schema is intentionally denormalized and consistently maintained.

### P1: Teacher Entitlement Is Shared With VocaBoost Teacher Role

APBoost teacher routes use the same shared `role === 'teacher'` as VocaBoost.

Impact:

- Every VocaBoost teacher is automatically an APBoost teacher.
- Every APBoost teacher is also a VocaBoost teacher unless additional checks exist elsewhere.
- This may be intended, but it is not product-isolated entitlement.

Relevant files:

- `src/contexts/AuthContext.jsx`
- `src/apBoost/components/TeacherRoute.jsx`

Recommended direction:

- If product entitlements should differ, add explicit fields such as:
  - `roles.apTeacher`
  - `roles.vocaboostTeacher`
  - `products.apBoost.enabled`
  - `products.vocaboost.enabled`

### P2: Student-Side Question Sanitization Is Good But Not Sufficient By Itself

`getTestForStudent()` strips `correctAnswers`, `correctAnswer`, and `explanation` from question documents client-side. Answer keys are stored separately in `ap_answer_keys`.

This is good defense-in-depth, but Firestore still lets students read raw `ap_questions` directly. If legacy question docs contain answer fields, students could bypass the client and read them.

Relevant files:

- `src/apBoost/services/apTestService.js`
- `firestore.rules`

Recommended direction:

- Ensure migration removed answer fields from every `ap_questions` document.
- Use Firestore rules/schema discipline so answer keys never exist in student-readable docs.
- Consider separate student-safe question documents or Cloud Function fetch if stricter enforcement is needed.

### P2: Lint Has Many APBoost Failures

Targeted lint command:

```bash
npx eslint src/apBoost functions/index.js functions/scoring.js
```

Result:

- 86 problems.
- 76 errors.
- 10 warnings.

The function errors include CommonJS globals (`require`, `exports`, `module`) not recognized by the active lint environment. APBoost errors include unused imports/variables, React hook/compiler rules, no-case-declarations, refs accessed during render, and setState-in-effect warnings/errors.

Impact:

- Build still passes, so these are not immediate syntax/build blockers.
- Lint is not currently a clean safety gate for APBoost.
- Some lint findings point to real maintainability or React correctness risks.

Recommended direction:

- Separate app ESLint config from functions ESLint config.
- Fix APBoost unused variables/imports.
- Review React compiler lint findings before enabling them as hard gates.

## Build Check

Command:

```bash
npm run build
```

Result:

- Build passed.
- Vite emitted chunk-size warnings.
- Vite also warned that `src/services/db.js` is dynamically and statically imported, so dynamic import will not split that module.

## Recommended Target Architecture

Keep one Firebase Auth userbase and one deployed domain, but create explicit APBoost boundaries:

1. `/ap/*` remains APBoost UI.
2. `users/{uid}` remains shared identity/profile.
3. Product-specific entitlements are added if APBoost teacher access should differ from VocaBoost teacher access.
4. APBoost learning data stays in `ap_*` collections.
5. APBoost Firestore rules enforce:
   - result owner student;
   - owning AP teacher;
   - assigned student;
   - class member;
   - admin/server-only writes where needed.
6. APBoost Storage rules are added and deployed from repo.
7. `createSession` becomes the server authority for assignment membership, attempt limits, class context, and result attribution.

## Priority Fix Order

1. Tighten AP Firestore rules for classes, assignments, results, sessions, answer keys, and teacher-owned content.
2. Add and deploy Storage rules for AP FRQ uploads/graded PDFs.
3. Fix `createSession` assignment validation, assignment-level `maxAttempts`, and class context propagation.
4. Fix analytics question lookup to use test section question IDs.
5. Decide whether APBoost and VocaBoost share the same teacher role or need separate product entitlements.
6. Clean targeted APBoost lint enough that it can become a useful regression gate.

