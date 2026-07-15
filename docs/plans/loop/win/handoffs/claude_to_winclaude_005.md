# WSL-Claude → Windows-Claude: win-loop round 5 — M-UI re-run with system-CA trust

> David confirmed: TLS inspection / enterprise CA is expected on the box, and the remedy is **`--use-system-ca`**
> (trust the Windows OS cert store). Your round-4 diagnosis was right and appropriately cautious — thank you.
> Set it for the session and re-run. Executor-only, capture verbatim, don't fix. **Never** `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Step 0 — set system-CA trust for ALL subsequent node runs (durable, this session)
Set the env var in your shell so every `node …` (Admin SDK + harness) trusts the OS store:
- PowerShell: `$env:NODE_OPTIONS = "--use-system-ca"`
- git-bash:   `export NODE_OPTIONS=--use-system-ca`
(Keep this set for M-UI, M-WB, and the upcoming M-NET runs — they all dial real Firestore via the Admin SDK.)

Quick sanity check it worked (should now connect, not TLS-error):
```
node -e "const admin=require('firebase-admin');admin.initializeApp({credential:admin.credential.cert(require('./scripts/serviceAccountKey.json'))});admin.firestore().collection('classes').limit(1).get().then(s=>console.log('FIRESTORE OK, docs=',s.size)).catch(e=>{console.error('STILL FAILING:',String(e).slice(0,160));process.exit(1)})"
```
Report that line (`FIRESTORE OK …` or the error).

## Step 1 — re-run the M-UI subset (same as before, new runId)
Env: `LSR_TEACHER=lsr_teacher_02@vocaboost.test`, `SL_STUDENTS=lsr_s41@vocaboost.test,lsr_s42@vocaboost.test`,
`DFX_SCENARIOS="RA1 RA2"` (no `LSR_TIER`).
```
node audit/playwright/lsr_deepfix_ui.mjs winclaude-ui-r5
```
Dev server still up on 5173.

## Capture (verbatim — same as before)
Setup should now clear the Admin SDK connect. Report **how far the shared setup path gets** and the first failure:
teacher **login** → class **create** → list **assign** → student **login + join + select list** → RA1/RA2.
Full stdout+stderr; per-scenario verdicts + FINAL line; **any locator/timing/login errors + failing selectors
VERBATIM** (this is the likely next break — a UI locator that drifted); findings + screenshot paths.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*@vocaboost.test`). NEVER 26SM/prod. Expect NOT_CLEAN.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_005.md`
- `baton.json`: `turnOwner="claude"`, `revision=10`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 10`.
