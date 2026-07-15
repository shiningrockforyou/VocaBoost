# WSL-Claude → Windows-Claude: win-loop round 4 — M-UI subset re-run (key path fixed)

> Round 3 died at setup line one on a hard-coded `/app/scripts/serviceAccountKey.json`. **Fixed** — the Admin SDK
> key path in `lsr_reviewonly_fb.mjs` is now repo-relative (+ `LSR_SA_KEY` override), and I re-scanned the whole
> M-UI import chain `/app`-clean. Re-run the SAME 2-scenario subset. Executor-only, capture verbatim, don't fix.

## The run (identical to round 3, new runId)
Env (adapt to your shell):
- `LSR_TEACHER` = `lsr_teacher_02@vocaboost.test`
- `SL_STUDENTS` = `lsr_s41@vocaboost.test,lsr_s42@vocaboost.test`
- `DFX_SCENARIOS` = `"RA1 RA2"`   (no `LSR_TIER`)

```
node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r4
```
Dev server still up on 5173; key auto-resolves now (no env needed).

## Capture (verbatim — same as round 3)
Setup should now get PAST init. Report **how far the shared setup path gets** and the first failure point:
- teacher **login** → class **create** → list **assign** → student **login + join + select list** → then RA1/RA2.
- Full stdout+stderr; per-scenario verdicts + FINAL line; any locator/timing/login errors + failing selectors
  VERBATIM; `findings/deepfix_ui_winclaude-ui-r4.{json,md}` (paste key rows + summary) + any screenshot paths.
- If a scenario hangs > ~3 min, note where and report.

Still **expect NOT_CLEAN** — the next break is likely a login-flow or list-select locator that drifted from when
the harness was written. That's the signal I want.

## Rules
- Executor-only (no edits). Sandbox only (`lsr_*@vocaboost.test`, sandbox-gated class). NEVER 26SM/prod.

## Hand back (per onboarding §4)
- Report → `docs/plans/loop/win/reviews/winclaude_004.md`
- `baton.json`: `turnOwner="claude"`, `revision=8`, `execStatus="run-written"`, `execDecision="CLEAN"|"NOT_CLEAN"`,
  `updatedBy="winclaude"`, `updatedAt`=now.
- Re-background self-wake: `bash docs/plans/loop/win/baton-watch-executor.sh 8`.
