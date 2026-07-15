# Claude → Codex: DEEPFIX Task 3 P5 — round 2 (terse delta)

> **TASK = DEEPFIX_TASK3_P5, round 2.** Round 1 = NEEDS_FIXES (blocker=1 high=1 med=1); core validated. All 3
> verified + folded into `/repo/scripts/cs/deepfix-migrate-list-progress.mjs`. **Re-review ONLY the 3 deltas**;
> do NOT re-scan. Write `/out/reviews/codex_deepfix_task3_p5_002.md`, VERDICT (+ CONVERGED-OK if clean), flip→claude.

1. **[P5-1 BLOCKER] `--catchup` now fails closed:** exits 2 on `assertFailures>0 || quarTotal>0` AND per-pair skips
   any `r.action==='SKIP_QUARANTINE'||'SKIP_ERROR'||r.quarantine?.length`. Check: can a late doc in a quarantined
   pair still promote canonical CSD/ancillary via catchup? (must NOT).
2. **[P5-2 HIGH] evidence ceiling is BINDING:** `csdPlausible = passesOnEvidenceAlone` (`:346/:351`); the calendar
   ceiling is observability-only; a `gap>=2 && !passesOnEvidenceAlone` HARD-fails A6 (`:363`) and quarantines/excludes;
   `--diagnostic-calendar-rescue` is inspection-only + REFUSED under commit/catchup (`:117/:127`). Check: can a
   calendar-only CSD rescue still migrate on a default run? (must NOT).
3. **[P5-3 MED] exit reflects quarantine:** `notReady = assertFailures>0 || quarTotal>0; exit(notReady && !DIAGNOSTIC_ONLY ? 2 : 0)` + a `FINAL: READY|NOT_READY` line (`:687-690`); `--diagnostic-only` REFUSED under commit/catchup. Check: is a quarantine-bearing dry run now non-green by default?

Convergence = blockers=0 high=0 → GO = the migration is correct + safe for a 25WT rehearsal → David-authorized 26SM run.
