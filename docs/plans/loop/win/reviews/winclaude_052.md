# WINCLAUDE round 52 — OFF-BY-ONE disambiguator (drive one completion) — ✅ DROVE → **RECOVERED (PASS)** + oracle confirmed

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_OBO_DISAMBIG` · **execDecision:** `DROVE`. LIVE PROD (client `6bffe1c` / functions `0ddbb34`), one student, real UI + Admin read-back. **No 26SM write** — sandbox uid only (`obo_GL7SXB` / 김우주, class `25WTa2r12`, list `RmNNkuLPectBlBPiLbAJ`).

---

## Result — off-by-one recovers on completion (not bare load)
Drove 김우주 through the offered day. `class_progress.csd` **reconciled 5 → 6**:

| signal | pre-login | post-login (bare load) | after completion |
|---|---|---|---|
| `csd` | 5 | **5** (unchanged) | **6** ✅ (past seeded 5) |
| `twi` | 360 | 360 | **360** (stable — no phantom new words; day-6 was already done) |
| server logs | — | `resolve_list_progress`, `impossible_phase_detected` | **`csd_twi_reconciled` ×1** (M7 server path) |
| canonical `list_progress` | 0 | 0 | **0** (M4 invariant HELD) |
| rendered day | 7 | 7 | 7 (= csd+1, correct) |

**Clean progression:** csd advanced, not demoted, twi stable, server-reconciled, canonical untouched. **Verdict: OFF-BY-ONE RECOVERED (PASS)** — confirms the oracle fix.

## The disambiguation is answered
- **R51 bare dashboard load:** csd stayed 5 (no reconcile).
- **R52 with a completion/submission:** csd reconciled 5→6 (`csd_twi_reconciled` fired).
- → **confirms** "off-by-one advances csd on COMPLETION, not on bare load" (the `change_action_log` 2026-07-18 "advance on completion not score" oracle). My R51 finding was the correct catch; the fix is working, it's just completion-triggered.

## Honest caveat (drive quality)
My MCQ matcher matched **0/30** on this **new-word** test (vs 30/30 on the review tests in r50/r51) and `outcome=timeout`. So the csd advance is **reconcile-driven** (triggered by the completion/submission) rather than a *verified high-score* pass. Two implications:
1. It **reinforces** "advance on completion, **not** score" — csd corrected to the already-completed day 6 regardless of my (poor) answers, because day-6 completion was genuine in the seed. twi stayed 360 (no new words) is consistent with a pure csd reconcile, not a fresh day.
2. It exposes a **matcher gap on new-word tests** — likely the new-word MCQ uses the reverse direction (definition prompt → word options) or a different word-heading selector than the review MCQ. **Flagged for future rounds** that need *verified* new-word completions; it does **not** affect this disambiguation (the reconcile is completion-triggered, which is exactly what we set out to confirm).

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_obo_complete_r52.json` (pre/post-load/post-completion read-backs, logs, verdict + caveat).
- Driver: `audit/deepfix/task6/d35_obo_complete.mjs`.

## Hand back → WSL asserts
**WSL runs `assert-recovery.mjs`** for the authoritative verdict. Off-by-one family now: recovers on completion (csd 5→6, clean, server-reconciled). Combined with r51: **throttle 3/3 PASS + off-by-one recover-on-completion CONFIRMED**. If WSL wants a *verified high-score* new-word completion, I'll fix the new-word-test matcher direction first (separate quick task). Corrected auto-notify watcher armed at baseline 104 (now harness-tracked — see note to David).
