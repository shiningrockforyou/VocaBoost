# WINCLAUDE round 19 — M-MIG re-run (CS key-path fixed) → migration correctness VERIFIED (--dry)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MMIG_RERUN2`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_019.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T10:56Z (mig-r19, full-dry, 6 fresh students s130–s135)
- **execDecision:** `NOT_CLEAN` — **but this is a CLEAN `--dry` pass: `pass=10 fail=0 invalid=0 deferred=8 skip=1`. The NOT_CLEAN is SOLELY the 8 write-guarded deferrals (Codex `--commit` leg). Every migration-correctness oracle that can run in `--dry` PASSES. Zero defects.**

---

## ✅ The CS key-path fix worked — MIG-1..5 flipped INVALID → PASS
The 6 RUN-* legs **no longer ENOENT** — the migration `--dry` subprocess loaded its key (via the new `LSR_SA_KEY || new URL('../serviceAccountKey.json', import.meta.url)`) and produced plans, so the correctness oracles finally evaluated. All five real migration oracles PASS with concrete assertions:

## PROGRAM VERDICT (verbatim)
```
PROGRAM VERDICT: NOT_CLEAN — pass=10 fail=0 invalid=0 deferred=8 skip=1
```

## The migration-correctness map — every runnable oracle PASSES (verbatim actuals)
| Oracle | Verdict | Actual (verbatim) |
|---|---|---|
| **MIG-1** LIVE-STRAND collapse | ✅ PASS | `after.twi=640 anchor.twi=640 pop=LIVE-STRAND action=MIGRATE` (okTwi/okAnchor/okPop/noResidual all true) |
| **MIG-2** divergent + own-anchor CSD | ✅ PASS | `after.twi=640 after.csd=15 pop=LIVE-STRAND` (fast twi + slow csd both kept, not quarantined, A7 clean) |
| **MIG-3** review-only CSD evidence | ✅ PASS | `action=MIGRATE after.csd=13 (anchorDay=3)` (csd preserved, NOT demoted to 3, A6 clean) |
| **MIG-4** forged/anchorless → QUARANTINE | ✅ PASS | `action=SKIP_QUARANTINE quarantine=["ANCHORLESS_TWI …: twi=2000 (invalid anchors present)"] invalidAnchors=1` (never zeroed/promoted, legacy retained) |
| **MIG-5** single-doc 1:1 re-key | ✅ PASS | `pop=single-doc after={csd:5,twi:200} dropped=0` (verbatim, 0 deviations) |
| **MIG-9** cohort hard asserts | ✅ PASS | `twiRegressions=0 csdRegressions=0 artifacts=6 migVer_ok=true` |
| SELF-EVAL · MIG-8 · MIG-10a · SANDBOX-GUARD | ✅ PASS | self-test 10/10 · code-walk abort · valid-anchor static · **16 docs re-verified 25WT + lsr_*** |

**Meaning:** the dual-enroll / reconciliation migration is **verified correct across every write-free scenario** — strand collapse to the cross-class anchor, divergent-CSD screening, review-only evidence preservation, forged/anchorless quarantine, single-doc fidelity, and cohort-wide non-regression. **fail=0, invalid=0 → no migration-correctness defect found.**

## Why "NOT_CLEAN" despite fail=0/invalid=0 — the 8 DEFERRED are legit
All 8 deferrals are **write-guarded `--commit` oracles** that cannot run in a `--dry` audit (they're the Codex Task-6 write-leg):
- MIG-6 (idempotent re-run), MIG-7 ×2 (post-flip catch-up fold), MIG-9-commit (post-commit cohort sweep), MIG-9-backup (per-source backups), MIG-10-commit (CS retarget live sweep), RET-3 (legacy deletion + sweep clean), MIG-10b (F6-3 retarget not shipped at HEAD — a status, not a fail).
- Each is explicitly `NOT RUN (write-guarded; Codex Task-6)`. + MIG-TID SKIP (heavy default-off scan).
These need a real `--commit` migration against the sandbox cohort — a separate authorized write-leg, out of scope for this `--dry` verification.

## Safety confirmations
- **`--dry` = write-free:** confirmed — mode `full-dry`; the artifacts are per-uid `--dry` diffs (migrationVersion=P5-FND-3-v1); no canonical writes.
- **Sandbox triple held:** SANDBOX-GUARD PASS — **all 16 source docs independently re-read as 25WT + `lsr_*@vocaboost.test`.** No 26SM/real docs in the plan.
- Cohort uids: hXSKzDlS, w0qimnAT, OYJ5NYWk, l7bIs5RS, d1LmoxgW, PXmLkDFD (all fresh s130–s135 sandbox).

## For WSL-Claude (deliverable)
**Migration correctness is VERIFIED for the entire `--dry` scope — 10/10 runnable oracles PASS, 0 fail, 0 invalid.** The whole M-MIG thread (r17 seed guard → r18 seed fix → r18 CS key-path bug → r19) is now green on the write-free legs. The remaining 8 DEFERRED are the `--commit` write-leg (idempotency, catch-up fold, post-commit sweep/backups, retarget, legacy-deletion) — they require a real sandbox `--commit` migration (Codex Task-6). If/when you want that leg run from here, note it'll be an actual sandbox write and (like the r15 sweep) may hit the classifier gate → I'd relay to David for an allow-rule. No open ask this round.

## Executor discipline / hygiene
Executor-only, no edits; `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; MIG cohort left in place. No 26SM/prod. No commits/branches. No classifier gate this round.

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_019.md`.
- `baton.json` → `turnOwner="claude"`, `revision=38`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"` (clean `--dry`; deferrals only), `updatedBy="winclaude"`, `updatedAt=2026-07-15T10:57Z`.
- Watcher re-backgrounded at baseline 38. Dev server up on 5173.
