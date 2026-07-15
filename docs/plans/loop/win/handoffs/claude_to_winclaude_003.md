# WSL-Claude → Windows-Claude: win-loop round 3 — FIRST real M-UI subset calibration (David: GO)

> David gave explicit **GO** for the browser leg. This is the first REAL M-UI run — it logs into the **25WT sandbox**
> and drives scenarios. Deliberately SMALL (2 scenarios) to surface setup/login/locator issues cheaply before the
> full 37-scenario pass. **Executor-only: RUN + capture verbatim, do NOT fix.** First-run failures are EXPECTED.

## The run
Set these env vars (adapt to your shell — PowerShell `$env:X="…"`, or git-bash `X=…`):
- `LSR_TEACHER` = `lsr_teacher_02@vocaboost.test`   (has base/ascent/summit clones in lsr_lists.json)
- `SL_STUDENTS` = `lsr_s41@vocaboost.test,lsr_s42@vocaboost.test`   (≥2 sandbox students)
- `DFX_SCENARIOS` = `"RA1 RA2"`   (minimal first subset)
- (do NOT set `LSR_TIER` — it defaults to the teacher's first clone, `base`)

Then, from repo root:
```
node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r3
```
- Dev server must be on `localhost:5173` (already up + preflight-confirmed). Password auto-loads from
  `.lsr_secret.json` (present). **No `NODE_PATH` / `PLAYWRIGHT_BROWSERS_PATH` needed** — defaults work (your
  preflight proved `require('playwright')` + Chromium resolve fine).

## Capture (verbatim — this is the whole job)
- **Full stdout + stderr.**
- **The SETUP phase outcome specifically** — the shared critical path, most likely to break first: did the teacher
  **login** succeed? class **created**? list **assigned**? did students **login + join + select list**? Report how
  far it got and the first failure point.
- **Per-scenario verdicts** (RA1, RA2) + the **FINAL summary line**.
- **Any locator / timing / login errors VERBATIM** — include the failing selector/step/text if the harness prints
  it. That's precisely what I fix.
- The artifacts: `audit/playwright/findings/deepfix_ui_winclaude-ui-r3.{json,md}` — paste the per-scenario rows +
  summary; and note any **screenshots** written under `findings/` (the harness calls `shot()` on failures — list
  the paths, they help me diagnose).
- If a scenario **hangs > ~3 min**, note where it stuck and report (don't wait indefinitely).

## Rules
- **Executor-only** — do NOT edit `lsr_deepfix_ui.mjs`/`lsr_ui.mjs`/`src`/anything. Report raw; don't work around.
- **Sandbox only** — `lsr_*@vocaboost.test` identities + the harness's fresh sandbox-gated class. **NEVER 26SM/prod.**
- **Expect NOT_CLEAN** — built-never-run E2E almost always needs locator/timing calibration on the first pass.
  The raw failures ARE the deliverable; I iterate from them.

## Hand back (per onboarding §4)
- Report → `docs/plans/loop/win/reviews/winclaude_003.md`
- `baton.json`: `turnOwner="claude"`, `revision=6`, `execStatus="run-written"`, `execDecision="CLEAN"` (or
  `"NOT_CLEAN"`), `updatedBy="winclaude"`, `updatedAt`=now.
- Re-background self-wake: `bash docs/plans/loop/win/baton-watch-executor.sh 6`.
