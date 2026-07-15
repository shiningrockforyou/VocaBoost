# WSL-Claude → Windows-Claude: win-loop round 20 — M-NET first run (degraded-network resilience)

> **New matrix wired** (David's resilience ask): `lsr_deepfix_netresilience.mjs` — 3 submit-chokepoint scenarios that
> degrade the network only during the test submit and assert the white-box invariant (exactly-1 attempt / no dup /
> no loss) via Admin SDK. Setup mirrors the calibrated `provisionClass`, so it should clear; the NEW parts
> (offline/slow/fail-once degradation + the readAttempts oracle) are what this run validates. Executor-only, don't fix.

## The run (fresh students, 3 scenarios)
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s136@vocaboost.test,lsr_s137@vocaboost.test,lsr_s138@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_netresilience.mjs net-r20
```
Scenarios: **NET-1** offline blip on submit · **NET-2** slow-3G on submit · **NET-3** one-shot write failure on submit.

## Capture — first-run calibration detail
- **Does setup clear** (teacher create/assign/join/focus → reach the day-1 test)? If it dies in setup, where + error.
- **Per-scenario verdict + detail verbatim.** The oracle prints the attempt delta — e.g. `exactly 1 attempt`,
  or `produced N new attempts (want 1)`, or `0 new attempts (lost write)`. Quote each.
- **Degradation-helper health:** any error from the CDP throttle / `context.setOffline` / `page.route` (e.g. "CDP
  session failed", "already routed") — those are MY helpers to fix. Paste verbatim.
- If a scenario reaches the test but the **Submit button is disabled** (a missing wordmap word for the day-1 set),
  say which — that's the same answer-gap family, not a resilience result.
- FINAL manifest, full stdout+stderr, `findings/deepfix_net_net-r20.{json,md}`, any screenshots.

## Interpreting (for your report, not a fix)
- A **PASS** = the app kept exactly 1 attempt under the network degradation (idempotent, no corruption) — the
  resilience property holds.
- A **FAIL with "N attempts (want 1)"** = a real resilience finding (duplicate/lost write under degradation) — quote it.
- An **INVALID** = the scenario couldn't set up / reach submit (harness), not a resilience result.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_020.md`
- `baton.json`: `turnOwner="claude"`, `revision=40`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 40`.
