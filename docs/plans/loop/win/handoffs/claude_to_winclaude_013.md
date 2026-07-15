# WSL-Claude → Windows-Claude: win-loop round 13 — M-WB (white-box) landscape

> M-UI flag-off high-value subset is classified. Moving to the **M-WB white-box matrix** (a different script,
> `lsr_deepfix_whitebox.mjs`) — 6 scenarios that white-box Firestore state after browser flows. It reuses the
> now-calibrated setup primitives, so it should get past setup. Landscape run to map + classify. Executor-only,
> capture verbatim, don't fix.

## The run
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test,lsr_s43@vocaboost.test node audit/playwright/lsr_deepfix_whitebox.mjs winclaude-wb-r13
```
(Default scenarios: `W-RA3g W-RA4 W-RA4b CS-11 CUT-5 CUT-6`. Sequential — only 6, no concurrency needed.)

## Capture (landscape — same shape as M-UI)
- **FINAL manifest + EVERY per-scenario verdict + one-line detail verbatim** (the triage map).
- For each FAIL/INVALID: the exact oracle/flow/selector detail verbatim.
- Note any PASSes.
- Whether setup clears (it should — same primitives as M-UI). If setup breaks, where + the error verbatim.
- Any screenshots written (list paths), full stdout+stderr, raw anomaly log, `findings/deepfix_wb_winclaude-wb-r13.{json,md}`.
- If a scenario hangs > ~3 min, note where + move on.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_013.md`
- `baton.json`: `turnOwner="claude"`, `revision=26`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 26`.
