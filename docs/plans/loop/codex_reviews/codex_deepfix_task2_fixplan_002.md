# Codex review — DEEPFIX_TASK2_FIXPLAN round 2

Target: `audit/deepfix/task2/FIX_PLAN.md` v2  
Handoff: `docs/plans/loop/handoffs/claude_to_codex_deepfix_task2_fixplan_002.md`  
Scope: delta-only review of the seven round-1 folds.

## Delta checks

### 1. Prior blocker: pre-P5 canonical `list_progress` writes

Resolved.

The plan now defines `resolveListProgress` as a two-mode resolver:

- P3/P4 read-only/shadow mode: compute/return/log the merged view, but do not create or hydrate canonical `list_progress`.
- P5 write-capable mode: flipped as part of the audited migration after backup/dry-run/authorization.

Evidence:

- P3 resolver read-only mode: `audit/deepfix/task2/FIX_PLAN.md:258-276`.
- P4 explicitly routes progress reads/hydration through the read-only resolver and says completion still writes legacy `class_progress`: `audit/deepfix/task2/FIX_PLAN.md:348-357`.
- P4 asserts no canonical `list_progress` writes and requires a zero-doc check before P5: `audit/deepfix/task2/FIX_PLAN.md:389-394`.
- P5 procedure says the eager migration script is the single audited canonical writer, then flips resolver write-capable: `audit/deepfix/task2/FIX_PLAN.md:452-462`.
- New sequencing constraint states the falsifier directly: `audit/deepfix/task2/FIX_PLAN.md:737-741`.

I found no remaining pre-P5 plan path that writes a canonical `list_progress` doc. CONT-A still creates only class-keyed progress pre-P5, which the plan explicitly accepts and later migrates: `audit/deepfix/task2/FIX_PLAN.md:593-594`.

### 2. Prior high: M8 role rule

Resolved.

The rule is now split by operation instead of applying an update-style diff to all writes.

Evidence:

- Current user creation writes `role` and uses merge-set: `src/services/db.js:221-233`.
- P6 now requires `allow create` to permit only `student`/absent role, `allow update` to exclude `role`, and teacher/admin role changes through callable/admin: `audit/deepfix/task2/FIX_PLAN.md:494-506`.
- P6 rules matrix includes student create, profile update, role escalation update denied, teacher-role create denied, and admin/callable provisioning allowed: `audit/deepfix/task2/FIX_PLAN.md:521-526`.

This preserves onboarding while closing self-escalation.

### 3. Prior high: reset cutover before owner-delete removal

Resolved.

P4 now explicitly routes every reset caller to server `resetProgress` before P6 removes client owner delete, and P6 makes that a hard precondition.

Evidence:

- Current reset is client-side delete-heavy and currently depends on owner attempt-delete rules: `src/services/db.js:2873-2876`, `src/services/db.js:2899-2914`, `src/services/db.js:2957-2993`, `firestore.rules:120-122`.
- P4 adds `SERVER_RESET_PROGRESS`, requires every reset UI/support entry point to migrate, and requires bundle grep for zero live client attempt-delete: `audit/deepfix/task2/FIX_PLAN.md:358-365`.
- P4 validation includes zero live client attempt-delete and reset-via-callable persona: `audit/deepfix/task2/FIX_PLAN.md:381-385`.
- P6 precondition and rules tests repeat the requirement: `audit/deepfix/task2/FIX_PLAN.md:515-526`.
- Non-regression matrix now has a reset row: `audit/deepfix/task2/FIX_PLAN.md:798`.

This resolves the cutoff breakage.

### 4. Prior high: P3 live grading-job path

Resolved.

The false “no live path changes” claim is gone. P3 now treats `GRADE_JOB_ENABLED=true` as the single intended live-path activation and adds appropriate acceptance.

Evidence:

- Current flag and consumers remain real: `functions/index.js:90`, `functions/index.js:973-981`, `functions/index.js:1051-1054`, `functions/index.js:1454-1459`.
- P3 now states the live activation explicitly: `audit/deepfix/task2/FIX_PLAN.md:294-306`.
- P3 acceptance includes the seven-transition grading-job recovery suite plus a live typed smoke: `audit/deepfix/task2/FIX_PLAN.md:308-320`.
- Rollback is identified as the documented `GRADE_JOB_ENABLED` flip: `audit/deepfix/task2/FIX_PLAN.md:314-315`.

Acceptance is sufficient for this plan stage.

### 5. Prior high: P5 CSD plausibility evidence for review-only days

Resolved.

The plan no longer depends on the non-durable `reviewOnlyDay` session marker as historical evidence. It uses durable post-anchor review attempts as primary evidence.

Evidence:

- Current marker is written only to session state and not to the durable summary: `src/services/studyService.js:1451-1456`, `src/services/studyService.js:1460-1472`.
- P5 now defines primary evidence as distinct post-anchor review attempts by `(classId, listId, studyDay)`, `submittedAt > anchor`, same student/list lineage, capped one per studyDay: `audit/deepfix/task2/FIX_PLAN.md:420-438`.
- The marker is explicitly supplemental/current-state only: `audit/deepfix/task2/FIX_PLAN.md:428-434`.
- P5 dry-run now must assert N>1 consecutive review-only days pass on attempt evidence alone: `audit/deepfix/task2/FIX_PLAN.md:436-438`.
- Sequencing constraints repeat that attempts are the durable ledger: `audit/deepfix/task2/FIX_PLAN.md:730-736`.

This is the correct direction. The remaining implementation burden is to define “same lineage” precisely in the migration script, but the plan-level invariant is now sound.

### 6. Prior medium: W2 upgraded marker output shape

Resolved.

P3 acceptance now asserts the actual fields and downstream consumers required for the C-14/C-34 fix.

Evidence:

- Current callable lacks `testId` and range: `functions/index.js:580-597`.
- Current pairing needs exact range: `src/services/db.js:3438-3444`.
- Current gradebook drops unparseable `testId`: `src/services/db.js:1962-1977`.
- P3 acceptance now requires parseable `testId`, integer `newWordStartIndex`/`newWordEndIndex` equal to anchor, `getReviewForDay` pairing, and gradebook visibility: `audit/deepfix/task2/FIX_PLAN.md:319-324`.

### 7. Prior medium: P0 scoped commit manifest

Resolved.

P0 now requires a scoped commit manifest rather than relying on the misleading “three-file dirty tree” framing.

Evidence:

- Changelog records the fold and the dirty-tree premise: `audit/deepfix/task2/FIX_PLAN.md:952`.
- P0 now requires isolating only the three #11 runtime files, recording the sha, and reviewing the full client delta; this is summarized in the changelog and tied back to P0 acceptance: `audit/deepfix/task2/FIX_PLAN.md:946-952`.

## Residual notes

- I did not re-scan the whole plan; this was intentionally limited to the seven deltas and the pre-P5 canonical-write falsifier.
- The implementation phase should preserve the resolver mode switch as an explicit server-side flag/constant with tests proving P4 cannot write canonical docs.
- The migration script should make “same student/list lineage” concrete for review-attempt evidence; the plan is sound, but the implementation must not leave that as prose.

## Verdict

VERDICT blockers=0 high=0 med=0 nits=0

CONVERGED-OK
