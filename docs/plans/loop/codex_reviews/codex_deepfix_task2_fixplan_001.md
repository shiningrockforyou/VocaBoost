# Codex review — DEEPFIX_TASK2_FIXPLAN round 1

Target: `audit/deepfix/task2/FIX_PLAN.md`  
Handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task2_fixplan_001.md`  
Review mode: surgical plan review against current working tree.

## Findings

### 1. blocker · P3/P4/P5 ordering · resolver writes before the audited migration

Problem: P4 sends live clients through `resolveListProgress` before P5, while P3 defines that resolver as a write-capable canonical hydrate/create path. That contradicts P5 being “THE data migration” and P4 having “NO data migration yet.”

Evidence:

- Plan P3 defines `resolveListProgress(listId)` as `canonical → hydrate-on-miss ... → create-fresh only when NO legacy doc exists`, and says it writes/logs applied CSD/TWI: `audit/deepfix/task2/FIX_PLAN.md:245-250`.
- Plan P4 flips progress hydration through `resolveListProgress` and says render paths “read, never write”: `audit/deepfix/task2/FIX_PLAN.md:299-303`.
- Plan P4 then states “NO data migration yet”: `audit/deepfix/task2/FIX_PLAN.md:325`.
- Plan P5 later claims the one-time collapse happens as a David-authorized CS event: `audit/deepfix/task2/FIX_PLAN.md:343-378`.
- Current model is class-keyed and writeful on access/completion: `src/services/progressService.js:33-34`, `src/services/studyService.js:156-158`, `src/services/progressService.js:264-271`.

Why this matters: if P4 traffic can hydrate/create canonical `list_progress` before P5, then the migration is already partially happening on arbitrary student loads, before backup/dry-run/review/authorization. That breaks the auditability and reversibility claims for the most dangerous phase.

Fix: choose one of these explicitly:

- Move P5 before any client uses a write-capable resolver; or
- Split `resolveListProgress` into pre-P5 read-only/shadow mode and post-P5 write mode. Before P5, it may compute/log a candidate but must not create/hydrate canonical `list_progress`; or
- Reframe P4 as the start of live lazy migration and give it the same backup/dry-run/authorization/rollback discipline as P5.

Until this is fixed, the phase graph is not safe.

### 2. high · P6 M8 role whitelist · proposed rule shape can break user creation or leave create semantics undefined

Problem: P6 says owner writes to `users/{uid}` should gain `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role'])`. That is not a complete safe rule for the existing `allow write` surface because user creation/merge currently writes `role`, and create/update need different policies.

Evidence:

- Current rules allow owner writes broadly: `firestore.rules:34-37`.
- The plan proposes an owner-write role whitelist at P6: `audit/deepfix/task2/FIX_PLAN.md:404-406`.
- Current user creation writes `role: docOverrides.role ?? 'student'`: `src/services/db.js:221-223`.
- It writes via `setDoc(..., { merge: true })`: `src/services/db.js:233`.

Why this matters: a blanket update-style `diff(resource.data)` rule on `allow write` risks either:

- breaking first-time user document creation if `role` is present, or
- forcing awkward client behavior that omits a field the app currently expects, or
- leaving role-on-create semantics underspecified.

Fix: split the rule by operation. Example policy shape:

- `allow create`: owner may create only if `request.resource.data.role == 'student'` or role is absent and server/default fills it.
- `allow update`: owner may update only if `affectedKeys` does not include `role` and does not mutate other server-owned fields.
- teacher/admin role changes should be via callable/admin path or explicit whitelist, not owner write.

Also add rules tests for: student create, student profile update, student role escalation update denied, student role=`teacher` create denied, legitimate teacher/admin role provisioning path allowed.

### 3. high · P4/P6 reset cutover · plan does not explicitly replace the live client reset/delete path before owner delete is removed

Problem: P6 removes owner attempt delete and says this is legal because P3 ships server `resetProgress`. But the P4 client cutover list does not explicitly route the existing reset UI/path to the server callable before the P6 rules cutoff.

Evidence:

