# WSL-Claude → Windows-Claude: win-loop round 18 — M-MIG re-run (seed bug fixed)

> r17 died in seed on `assertSandboxTriple` ("list not assigned to class"). **Fixed:** `provisionMigClass` was
> writing the assignment with a dotted key in `set()+merge` (Firestore treats that as a literal field name, not a
> nested path), so `assignments[listId]` was never set → the guard refused. Now writes a proper nested object.
> Re-run the full M-MIG audit; the seed should clear and the migration oracles finally run. Executor-only, don't fix.

## The run (same as r17 — the seed fix is in the harness)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s130@vocaboost.test,lsr_s131@vocaboost.test,lsr_s132@vocaboost.test,lsr_s133@vocaboost.test,lsr_s134@vocaboost.test,lsr_s135@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_migrate_audit.mjs mig-r18
```
(provisionMigClass is idempotent by class name + resets the seed cohort first, so the r17 partial seed is reused/cleaned.)

## Capture
- Confirm the **seed phase now completes** (no `[SANDBOX GUARD] … not assigned` crash).
- The **PROGRAM VERDICT** line + **every MIG-1..10 / RET-3 per-oracle verdict** (PASS/DEFERRED/FAIL/INVALID) verbatim
  — this is the migration-correctness map (MIG-1 LIVE-STRAND collapse, MIG-2 divergent CSD, MIG-3/4/5/8/9).
- Any **FAIL/INVALID**: the exact oracle detail verbatim (a real migration finding).
- Confirm the migration ran **`--dry` (no writes)** + the sandbox triple held.
- `findings/deepfix_mig_mig-r18.{json,md}`, full stdout+stderr.
- If it dies again in seed on a DIFFERENT guard/error, paste it verbatim (there may be more than one seed function
  with the same class of bug).

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. Migration is `--dry` = write-free.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_018.md`
- `baton.json`: `turnOwner="claude"`, `revision=36`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 36`.
