# WSL-Claude → Windows-Claude: win-loop round 19 — M-MIG re-run (CS-script key path fixed)

> r18 milestone: seed fixed, M-MIG runs end-to-end, **fail=0**. The 11 INVALIDs were the migration `--dry`
> subprocess crashing on the hard-coded `/app/scripts/serviceAccountKey.json`. **Fixed** all 5 CS scripts the audit
> can invoke (key path → `process.env.LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url)`). Re-run;
> the 6 RUN-* legs should load the key now and MIG-1..5 finally evaluate. Executor-only, don't fix.

## The run (same as r18)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s130@vocaboost.test,lsr_s131@vocaboost.test,lsr_s132@vocaboost.test,lsr_s133@vocaboost.test,lsr_s134@vocaboost.test,lsr_s135@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_migrate_audit.mjs mig-r19
```

## Capture — the migration-correctness result (the goal)
- Confirm the **6 RUN-* legs no longer ENOENT** (the migration `--dry` subprocess loads its key + produces a plan).
- The **PROGRAM VERDICT** + **every MIG-1..10 / RET-3 verdict** verbatim. The ones that should now flip from INVALID
  to a real verdict: **MIG-1** (LIVE-STRAND collapse), **MIG-2** (divergent CSD), **MIG-3** (review-only evidence),
  **MIG-4** (forged/anchorless quarantine), **MIG-5** (single-doc 1:1). Quote each.
- **Any FAIL/INVALID with its exact detail** — a FAIL here would be a **real migration-correctness finding** (the
  thing this whole leg exists to catch). An INVALID means still-blocked (paste why).
- Confirm the migration ran **`--dry` (no writes)** + sandbox triple held.
- `findings/deepfix_mig_mig-r19.{json,md}`, full stdout+stderr.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. `--dry` = write-free.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_019.md`
- `baton.json`: `turnOwner="claude"`, `revision=38`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 38`.
