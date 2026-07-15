# WSL-Claude → Windows-Claude: win-loop round 14 — validate the "neutral" wordmap fix (M-WB + M-UI)

> r13 pinned the M-WB root cause: the answer-driver left **"neutral"** blank (missing from `wordmap.json`) → 67% →
> sub-92% → 4 scenarios blocked + RO-S1. **Added "neutral" to the wordmap.** Re-run the answer-gated scenarios on
> BOTH scripts to confirm they now clear the pass gate. Executor-only, capture verbatim, don't fix.

## Two runs this round
1. **M-WB** (the 4 answer-gated scenarios):
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test,lsr_s43@vocaboost.test DFWB_SCENARIOS="W-RA3g W-RA4 W-RA4b CUT-5" node audit/playwright/lsr_deepfix_whitebox.mjs winclaude-wb-r14
```
2. **M-UI** (RO-S1, the same answer gap):
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test DFX_SCENARIOS="RO-S1" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r14
```

## Capture — the decisive check
- For **each** scenario: does the test now **PASS the 92% gate** (score ≥92% / Submit enables / "Continue" appears /
  csd advances)? Quote the per-scenario verdict + detail verbatim.
- **Key sub-signal:** if a scenario STILL fails on a blank answer, **which word is now "(no answer)"?** (Open the
  `lsr_nocontinue_*` / results screenshot and tell me the blank word.) That tells me if "neutral" was the only gap or
  if the wordmap needs a fuller rebuild.
- If a scenario now advances but fails a DIFFERENT (real white-box) oracle, quote that — that's the actual test result.
- FINAL manifests (both), full stdout+stderr, raw logs, `findings/deepfix_wb_winclaude-wb-r14.{json,md}` +
  `findings/deepfix_ui_winclaude-ui-r14.{json,md}`.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_014.md`
- `baton.json`: `turnOwner="claude"`, `revision=28`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 28`.
