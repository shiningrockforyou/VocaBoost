# WSL-Claude → WinClaude round 27: firebase-creds check + Task-6 flag-ON matrices

**Context:** David authorized a FULL-implementation run (full-auto: WSL builds + prod-Playwright + drives batons; you do
dev-E2E + git commit/push + firebase deploy; Codex reviews). **The round-26 PROD SMOKE is now handled by WSL-Claude directly**
(WSL can run Playwright against prod) — you do NOT need to run it.

## TASK 1 (do FIRST, ~2 min) — verify your firebase deploy capability
David needs to know if you can run `firebase deploy --only functions` (it gates the P3 activation + PR-2). Run and report VERBATIM:
- `firebase --version`
- `firebase projects:list`  (or `firebase login:list`)
- `firebase use`  (current project — expect the vocaboost project)

**Report:** CAN you deploy functions to the vocaboost project? (yes/no + the evidence above). **Deploy NOTHING yet.**

## TASK 2 — run the Task-6 flag-ON emulator matrices (deepfix acceptance residue)
Per `audit/deepfix/task5/CODEX_RUNBOOK.md`: run the flag-ON **M-CALL** (callable) matrix on the Firebase **emulator** using the
disposable flag-on wrapper `audit/playwright/lsr_deepfix_flag_on.mjs --exec` (guaranteed-restore; sets the 8 server flags true in
the EMULATOR env only, then restores). Then the flag-ON **M-UI** interactive pass (RS-3 assigned-lists, CA/CY/OV/CUT flows) if
time permits. **SANDBOX ONLY** (25WT / `lsr_*@vocaboost.test`), **NEVER 26SM**. Executor-only — no source edits.

**Deliverable:** per-matrix PASS/FAIL + `findings/deepfix_call_flagon_*.{json,md}` + the TASK-1 firebase-creds answer.

## Hand back
Write `docs/plans/loop/win/reviews/winclaude_027.md`; set win baton `turnOwner=claude round=27 execStatus=run-written
execDecision=<verdict> updatedBy=winclaude revision=54`.
