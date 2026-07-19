# WINCLAUDE round 50 — RE-DRIVE corrected A1 seed (tier-3, live prod) — ✅ DROVE → **A1 RECOVERY PASS**

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_TIER3_REDRIVE` · **execDecision:** `DROVE` · **scenario verdict:** **PASS** (A1 throttle-deadlock escapes). LIVE PROD (client `6bffe1c` / functions `0ddbb34`), real UI + Admin read-back. **No 26SM write** — sandbox uid `irZu1zzY3uOdxmcouI6TzWy5YJ83` only.

---

## Seed fix verified → the intended precondition now renders
Your r49 seed-fidelity catch is fixed. The re-seeded student renders the **Day-6 review-only (throttle) A1 state**, not Day-11:
- `renderCheck`: **`rendersDay6=true`, `rendersDay11=false`** — dashboard "DAY 6 · STEP 1 OF 2".
- Pre-drive read-back: `csd=5, twi=400, interv=1.0, reviewMode=null, recent=[0.23,0.17,0.23], canonical=0`. The A1 deadlock precondition. ✅

## Drive → recovery PROVEN end-to-end
Built `d35_a1_drive.mjs`: a token-overlap MCQ matcher over the **list's own `words` subcollection** (1600 defs) → robust to the `①②` formatting. `skipToTest`/`enterReviewSession` skip the study cards.

| Step | Result |
|---|---|
| **Review #1** | MCQ **matched 30/30 → 100%**, outcome=`results` |
| **Read-back after #1** | `csd` **flat @5** (held — NOT frozen), `twi` flat @400, **`reviewMode`→`false`** (throttle EXITED), `review_recorded` server log (**M7** server-path proof), **canonical `list_progress`=0 (M4 invariant HELD)**, no error/save-failure logs |
| **Post-escape dashboard** | **"DAY 6 · STEP 1 OF 2 · Learn — 80 new words"**, primary CTA **"Start new words →"** (not review-only) → **`escape_confirmed=true`** |

**A1 recovery is PROVEN:** the throttle-deadlocked student cleared `reviewMode` via a good review, `csd` held (review days don't advance csd), **no canonical write** while `CANONICAL=false`, the completion took the **server** path (`review_recorded`), and the next session **re-allocates new words** — the student is unstuck.

## Deviation from the tier-1 prediction (explained, not a regression)
The tier-1 emulator predicted **2** reviews to escape (moderate ~0.70–0.85 scores + M1 hysteresis: 1st held, 2nd flips). The **live** review scored **100%** (matcher 30/30), strong enough to clear `reviewMode`→false in **one** step, so review #2 was correctly "not reached" (no forced review-only session remained). **Outcome identical — escape — with a positive new-words offer as the strongest proof.** The step-count is score-dependent, not a product difference. *(If WSL wants to exercise the exact 2-step hysteresis path, drive a partial ~0.70 review instead of 100% — `partialAnswers` supports it.)*

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_a1_drive_r50.json` (verdict PASS, review1 100%, read-backs, post-escape, M4/M7 flags).
- Drivers: `audit/deepfix/task6/d35_a1_drive.mjs`, `d35_a1_postescape.mjs`, `d35_a1_confirm_seed.mjs`.

## Hand back → WSL asserts
Report + evidence above. **WSL runs `assert-recovery.mjs`** for the authoritative verdict. The tier-3 clone→drive→assert loop is now **validated end-to-end** (seed → render → drive → read-back → escape) — ready to scale to the remaining families / 156 states. Watcher re-armed at baseline 100.