- Current reset is a client-side destructive path: it deletes class progress, session state, study state, and attempts from the client: `src/services/db.js:2873-2876`, `src/services/db.js:2899-2914`, `src/services/db.js:2957-2993`.
- Current rules still allow students to delete their own attempts: `firestore.rules:120-122`.
- Plan P3 adds server `resetProgress`: `audit/deepfix/task2/FIX_PLAN.md:251-253`.
- Plan P6 removes owner attempt delete: `audit/deepfix/task2/FIX_PLAN.md:407-412`.
- Plan P4 cutover names completion, progress hydration, challenges, markers, nonce, build stamp, dashboard resolver; it does not explicitly say every reset caller is switched to the server callable: `audit/deepfix/task2/FIX_PLAN.md:298-317`.

Why this matters: if any current reset path survives into P6, reset becomes partially broken exactly when delete is denied. The plan’s legality argument for removing owner delete depends on the client no longer depending on that permission.

Fix: add a P4 hard requirement:

- introduce a `SERVER_RESET_PROGRESS` or equivalent route to the P3 `resetProgress` callable;
- migrate every UI/support caller off the client delete path;
- add greps/tests that no live client path calls the old `resetProgress` delete implementation;
- include a rules-denied reset persona after P6 that proves reset still works through the callable.

### 4. high · P3 non-regression · first functions deploy has live grading behavior changes despite “No live path changes”

Problem: P3 correctly notes that deploying functions will activate `GRADE_JOB_ENABLED=true`, but the phase’s non-regression section still says “No live path changes.” That is false for current `gradeTypedTest`.

Evidence:

- Current `GRADE_JOB_ENABLED` is true: `functions/index.js:90`.
- `gradeTypedTest` uses that flag to claim/recover grading jobs before grading: `functions/index.js:973-981`.
- It persists the grade-job result on grade-only return: `functions/index.js:1051-1054`.
- The callable `getGradingStatus` is enabled/disabled by the same flag: `functions/index.js:1454-1459`.
- Plan P3 admits this deploy “activates `GRADE_JOB_ENABLED=true` as a new live path”: `audit/deepfix/task2/FIX_PLAN.md:268-269`.
- Plan P3 later says “No live path changes in this phase”: `audit/deepfix/task2/FIX_PLAN.md:287`.

Why this matters: the first functions deploy is not just additive dormant code. It changes typed grading behavior immediately for existing clients. That may be desirable, but it cannot be treated as an idle surface.

Fix: either:

- set `GRADE_JOB_ENABLED=false` in P0/P3 until explicitly deployed as its own validated live-path change; or
- make P3 acceptance include the full grading-job recovery suite, live typed smoke, `getGradingStatus` behavior, lost-response recovery, stale lease/fencing cases, and rollback instructions.

Also remove or qualify the “No live path changes” sentence.

### 5. high · P5 CSD plausibility amendment · `reviewOnlyDay` marker source is not historically durable enough as written

Problem: the P5 amendment says the migration screen must count `reviewOnlyDay` markers plus post-anchor review attempts. Current code writes `reviewOnlyDay` only into the current `session_states` doc, while the durable `recentSessions` summary does not include that marker. The plan does not define a reliable historical marker source for multiple review-only days.

Evidence:

- Current code writes `reviewOnlyDay: true` into `session_states` only: `src/services/studyService.js:1451-1456`.
- The session summary persisted to progress includes scores, segment, words introduced/reviewed/tested, but not `reviewOnlyDay`: `src/services/studyService.js:1460-1472`.
- `recordSessionCompletion` appends that summary to `recentSessions`: `src/services/progressService.js:454-467`.
- The plan’s P5 amendment relies on “review attempts with `studyDay > anchorDay` AND `reviewOnlyDay: true` session markers”: `audit/deepfix/task2/FIX_PLAN.md:354-359`.

Why this matters: if a student completes many review-only days after P1, only the latest session state may carry the marker. A migration screen that expects historical markers will undercount legitimate CSD growth and can still quarantine/demote the students the amendment is meant to protect.

Fix: define the migration evidence precisely. At minimum:

