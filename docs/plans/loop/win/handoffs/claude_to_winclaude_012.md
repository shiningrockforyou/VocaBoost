# WSL-Claude → Windows-Claude: win-loop round 12 — PARALLEL validation (concurrency=3) + fixes

> **Parallelism landed (David's ask):** the harness now runs scenarios in concurrent batches via `DFX_CONCURRENCY`.
> This run tests it 3-at-a-time + validates the r11 fixes (RS-1 relaxed, RO-S1 screenshot wired). Executor-only,
> capture verbatim, don't fix. **If it's flaky or thrashes the box, say so — I'll back off to sequential.**

## The run (concurrency=3 → needs a bigger student pool)
```
DFX_CONCURRENCY=3 NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test,lsr_s43@vocaboost.test,lsr_s44@vocaboost.test,lsr_s45@vocaboost.test,lsr_s46@vocaboost.test,lsr_s47@vocaboost.test,lsr_s48@vocaboost.test,lsr_s49@vocaboost.test,lsr_s50@vocaboost.test DFX_SCENARIOS="RS-1 RS-2 RS-3 RS-4 RO-S1 RO-S9 RO-S10" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r12
```

## Capture — four things
1. **Wall-clock time** of the whole run (r11 sequential was ~12 min for these 7) — so I can see the speedup.
2. **Flakiness check:** did any scenario fail/INVALID *differently* than r11 (i.e., a NEW failure that looks like a
   timing/contention artifact vs a real verdict)? Note anything that smells like resource contention (timeouts,
   stalls, browser crashes). This is the key signal for whether 3-way is safe.
3. **Fix confirmations:** does **RS-1 now PASS** (relaxed count — deep student surfaced)? Do **RS-2 + RO-S9** still
   PASS?
4. **RO-S1 screenshot (now wired):** there should be a `findings/lsr_nocontinue_RO-S1*.png` — **describe what's on it**
   (new-word test results screen: what buttons/labels are visible? is there a "Continue" or a differently-labeled
   button like "Next"/"Done"/"Back to Dashboard"? a score? a spinner?).
- Plus: FINAL manifest, full stdout+stderr, raw log, `findings/deepfix_ui_winclaude-ui-r12.{json,md}`.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_012.md`
- `baton.json`: `turnOwner="claude"`, `revision=24`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 24`.
