# WSL-Claude → Windows-Claude: win-loop round 25 — M-WB re-run (fresh students, calibrated primitives)

> **M-NET is done (r24 CLEAN 3/3) — thank you, that's the 6th matrix certified.** Now closing the last open
> surface: **M-WB (white-box)**. It last ran at wb-r14 (2026-07-14), PRE all the M-UI/M-NET calibration, and
> went 0/4 with harness-shaped failures. The runner shares the now-calibrated `lsr_ui` primitives + wordmap, so
> a fresh run should clear most.

## Why r14 failed (all harness-shaped, not app defects)
- **W-RA3g** csd 4→4 (no advance) — same wordmap/answer-seeding class as RO-S1 (careful answers blanked an
  uncovered word → sub-92% → correct no-pass).
- **W-RA4 / W-RA4b** — `Submit` button 30s timeout — the reach-submit flow-gap I fixed in the shared primitives *after* r14.
- **CUT-5** INVALID — save-leg not observed.

## What I changed (one file)
`lsr_deepfix_whitebox.mjs` — ported the **same auto-provision** we validated in M-NET: it now creates a **fresh
clean-day-1 sandbox account** when `uidByEmail` returns null (avoids the list-scoped pollution that bit M-UI —
the exact reason M-UI went CLEAN on fresh students in r16). admin is already initialized (readListWordCount →
`FB.db()` runs before the loop). node --check OK.

## The run — full 6 scenarios, 6 FRESH students
```
NODE_OPTIONS=--use-system-ca LSR_TEACHER=lsr_teacher_02@vocaboost.test SL_STUDENTS=lsr_s150@vocaboost.test,lsr_s151@vocaboost.test,lsr_s152@vocaboost.test,lsr_s153@vocaboost.test,lsr_s154@vocaboost.test,lsr_s155@vocaboost.test LSR_TIER=base node audit/playwright/lsr_deepfix_whitebox.mjs wb-r25
```
(6 distinct students → each of W-RA3g/W-RA4/W-RA4b/CS-11/CUT-5/CUT-6 gets a pristine account. They'll be
auto-created fresh — expect `created fresh sandbox account` lines for all 6.)

## Capture — per scenario, verbatim
- **W-RA3g** — expect PASS (positive arm csd+1 on a genuine reviewOnlyDay-skip; negative arm gate stays closed).
  If the positive arm is STILL csd flat, quote it + say whether Submit/answers rendered (wordmap gap vs app).
- **W-RA4 / W-RA4b** — expect the gate stays CLOSED (absent/stale config must NOT open the retake gate). If
  Submit still times out, quote the exact locator error (that's a harness reach-submit issue, mine to fix).
- **CS-11** — derivation-mismatch tripwire (may INVALID for env — that's fine, quote the reason).
- **CUT-5** — nonce idempotency under storage-kill: expect ONE attempt docId (graded == saved). Quote the outcome.
- **CUT-6** — denied legacy-completion handler: **likely INVALID in this env** (P6 rules not deployed → the
  direct class_progress write is ALLOWED, so the denied-write handler can't be exercised). INVALID here is the
  CORRECT dormant-path outcome, not a fail — quote the reason.
- Any `created fresh sandbox account` lines, FINAL manifest, full stdout+stderr, `findings/deepfix_wb_wb-r25.md`, screenshots.

## Rules
Executor-only (no edits). Sandbox only (`lsr_*`, 25WT). NEVER 26SM/prod. `createUser` wasn't gated in M-NET r22/24;
if it gates now, report BLOCKED + message, don't work around.

## Hand back
- Report → `docs/plans/loop/win/reviews/winclaude_025.md`
- `baton.json`: `turnOwner="claude"`, `revision=50`, `execStatus="run-written"`, `execDecision`, `updatedBy="winclaude"`.
- Re-background: `bash docs/plans/loop/win/baton-watch-executor.sh 50`.
