# WSL-Claude → WinClaude round 34: Task-6 strict-cert re-runs + bindings on `59df732` (+ M-WB fix attempt)

**Context:** Codex's Task-6 END-GATE (r16) = NEEDS_RERUNS — it will not accept the informal report-waiver; D1
needs a **strict single-runId cert** (`lsr_deepfix_cert.mjs` → `DEEPFIX_AUDIT_CERT_*`) bound to ONE HEAD, OR a
David-accepted formal waiver. This round produces the strict-cert evidence on the CURRENT live HEAD `59df732`.
If M-WB comes clean here, D1 can close autonomously (no waiver needed). SANDBOX ONLY (25WT / `lsr_*` / `dup_*`),
NEVER 26SM.

## Re-run / bind ALL on HEAD `59df732` (record runId, gitHead, gitDirty=false in each finding)
Use ONE shared `runId` (e.g. `cert-59df732-r34`) across all matrices so the consolidator can bind them.
1. **M-CALL** flag-ON emulator (your r27 wrapper `lsr_deepfix_flag_on.mjs --exec`) — expect CLEAN ~21/0.
2. **M-RULES** emulator — **bind the rules artifact**: ensure the finding records a non-null `firestore.rules
   sha256` (the r16 gap). Expect CLEAN 11/0.
3. **M-MIG `--dry`** — expect 10/0/0 dry oracles (the 8 commit legs stay DEFERRED-ledgered).
4. **M-UI** on the live `59df732` prod build (prod-smoke scope for D1) — the flag-off greens (RO/RS) as before.
5. **M-STATIC** is already done (`deepfix_static_59df732-baseline` CLEAN 41/0) — reuse it; confirm `target==shipped`
   per the cert path.
6. **DG-2 + DG-3 live probes** — capture & record as findings: DG-2 = deployed `exports.version` (the functions
   `version` callable payload); DG-3 = hosting build-stamp (`window.__VOCABOOST_BUILD__` == `59df732`). These are
   required by the cert.

## M-WB — ATTEMPT the fix (this is the pivotal one)
M-WB (`lsr_deepfix_whitebox.mjs`) has been 0-PASS across wb-r13/14/25; the 6 W-* are diagnosed harness-artifacts
(W-RA3g answer-seed gap, W-RA4/b reach-submit flow-gaps, CS-11 flag-OFF env, CUT-5/6 Vite import-path fails / join
races) — NOT product defects (behaviors covered by M-CALL). The consolidator REQUIRES M-WB clean (no deferrals).
**Attempt to repair the harness** (port the calibrated primitives / wordmap / auto-provision the M-NET/M-UI fixes
already made; fix the Vite import path). Run it on the flag-ON emulator against `59df732`.
- If you get M-WB clean → run `node audit/playwright/lsr_deepfix_cert.mjs cert-59df732-r34` → it should emit
  `DEEPFIX_AUDIT_CERT_cert-59df732-r34.{json,md}` = **CERTIFIED**. That closes D1.
- If M-WB **cannot** be made clean in a reasonable attempt → STOP, report EXACTLY which W-* scenarios fail and why
  (command + error). Do NOT force it. I'll then build the formal M-NET-substitution waiver artifact for David.

## Discipline
Executor-only (harness edits to `lsr_deepfix_whitebox.mjs` are IN-SCOPE this round since it's audit tooling, but NO
product/functions/rules/client source edits — report those). Guaranteed-restore any flag flips. No 26SM. No deploy,
no commit/push.

## Hand back
Per-matrix result on `59df732` + the DG-2/3 probe outputs + rules-sha + the M-WB verdict (+ cert artifact path if
produced). Write `docs/plans/loop/win/reviews/winclaude_034.md`; set win baton `turnOwner=claude round=34
execStatus=run-written execDecision=<CERT-CLEAN|MWB-BLOCKED|PARTIAL> updatedBy=winclaude revision=68`.
