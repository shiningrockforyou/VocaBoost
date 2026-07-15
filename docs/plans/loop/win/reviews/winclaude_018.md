# WINCLAUDE round 18 — M-MIG re-run (seed fixed) → new key-path blocker in the CS migration script

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`
- **taskId:** `DEEPFIX_TASK6_WINCLAUDE_MMIG_RERUN`
- **handoff:** `docs/plans/loop/win/handoffs/claude_to_winclaude_018.md`
- **git:** `a967f54` dirty · **run:** 2026-07-15T10:50Z (mig-r18, full-dry, 6 fresh students s130–s135)
- **execDecision:** `NOT_CLEAN` — **PROGRAM VERDICT `pass=5 fail=0 invalid=11 deferred=8 skip=1`. Seed fix WORKED (audit runs end-to-end now); migration legs blocked by a NEW /app key-path bug. fail=0 = no correctness violations found.**

---

## ✅ Seed fix VALIDATED
No more `[SANDBOX GUARD] … not assigned` crash — the nested-`assignments` fix landed. The audit **seeded the MIG cohort** (uids hXSKzDlS, w0qimnAT, OYJ5NYWk, l7bIs5RS, d1LmoxgW, PXmLkDFD) and ran to a **full PROGRAM VERDICT** with all 26 oracle rows. That's the milestone this round.

## PROGRAM VERDICT (verbatim)
```
PROGRAM VERDICT: NOT_CLEAN — pass=5 fail=0 invalid=11 deferred=8 skip=1
```

## ★ The new blocker — the CS migration script has the SAME /app key-path bug (round 3 déjà vu)
The 6 migration `--dry` legs each shell out to `scripts/cs/deepfix-migrate-list-progress.mjs`, which crashes at load:
```
Error: ENOENT: no such file or directory, open 'C:\app\scripts\serviceAccountKey.json'
    at readFileSync (node:fs:440)
    at scripts/cs/deepfix-migrate-list-progress.mjs:146:68
  errno: -4058, code: 'ENOENT', path: 'C:\\app\\scripts\\serviceAccountKey.json'
```
Fired **6×** (RUN-dual/div/rog/forge/race/single). This is the **exact `/app/scripts/serviceAccountKey.json` hard-coded WSL/Docker path from round 3** — but in `scripts/cs/deepfix-migrate-list-progress.mjs:146`, a file the round-4 `LSR_SA_KEY`/repo-relative fix (applied to `lsr_reviewonly_fb.mjs`) **did NOT cover.** (Consistent with CLAUDE.md: the `scripts/cs/` tools are designed to run from `/app` via `NODE_PATH=/app/node_modules` — the Codex/WSL env — so they hard-code `/app` paths that don't resolve on native Windows.)

## Per-oracle map (verbatim) — the cascade is all downstream of that ENOENT
| Verdict | Oracles | Why |
|---|---|---|
| ✅ **PASS (5)** | SELF-EVAL, MIG-8 (code-walk), MIG-10a (static), SANDBOX-GUARD (dry, 0 docs — vacuous), MIG-9 (dry cohort asserts: twiReg=0 csdReg=0 migVer_ok) | don't need the migration subprocess |
| ⛔ **INVALID (11)** | RUN-dual/div/rog/forge/race/single (`NO REPORT (exit 1)` = the ENOENT) → then MIG-1/2/3/4/5 (`pair absent from plan / seed did not materialize`) | migration `--dry` produced no plan, so the correctness oracles had nothing to assert |
| 🕓 **DEFERRED (8)** | MIG-10b (retarget not shipped at HEAD — real status), MIG-9-backup, MIG-6, MIG-7 (×2), MIG-9-commit, MIG-10-commit, RET-3 | all "NOT RUN (write-guarded; Codex Task-6)" — need `--commit` real writes, out of scope for this `--dry` |
| ⏭️ **SKIP (1)** | MIG-TID (teacherIds backfill — heavy, default-off) | |

## Key reads (pointers, NOT fixes)
- **fail=0 is meaningful:** no migration-correctness violation surfaced among the oracles that could evaluate. The 11 INVALIDs are a **blocked verification** (subprocess couldn't load its key), not evidence of a migration bug. The static/code-walk oracles that DID run (MIG-8 errored-anchor abort, MIG-9 cohort non-regression, MIG-10a valid-anchor) all PASS.
- **No writes happened:** the migration subprocess died at import (line 146) before doing anything; `--dry` was never even reached. SANDBOX-GUARD PASS (re-verified the plan — which was empty). So `--dry` write-free holds, trivially.
- **The 8 DEFERRED are legit** — they require the `--commit` write-leg (Codex Task-6), not runnable here; not failures.

## For WSL-Claude (deliverable)
Seed's fixed; the audit now runs. **One file blocks the actual migration verification: `scripts/cs/deepfix-migrate-list-progress.mjs:146` hard-codes `/app/scripts/serviceAccountKey.json`.** Apply the same round-4 fix (repo-relative key + `LSR_SA_KEY` override) to that CS script — or have the audit invoke it with a resolvable key path — and the 6 RUN-* legs + MIG-1..5 correctness oracles will finally evaluate. Then we get the real migration-correctness signal (currently: no FAILs, but MIG-1..5 unverified).

## Executor discipline / hygiene
Executor-only, no edits (did NOT touch the CS script). `--use-system-ca` per David's confirmation. Sandbox `lsr_*`/25WT only; MIG cohort classes left in place. No 26SM/prod. No commits/branches. No classifier gate this round (ran fine).

## Hand back
- Report: `docs/plans/loop/win/reviews/winclaude_018.md`.
- `baton.json` → `turnOwner="claude"`, `revision=36`, `execStatus="run-written"`, `execDecision="NOT_CLEAN"`, `updatedBy="winclaude"`, `updatedAt=2026-07-15T10:51Z`.
- Watcher re-backgrounded at baseline 36. Dev server up on 5173.
