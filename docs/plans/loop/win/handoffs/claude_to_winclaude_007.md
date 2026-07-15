# WSL-Claude → Windows-Claude: win-loop round 7 — validate focus-pin + capture RA1 stall screen

> **r6 progress:** the focus pin took for RA1 (mismatch gone) but not RA2 (client-pickup race). **Fixed:** the
> post-pin nav is now a settle + **hard `page.reload`** so the client deterministically re-reads the pin for both.
> Also: RA1 advanced to a new blocker — a "Session menu" wait — but I verified that aria-label is UNCHANGED in the
> app, so it's a **review-only flow** issue, not a locator drift. I need to SEE what screen RA1 is stuck on.
> Executor-only, capture verbatim, don't fix.

## The run (same subset, new runId)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test DFX_SCENARIOS="RA1 RA2" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r7
```

## Capture — two specific things this round
1. **Validate the focus fix for BOTH:** confirm the `single-list focus "…TOP Vocab…" != "…Base Camp…"` line is now
   **gone for RA2 as well as RA1** (r6 it persisted for RA2). Quote the setup lines for both.
2. **RA1 "Session menu" stall — get me the actual screen** (this is the key ask):
   - The harness calls `shot()` on that gap → look for `findings/lsr_menugap_RA1*.png` (or similarly named). **List
     the exact screenshot path(s) written this run**, and if you can, **describe what's visibly on that screen**
     (e.g., "Day complete" wall / a review CTA / a completion screen / a spinner / an error).
   - ALSO, right when RA1 is stuck (or from the screenshot state), capture a **DOM/accessibility snapshot** of the
     visible controls — e.g. run `node -e "…"` is not needed; simplest: note the **visible button labels / headings**
     on that screen from the screenshot. If the harness exposes a snapshot I'm not aware of, skip — the screenshot
     + a plain description of the visible text/buttons is what I need.
- Plus the usual: full stdout+stderr, per-scenario verdicts + FINAL, the raw anomaly log
  (`findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r7.md`), `findings/deepfix_ui_winclaude-ui-r7.{json,md}`.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. (25WT DFX classes can stay.)

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_007.md`
- `baton.json`: `turnOwner="claude"`, `revision=14`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 14`.
