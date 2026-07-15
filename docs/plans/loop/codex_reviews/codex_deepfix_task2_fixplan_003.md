# Codex review — DEEPFIX_TASK2_FIXPLAN round 3

Target: `audit/deepfix/task2/FIX_PLAN.md` v3  
Handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task2_fixplan_003.md`  
Scope: delta-only review of the v3 verifier folds.

## Delta checks

### 1. F4-1 blocker: read-only resolver vs day-guard baseline

Resolved.

The v3 text now correctly distinguishes the two writes:

- forbidden before P5: new canonical `list_progress` creation/hydration;
- preserved before P5: legacy `class_progress` reconciliation write needed to keep the completion day-guard baseline current.

Evidence:

- Current legacy reconciliation writes safe CSD/TWI to class progress: `src/services/progressService.js:264-271`.
- Current completion day-guard bases `expectedDay` on stored class progress: `src/services/progressService.js:441-448`.
- v3 explicitly says read-only mode must not create the canonical `list_progress` doc but must preserve the legacy entry-time reconciliation write: `audit/deepfix/task2/FIX_PLAN.md:284-310`.
- v3 P4 says completion still writes legacy `class_progress` through P4 and no canonical `list_progress` exists until P5: `audit/deepfix/task2/FIX_PLAN.md:397-404`.
- v3 sequencing constraint repeats the same invariant: `audit/deepfix/task2/FIX_PLAN.md:886-890`.

This fixes both sides: no pre-P5 canonical migration, and no stale-class-progress completion rejection loop.

Implementation note: keep render-only resolver calls and session-entry resolver calls clearly separated. Render paths can consume in-memory reconciliation; session-entry/completion-prep is the path that must preserve the legacy class-progress reconciliation write. The plan language is sufficient, but the implementation should encode this distinction explicitly.

### 2. F4-2: server `reviewOnlyDay` predicate

Resolved.

The server completion path now has to replicate all three client predicate reasons, not allocation-only.

Evidence:

- Current client predicate: allocation <= 0 OR list complete OR `startPhase === REVIEW_STUDY`: `src/services/studyService.js:1327-1335`.
- v3 P3 requires the same three reasons and calls out the #9 REVIEW_STUDY double-introduce failure mode: `audit/deepfix/task2/FIX_PLAN.md:270-278`.
- v3 P3 acceptance requires diff-checking S3/S4/S5/S8 fixtures: `audit/deepfix/task2/FIX_PLAN.md:276-278`.

This closes the #9-resume TWI double-introduction trap.

### 3. F4-3: teacher provisioning with role-create split

Resolved.

The plan now treats self-select teacher signup as the vulnerability and requires a real provisioning path in the same P6 release as the role-create denial.

Evidence:

- Current signup passes `role: formState.role`: `src/pages/Signup.jsx:38`.
- Current UI exposes a Teacher choice: `src/pages/Signup.jsx:147`.
- v3 P6 requires either admin/invite/callable provisioning or student-only signup plus a separate provisioning step: `audit/deepfix/task2/FIX_PLAN.md:613-622`.
- v3 P6 tests include self-select-teacher denied/removed and legitimate provisioning success: `audit/deepfix/task2/FIX_PLAN.md:638-644`.

This preserves onboarding while closing self-escalation.

### 4. F4-4 / F6-1 / F6-9: P5 write-target flip, operational window, reversibility

Resolved.

The migration is now operationally specified as a three-part cutover: eager canonical write, `completeSession` target flip, resolver write-capable flip.

Evidence:

- v3 P5 defines the atomic write-target flip: `audit/deepfix/task2/FIX_PLAN.md:533-539`.
- v3 P5 requires off-peak execution, watch window, and post-flip catch-up for completions racing the migration: `audit/deepfix/task2/FIX_PLAN.md:541-550`.
- v3 P5 now states honest reversibility: clean restore only before first post-flip completion; after that rollback is reconcile/replay: `audit/deepfix/task2/FIX_PLAN.md:552-572`.
- v3 sequencing constraint captures the three-flag atomic cutover: `audit/deepfix/task2/FIX_PLAN.md:899-900`.

This is operationally safe enough for a live cohort plan.

### 5. F5-HIGH-1: MCQ remains client-authoritative

Resolved as an honest residual, not silently converged.

Evidence:

- Current server write records MCQ/legacy correctness as untrusted/null, with no server-MCQ marker: `functions/index.js:436-442`.
- v3 N5 now carries an explicit caveat: `audit/deepfix/task2/FIX_PLAN.md:36`.
- v3 adds a dedicated ledger section explaining forged MCQ can still create range-valid anchors and that Phase-E server-MCQ remains a follow-on: `audit/deepfix/task2/FIX_PLAN.md:988-1006`.
- v3 invariant matrix says the third-writer and TWI arithmetic are addressed, not that MCQ correctness is fully server-authoritative: `audit/deepfix/task2/FIX_PLAN.md:954-955`.

This is acceptable because the plan no longer overclaims N5.

### 6. F5-HIGH-2: third TWI writer / `reviewChallenge`

Resolved.

The challenge-accept day-advance is now pulled forward into the foundation cutover instead of being deferred to P10.

Evidence:

- Current client path hard-codes class progress and has the unclamped TWI write: `src/services/db.js:2790-2795`, `src/services/db.js:2831-2833`.
- v3 P3 builds a server path for this day-advance and requires clamp/phase gate: `audit/deepfix/task2/FIX_PLAN.md:330-340`.
- v3 P4 routes the day-advance leg to that server path so it writes the foundation record, legacy pre-P5 and canonical post-P5: `audit/deepfix/task2/FIX_PLAN.md:419-423`.
- v3 sequencing constraint requires all three progress/TWI targets to migrate together: `audit/deepfix/task2/FIX_PLAN.md:894-898`.
- v3 invariant matrix adds the third-writer row: `audit/deepfix/task2/FIX_PLAN.md:954-955`.

No live path is intentionally left writing TWI to dead `class_progress` after P5/P7.

### 7. F6-2 / F6-3: teacher reads and CS toolchain

Resolved.

The plan now includes the teacher Students view and CS scripts, not only the student app path.

Evidence:

- Current teacher progress view calls `fetchStudentsProgressForClass`: `src/pages/ClassDetail.jsx:198`.
- That helper reads class progress directly through `getClassProgress`: `src/services/progressService.js:518-531`.
- v3 P4 routes the teacher read path to the resolver and adds teacher-surface grep acceptance: `audit/deepfix/task2/FIX_PLAN.md:413-418`, `audit/deepfix/task2/FIX_PLAN.md:453-458`.
- v3 P5 schedules sweep/census/manual-pass rework to target `list_progress`: `audit/deepfix/task2/FIX_PLAN.md:559-565`.
- v3 P7 requires zero `class_progress` refs across `src`, `functions`, and `scripts/cs` before deleting docs: `audit/deepfix/task2/FIX_PLAN.md:666-687`.

This closes the post-migration stale/dead-collection read/write gap.

### 8. F6-4 / F6-5: CONT-A/CYC expectations and focus-yield pin branch

Resolved.

The plan now distinguishes fast next-list continuation from slower cycling/start-over, handles the five finished-everything students as an interim/comms item, and explicitly covers the saved-focus branch.

Evidence:

- Current dashboard checks explicit saved focus before recency: `src/pages/Dashboard.jsx:1060-1075`; recency fallback is later at `src/pages/Dashboard.jsx:1108`.
- v3 P8 says focus-yield must handle the explicit pin branch and be lap-aware for P9: `audit/deepfix/task2/FIX_PLAN.md:720-730`.
- v3 P8 acceptance includes a CS-pinned finished student persona: `audit/deepfix/task2/FIX_PLAN.md:750-753`.
- v3 P8 expectation-setting separates CONT-A from CYC and flags the five finished-everything students: `audit/deepfix/task2/FIX_PLAN.md:701-708`.
- v3 decision list makes the comms/provisioning item explicit: `audit/deepfix/task2/FIX_PLAN.md:1064-1069`.

This resolves the product/rollout gap.

## Verdict

VERDICT blockers=0 high=0 med=0 nits=0

CONVERGED-OK
