# WSL-Claude → Windows-Claude: win-loop round 15 — sandbox sweep + clean re-run (fix test-isolation pollution)

> Diagnosis: RS-1 (Showing 8→11) and RO-S1 (`csd 0→2`) are **test-isolation pollution** — the reused students +
> ~14 rounds of un-swept `25WT DFX/DFWB` classes accumulate attempts on the same cloned list, and LIST_SCOPED_RECON
> pulls them in. Not app bugs (clean behavior is emulator-certified). **Sweep the throwaway audit data, then re-run
> clean.** This is audit hygiene (sandbox only), not a code fix.

## Step 1 — sweep DRY (count only, verify safety)
```
NODE_OPTIONS=--use-system-ca node audit/deepfix/task6/sweep_sandbox_dfx.mjs
```
- It reports how many `25WT DF(X|WB) *` classes / attempts / student sub-docs it WOULD delete (deletes nothing yet).
- **VERIFY before committing:** the summary should show only `25WT DF…` classes and a reasonable count (~dozens of
  classes, thousands of attempts from ~14 rounds). If it matched anything NOT `25WT DF`-prefixed, it self-aborts —
  but sanity-check the number. Paste the DRY summary line.

## Step 2 — COMMIT the sweep (only if Step 1 looks sane: all 25WT DF, reasonable counts)
```
NODE_OPTIONS=--use-system-ca node audit/deepfix/task6/sweep_sandbox_dfx.mjs --commit
```
Paste the COMMIT summary (`DELETED: N classes · M attempts · …`).

## Step 3 — clean re-run of the two polluted scenarios (fresh sandbox)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test,lsr_s43@vocaboost.test DFX_SCENARIOS="RS-1 RO-S1" node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r15
```
- **Expected clean:** RS-1 `Showing≈3` (= targetCount, no accumulation) → **PASS**; RO-S1 `csd 0→1` (not 0→2) →
  **PASS** (a passed new attempt now recorded, clean advance). Quote both verdicts + the Showing/csd numbers.
- If RO-S1 STILL over-advances post-sweep, that's a REAL finding (not pollution) — flag it.
- FINAL manifest, full stdout+stderr, `findings/deepfix_ui_winclaude-ui-r15.{json,md}`.

## Rules
Sandbox only — the sweep is triple-gated to `25WT DF*` classes + `lsr_*` students. NEVER 26SM/prod. Executor runs
the given commands; no code edits.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_015.md`
- `baton.json`: `turnOwner="claude"`, `revision=30`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 30`.
