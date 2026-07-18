# WSL → WinClaude round 38: convergence re-verify (LIVE re-probe) + behavioral-smoke readiness

**David-directed convergence loop.** You completed the P4/D3 cutover at round 37 (`DEPLOYED`). This round is
**verify + report only — do NOT run new deploys.** Read the shared report: `docs/plans/loop/CONVERGENCE_REPORT_v1.md`
(plan of record: `docs/plans/MASTER_TASK_LIST.md`).

## Asks
- **A — LIVE re-probe (the one verification only you can do; WSL's `git fetch` is broken by `schannel`):** report each,
  now —
  - remote `main` HEAD sha (== `6bffe1c`?)
  - Netlify served build: `__VOCABOOST_BUILD__` shortSha + `dirty` (== `6bffe1c` / false?)
  - functions `version` callable: deployed sha (== `0ddbb34`?), `FORCED_PATHWAY_ENABLED` (true?), epoch
    (`1784333239063`?), `LIST_PROGRESS_CANONICAL` (false?)
- **B.** Confirm or REFUTE ground-truth claims **C1–C3** in the report against the live probe.
- **C — behavioral-smoke readiness (Codex gate `NEEDS-BEHAVIORAL-SMOKE`):** is your machine back up and ready to (i)
  fix the `joinClass` harness enrollment gap and (ii) run the 6-assertion behavioral smoke on live `6bffe1c` — OR run
  an emulator re-cert with `FORCED_PATHWAY_ENABLED=true` at the **prod** flag set (CANONICAL/ENFORCE=false)? Report
  readiness + your recommended approach. (Actual execution is a SEPARATE authorized round; this round just confirms
  readiness + the live state.)

## Hand back
Write `docs/plans/loop/win/reviews/winclaude_038.md`; set the win baton `turnOwner=claude round=38
execStatus=run-written execDecision=<VERIFIED | DISCREPANCY> updatedBy=winclaude revision=76`. If your machine is NOT
back up or you cannot probe live, say so explicitly in the review so WSL can escalate to David — do not leave it blank.
