# WINCLAUDE round 51 — TIER-3 batch drive, 5-student recovery wave (scale-up) — ✅ DROVE

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_TIER3_BATCH` · **execDecision:** `DROVE`. LIVE PROD (client `6bffe1c` / functions `0ddbb34`), real UI + Admin read-back, all 5 in ONE round. **No 26SM write** — sandbox uids only (roster `a2_clone_roster.json`, list `RmNNkuLPectBlBPiLbAJ`).

---

## THROTTLE (3/3 PASS — escape confirmed)
Each rendered **Day-(csd+1) review-only** (precondition OK), MCQ matched **30/30 → 100%**, then read-back:

| tag | student | csd (Day) | review | read-back | escape |
|---|---|---|---|---|---|
| thr_0DnzKs | (backup) | 11 → Day-12 | 100% | csd held @11, **reviewMode→false**, `review_recorded`, canonical=0 | ✅ offers new words |
| thr_bFV18s | (backup) | 7 → Day-8 | 100% | csd held @7, **reviewMode→false**, `review_recorded`, canonical=0 | ✅ |
| thr_yiVt86 | **김예린** (phantom-record) | 17 → Day-18 | 100% | csd held @17, **reviewMode→false**, `review_recorded`, canonical=0 | ✅ offers new words |

All 3: `csd` held on the review day (no false advance), throttle cleared (`reviewMode→false`), **server-path** completion (`review_recorded` — M7), **M4 invariant HELD** (canonical `list_progress`=0). Same as r50, each escaped via **one 100% review** (score-dependent 1-step; the exact 2-step M1 hysteresis needs a partial ~0.70 drive — `partialAnswers`).

## OFF-BY-ONE (2/2 did NOT reconcile on load — FINDING)
Per the handoff these should reconcile **csd→csd+1 on load** (resolveListProgress `safeCSD=max(stored,anchor)`), no drive. They did **not**:

| tag | student | pre csd | **post-login csd** | expected | render | logs |
|---|---|---|---|---|---|---|
| obo_GL7SXB | 김우주 | 5 | **5** (unchanged) | 6 | Day-7, offers new words | `resolve_list_progress` + **`impossible_phase_detected`**, no `csd_twi_reconciled`, canonical=0 |
| obo_JoJ2ch | 도하율 | 6 | **6** (unchanged) | 7 | Day-8, offers new words | same |

**Observations (faithful — WSL's `assert-recovery.mjs` judges):**
- `class_progress.csd` was **not** advanced on load (pre==post==seed), and there was **no** `csd_twi_reconciled` log and **no** canonical write.
- Both students **render Day-(csd+2)** and are **offered new words** (not a review-only deadlock) — so the client's effective day is ahead of the stored csd, but the persist did not happen.
- Both logged **`impossible_phase_detected`** on load (also seen on throttle loads, so not OBO-exclusive, but relevant).
- **Two readings for WSL to adjudicate:** (a) `INVALID_PRECONDITION` — the csd reconcile may require a `completeSession` drive, not a bare load (the handoff's load-only assumption is the miss); or (b) a real gap — OBO off-by-one does not self-heal csd in `class_progress` at `LIST_PROGRESS_CANONICAL=false`. I did **not** drive the OBO students (handoff said none needed) — a follow-up round could drive one new-word completion to disambiguate (a)/(b).

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_batch_r51.json` (per-tag pre/post read-backs, render, logs, summary + verdict-hints).
- Driver: `audit/deepfix/task6/d35_batch_drive.mjs` (generalizes the r50 token-overlap MCQ matcher over the roster).

## Hand back → WSL asserts all 5
**WSL runs `assert-recovery.mjs --roster=a2_clone_roster.json`** for authoritative PASS/FAIL/`INVALID_PRECONDITION` per student. Throttle family looks solid (3/3 escape); the OBO reconcile-on-load result is the finding to adjudicate — if it's (a), a quick re-issue with "drive one new-word completion for OBO" closes it. Watcher re-armed at baseline 102.