- count distinct post-anchor review attempts by `(classId, listId, studyDay)` after `anchorSubmittedAt`;
- treat `reviewOnlyDay` session marker as supplemental/current-state evidence, not the primary historical counter, unless P1/P3 starts persisting the marker into `recentSessions`;
- cap one evidenced day per studyDay and require the review attempt to belong to the same student/list lineage;
- add migration dry-run assertions for students with N consecutive review-only days where N > 1.

If the desired source is `recentSessions`, then P1/P3 must start persisting `reviewOnlyDay` into the summary before P5 relies on it.

### 6. medium · P3 W2 acceptance · current callable lacks the upgraded fields, so the plan needs a hard output assertion

Problem: the plan says P3 upgrades `markReviewComplete` to stamp `newWordStartIndex`, `newWordEndIndex`, and a parseable `testId`. Current callable does not do that. This is acceptable as future work, but the phase gate should explicitly assert the output shape because this is the C-14/C-34 fix.

Evidence:

- Current callable writes marker fields but no `testId`, no `newWordStartIndex`, no `newWordEndIndex`: `functions/index.js:580-597`.
- Current review pairing requires exact range match: `src/services/db.js:3438-3444`.
- Current gradebook drops attempts if it cannot parse listId from `testId`: `src/services/db.js:1962-1977`.
- Plan P3 says the upgraded marker must include range + parseable testId: `audit/deepfix/task2/FIX_PLAN.md:256-258`.

Fix: add P3 acceptance tests that call `markReviewComplete` and assert:

- marker has parseable `testId`;
- marker has integer `newWordStartIndex`/`newWordEndIndex` equal to the day’s anchor;
- `getReviewForDay` pairs it;
- gradebook read surfaces include it.

### 7. medium · P0/P1 deploy-state · current tree is far dirtier than the plan’s “three-file #11” framing

Problem: the plan is right that #11 itself is in `studyService.js`, `DailySessionFlow.jsx`, and `Dashboard.jsx`, but the current working tree has many modified/untracked files. P0’s clean-tree requirement is therefore more important than the prose suggests.

Evidence:

- `git status --short` shows many modified/untracked files, including the three #11 files and many audit/harness/support files.
- The plan says #11 is the uncommitted three-file fix and P0 must commit it: `audit/deepfix/task2/FIX_PLAN.md:83-86`, `audit/deepfix/task2/FIX_PLAN.md:136`.
- Current git log confirms #9 and #10 commits exist: `1c91466`, `14e49a4`, with deploy marker `a967f54`.

Fix: P0 should require a scoped commit manifest, not just “tree clean.” Before deploy:

- isolate the #11 runtime diff from audit/harness/doc churn;
- record exact commit(s) that are allowed into the hosting bundle;
- run full client delta review against the last deployed bundle as P1 already requires.

## Claims checked and accepted

- The current progress identity is class/list keyed: `src/services/progressService.js:33-34`.
- `LIST_SCOPED_RECON` is true in current source: `src/config/featureFlags.js:30-41`.
- #9 code is present in current source: `src/services/studyService.js:240-274`, `src/services/db.js:3402-3444`.
- #10 pure pre-completion progress reads are present: `src/pages/TypedTest.jsx:978-985`, `src/pages/MCQTest.jsx:715-724`.
- #11 review-only predicate/clamp/gate are present in the dirty working tree: `src/services/studyService.js:1327-1342`, `src/services/studyService.js:1419-1439`.
- G1 landmine is real in source: `functions/index.js:58` is true, while the plan cites F-9 for prod false.
- Typed nonce double derivation is real in current source: `src/pages/TypedTest.jsx:767`, `src/pages/TypedTest.jsx:869-870`; nonce fallback re-mints per call on storage error: `src/utils/testRecovery.js:98-110`.
- Hosting-only deploy cannot directly alter `functions/index.js` flags; the risk is a mistaken non-hosting/bare deploy.
- Current `reviewChallenge` teacher ownership gap and unclamped TWI writer are real: `src/services/db.js:2665-2668`, `src/services/db.js:2826-2833`.
- Current attempt create/update/delete rules still expose the staged W3 surfaces: `firestore.rules:101-122`.

## Verdict

VERDICT blockers=1 high=4 med=2 nits=0

NEEDS_FIXES
