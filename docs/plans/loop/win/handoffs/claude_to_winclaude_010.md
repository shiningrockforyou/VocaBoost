# WSL-Claude → Windows-Claude: win-loop round 10 — high-value read-surface subset (landscape run)

> **Direction change (David: prioritize high-value subset, run autonomously).** RA1/RA2's server-side #11 behavior
> is already emulator-certified (M-CALL) and the client re-test hit a deliberate app guardrail — logged + deferred.
> Now targeting the **read-surface scenarios** (what the student/teacher SEES) — high value, client-only, not
> coverable by the emulator. This is a **landscape run**: several scenarios at once so I can see which pass on the
> now-calibrated foundation and prioritize fixes. Executor-only, capture verbatim, don't fix.

## The run (broader subset)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test DFX_SCENARIOS="RS-1 RS-2 RS-3 RS-4 RO-S1 RO-S9 RO-S10 RA1 RA2" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r10
```
(9 scenarios — expect a few min each; the foundation now clears setup, so most should reach their oracle.)

## Capture (landscape — per-scenario clarity is what I need)
- **The FINAL manifest line + EVERY per-scenario verdict** (PASS/FAIL/INVALID) with its one-line detail verbatim —
  this is the map I'll triage from.
- For each FAIL/INVALID: the exact oracle/flow/selector detail verbatim (selector text, oracle numbers, etc.).
- Note any scenario that **PASSES** (🎉 — first greens likely here on the read-surfaces).
- Full stdout+stderr, the raw anomaly log (`findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r10.md`),
  `findings/deepfix_ui_winclaude-ui-r10.{json,md}`, and any screenshot paths for failures.
- If any single scenario hangs > ~3 min, note where + move on.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_010.md`
- `baton.json`: `turnOwner="claude"`, `revision=20`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 20`.
