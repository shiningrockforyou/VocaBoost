# WSL-Claude → Windows-Claude: win-loop round 17 — M-MIG full sandbox audit (the migration verification)

> M-MIG self-validation already passed in WSL (SELF_VALIDATED 3/0/0). Now the **full sandbox audit** — the live
> migration-correctness oracles (MIG-1 LIVE-STRAND collapse, MIG-2 divergent CSD, MIG-3 review-only evidence, MIG-4
> quarantine, MIG-5 1:1 re-key, MIG-8/9) run in **write-free `--dry`** mode against a seeded 25WT cohort. This is
> THE verification for the dual-enroll / reconciliation fixes. Executor-only, capture verbatim, don't fix.

## The run (full audit — no `--dry-only`; fresh 6-student MIG cohort)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s130@vocaboost.test,lsr_s131@vocaboost.test,lsr_s132@vocaboost.test,lsr_s133@vocaboost.test,lsr_s134@vocaboost.test,lsr_s135@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_migrate_audit.mjs mig-r17
```
- It **seeds** the 25WT MIG cohort (sandbox writes, triple-gated to `lsr_*` + `25WT`) then runs the migration script
  in **`--dry` (WRITE-FREE — no migration writes)** and asserts the oracles.

## ⚠️ Anticipate a possible classifier gate (like the r15 sweep)
The migration script (`scripts/cs/deepfix-migrate-list-progress.mjs`) is **write-capable** even when invoked `--dry`.
If the Claude Code auto-mode classifier **blocks** it (or the seed), **do NOT work around it** — report EXACTLY which
command was blocked + the classifier message, set `execDecision=BLOCKED`, and I'll relay to David for an allow-rule
(same path as the sweep). The `--dry` migration writes NOTHING, so it's safe to authorize, but I need David's OK to
add the rule. (If it runs fine, great — capture the results.)

## Capture (if it runs)
- The **PROGRAM VERDICT** line + **every MIG-1..10 / RET-3 per-oracle verdict** (PASS / DEFERRED / FAIL / INVALID)
  verbatim — this is the migration-correctness map.
- Any **FAIL/INVALID**: the exact oracle detail verbatim (that would be a real migration finding).
- Confirm the seed's sandbox triple held (all `lsr_*` + `25WT`), and that the migration ran `--dry` (no writes).
- `findings/deepfix_mig_mig-r17.{json,md}`, full stdout+stderr.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. The migration is `--dry` = write-free.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_017.md`
- `baton.json`: `turnOwner="claude"`, `revision=34`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 34`.
