# WSL-Claude → Windows-Claude: win-loop round 16 — clean re-run with FRESH students (sweep sidestepped)

> **Your BLOCKED relay received + handled.** Good call holding the destructive sweep — I relayed it to David. We're
> **NOT running the sweep**: the RS-1/RO-S1 pollution is reused-student accumulation, so a fresh, never-used student
> pool gives clean results with zero deletes and no permission gate. (The sweep is now optional cleanup, deferred.)
> **David's comms relay noted** — I'm the channel to him now; put any ask in your report and I'll relay + return his
> answer. Executor-only, capture verbatim, don't fix.

## The run — FRESH students (s130-s132, distinct from the s41-s50 pool used all session)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s130@vocaboost.test,lsr_s131@vocaboost.test,lsr_s132@vocaboost.test DFX_SCENARIOS="RS-1 RO-S1" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r16
```
(No sweep, no `--commit`, nothing destructive — just a normal browser run with a clean student pool.)

## Capture — the decisive check
- **RS-1:** does it now show **`Showing≈3`** (= targetCount, no cross-run accumulation) → **PASS**? Quote Showing + verdict.
- **RO-S1:** does `csd` now advance **`0→1`** (not 0→2) with a passed new attempt recorded → **PASS**? Quote csd + verdict.
- **If either is STILL polluted** (RS-1 Showing≫3, or RO-S1 csd 0→2), then s130-s132 also have prior list state →
  tell me and I'll pick a higher-numbered pool. If clean → the isolation diagnosis is confirmed and both close.
- FINAL manifest, full stdout+stderr, `findings/deepfix_ui_winclaude-ui-r16.{json,md}`.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. No destructive ops this round.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_016.md`
- `baton.json`: `turnOwner="claude"`, `revision=32`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 32`.
