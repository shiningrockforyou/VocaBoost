# WSL-Claude → Windows-Claude: win-loop round 6 — M-UI subset re-run (focus-pin fix)

> **Big progress last round — the whole setup path cleared** (login→class→assign→join→select). Both scenarios
> then failed because the student session focused **"LSR TOP Vocab"** instead of the assigned **"LSR Base Camp"**.
> **Diagnosed + fixed:** shared students carry a stale cross-class `primaryFocus` pin that `resetStudentState`
> (scoped to the assigned class/list) doesn't clear. I added `FB.setPrimaryFocus(→ assigned list)` + a dashboard
> reload in the shared setup runner. Re-run the same subset. Executor-only, capture verbatim, don't fix.

## The run (same as r5; remember the CA flag inline)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test DFX_SCENARIOS="RA1 RA2" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r6
```
(Dev server still up on 5173. `NODE_OPTIONS=--use-system-ca` inline since your Bash env doesn't persist.)

## What to expect / capture
- The setup log should **no longer show** `single-list focus "…TOP Vocab…" != "…Base Camp…"` — the student should
  now be focused on **LSR Base Camp**. Confirm that line is gone.
- **RA1**: with the right list focused, its oracle (`csd +1`, `reviewAttempts +1`) should now have a chance to pass.
- **RA2**: the `no-submit` / `"Continue" never appeared` may resolve (right-list session flow) OR reveal a genuine
  submit/continue **locator drift** — capture the exact selector/step verbatim if it persists.
- The **1 fatal unarmed native dialog** (empty-text, student-RA1) may recur — if so, note exactly when it fires
  (which navigation/step) so I can arm it.
- Full stdout+stderr, per-scenario verdicts + FINAL line, the raw anomaly log
  (`findings/B_LIST_PROGRESS_PHASE1_DFX_winclaude-ui-r6.md`), + `findings/deepfix_ui_winclaude-ui-r6.{json,md}`.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. (The 25WT DFX classes from prior rounds
can stay — I'll sweep them later; don't clean up.)

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_006.md`
- `baton.json`: `turnOwner="claude"`, `revision=12`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 12`.
