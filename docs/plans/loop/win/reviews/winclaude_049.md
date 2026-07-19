# WINCLAUDE round 49 — DRIVE the tier-3 seeded-recovery loop (1-student A1 seed) — ✅ DROVE → `INVALID_PRECONDITION` (seed-fidelity finding)

- **Executor:** Windows-native Claude Code @ `C:\Users\dmchw\vocaboost`.
- **taskId:** `WINCLAUDE_D35_TIER3_DRIVE` · **execDecision:** `DROVE` · **scenario verdict:** `INVALID_PRECONDITION`. LIVE PROD (client `6bffe1c` / functions `0ddbb34`), real UI + Admin read-back. **No 26SM write** — sandbox seed uid `irZu1zzY3uOdxmcouI6TzWy5YJ83` only.

---

## What ran
The clone→drive→assert loop executed end-to-end on the committed 1-student seed (`a2_clone_roster.json`: `lsr_a2_jisua1@vocaboost.test`, class `25WTa2r11`, list `dVliNv0p9jqZYp9rfLpN`):
1. **Login OK** — authenticated the seed student on live prod.
2. **`renderCheck` (F-b)** — dashboard renders an actionable session, **but NOT the documented Day-6 A1 throttle state**: it renders **"DAY 11 · Review Study — Day 11 · Card 1 of 51 · 9 of 60 mastered"**.
3. **Admin read-back** — surfaced the root cause (below).

## Finding — `INVALID_PRECONDITION` (seed fidelity), M4 invariant HELD
The seed was minted at `class_progress.csd=5 / twi=400` (intended Day-6 throttle-deadlock). **On login, `resolveListProgress` reconciled it to `csd=10 / twi=554`** and wrote that back to the **legacy `class_progress` doc** via `safeValuesForDoc` — the M4 read-only-candidate write path — **because the 27 seeded attempts span `studyDay` 1→10 while csd was seeded at 5.** The reconciler treats the attempts as durable evidence and advances csd to match, so the client renders **Day-11**, not the intended Day-6.

| Signal | Seeded | After load (Admin read-back) |
|---|---|---|
| `class_progress.currentStudyDay` | 5 | **10** (reconciled via `safeValuesForDoc`) |
| `class_progress.totalWordsIntroduced` | 400 | **554** |
| attempt `studyDay` span | — | **1–10** (27 attempts) — the reconciliation driver |
| canonical `users/{uid}/list_progress` | — | **0** ✅ **M4 invariant HELD** (no canonical write at `LIST_PROGRESS_CANONICAL=false`) |
| client-rendered day | Day-6 (intended) | **Day-11** |

**This is NOT a product regression.** The deployed reconciler behaved correctly (advance csd to the attempt-anchored day; no canonical write while CANONICAL=false). The scenario is `INVALID_PRECONDITION` because **the seed does not render the documented broken state** — exactly the F-b seed-render risk WinClaude flagged in r44. The 1-student smoke **caught a seed-construction bug before scaling to 156.**

## Why the drive itself was not forced
Driving good reviews at the reconciled Day-11 would test a *different* state than the A1 Day-6 throttle precondition — low signal, high effort, and the handoff itself says "renderCheck F-b … else `INVALID_PRECONDITION`." Returning the precondition finding is the correct execution, not a block.

## Recommended fix (WSL, seed construction)
Align csd with the attempts so the intended precondition renders:
- **Option A (recommended):** trim the seeded attempts to `studyDay ≤ 5` so `csd=5` sticks → renders the Day-6 throttle state; then re-drive.
- **Option B:** seed `csd=10` to match the attempts and re-document the scenario as a Day-11 throttle.

Then re-issue the drive — the tier-3 driver (login → renderCheck → `driveTestToResults` MCQ good-answer + M5 dialog → read-back) is ready and unchanged.

## Loop mechanics — validated
login ✅ · `renderCheck` ✅ (correctly detected the mismatch) · Admin read-back ✅. The clone→drive→assert harness **functions**; the finding is a seed issue, not a driver issue.

## Evidence
- `audit/playwright/findings/deepfix_d35_tier3_a1_drive.json` (verdict `INVALID_PRECONDITION`, M4_invariant_held=true, seed→reconciled deltas, fix).
- Diagnostics: `audit/deepfix/task6/d35_a1_inspect.mjs`, `audit/deepfix/task6/d35_a1_finalize.mjs`.

## Hand back
- Report: this file + `findings/deepfix_d35_tier3_a1_drive.json`.
- **WSL:** re-seed with csd/attempts aligned (Option A), then signal re-drive; `assert-recovery.mjs` confirms the verdict. Watcher re-armed at baseline 97.
