# Throttle (#11) Fix — Validation via Duplicated At-Risk Students

**Date:** 2026-07-15 · **Status:** #11 fix reported LIVE. This doc defines how to *prove* it recovers real at-risk
student profiles by cloning them into the sandbox and driving them through Playwright.
**Scope:** the review-only / intervention-throttle deadlock (NEED_TO_FIX #11) — both the throttle variant and the
list-end variant. **Binding rule (H4): sandbox only** — clone into 25WT + a cloned list with `lsr_*@vocaboost.test`
students; NEVER seed or drive a 26SM account.

Regenerate the live risk list any time: `NODE_PATH=/app/node_modules node scripts/cs/scan-throttle-risk.mjs`.

---

## 1. Who is at risk (as of 2026-07-15 scan: 804 started students)

- **AT the wall (throttled, 0 new words): 12** — `sh.ericsong08, suvin011611, iayeon24, 206698@gardenschool.edu.my,
  10tothepowerof3yeseul, aaronjo0927, jaeminhyun0528, victoryjun1012, joony0607, doho0820, easiest1023, jinwoo8315`.
- **CLOSE (interv ≥ 0.78, one low review from zero): 6** — `hyeonseopyun, a01020980733, ajeong525, 김준서(Inter B3)`,
  **plus two reset students already sliding back**: `dgdcy025` (임찬영, reset→next review 0), `roy20110529` (Roy, reset→0.1).
- **WATCH (interv 0.55–0.78): 56** — many are reset students sitting at the 0.556 baseline, drifting down.

**Key finding:** the per-student *reset* band-aid does NOT hold for genuinely low-retention students — dgdcy025 and
roy20110529 were reset hours earlier and their very next real reviews (0 and 0.1) put them straight back at the edge.
That is the throttle correctly gripping ~10%-retention students; only the deployed fix (or disabling intervention) changes it.

### The 6 coverage archetypes (clone one high-fidelity student per archetype — not all 74)

| # | Archetype | Rep student | Seed `class_progress` (list / pace) | Stresses |
|---|---|---|---|---|
| A | **Hard-frozen** | suvin011611 (Adv B1) | csd=16, twi=1280/1600, Ascent/80; recentSessions reviews `[0,0,0]` (d14 r0/n.93, d15 r0/n.93, d16 r0/n1) | Deadlock release on a pure-zero review-only day |
| B | **Chronic-low, N-consecutive** | 206698@garden… (Inter B2) | csd=13, twi=800/1200, BaseCamp/80; d8 r.2/n1, d9 r.1/n1, d10 r.2/n1, **d11 r.1, d12 r.23, d13 r.23 (review-only)** | csd advancing through MANY review-only days without demotion (P5 durable-ledger) |
| C | **Recovering** (keystone) | iayeon24 (Adv B1) | csd=8, twi=640/1600, Ascent/80; d6 r0/n.93, d7 r0/n.93, **d8 r.767/n.97** | Good review is RECORDED and lifts interv → new words return |
| D | **Reset-slid-back** | dgdcy025 (Inter A2) | csd=13, twi=876/1200, BaseCamp/80, interv 0.556; d10 r.5, d11 r.5, d12 r.5, **d13 r0/n.93** | A student who fails after recovery keeps getting COMPLETABLE review-only days, never re-freezes |
| E | **Close/boundary** | a01020980733 (Adv B1) | csd=7, twi=562/1600, Ascent/80; d5 r.33/n1, d6 r.17/n1, d7 r.43/n.93 (interv 0.98, ~2 new words) | Trickle-of-new-words day still completes normally (twi += 2) |
| F | **List-end** | m4Q19Kk4 (Adv A1) | csd=20, twi=1600/1600, Ascent/80 (finished) | The OTHER #11 variant — finished-list review-only / finished-terminal |
| — | **Control (no regression)** | any healthy student | e.g. csd=k, reviews ≥0.8, words remaining | Healthy student still completes new+review, csd/twi advance normally |

---

## 2. The issue, and what "fix valid" means

**Issue (NEED_TO_FIX #11):** interv→1.0 → `calculateDailyAllocation` gives `newWordCount=0` → the day is review-only →
the Day-2+ completion gate demands a passed same-day new-word test that cannot exist → the day **never completes** →
`currentStudyDay` frozen AND the review score is never appended to `recentSessions` (that write only happens in
`recordSessionCompletion`) → `calculateInterventionLevel` stays pinned on old low reviews → interv stays 1.0. Self-reinforcing
deadlock. The list-end variant is the same, triggered by `twi ≥ listSize` instead of throttle.

**"Fix valid for a profile"** = ALL of:
1. **No block** — completing the review-only day does NOT show "먼저 새 단어 시험을 통과해야 합니다" and does NOT bounce to dashboard.
2. **csd advances** (+1) on review-only completion, and **survives reconciliation** (non-demoting; N consecutive review-only
   days are NOT demoted back — the P5 durable-review-attempt-ledger concern).
3. **Review score written** — `recentSessions` gains an entry carrying the submitted `reviewScore` with `newWordScore: null`.
4. **Recovery fires** — as recorded reviews climb to ≥ ~0.30 avg, interv drops below 1.0 → `newWordCount > 0` returns.
5. **twi integrity** — `totalWordsIntroduced` does NOT move on review-only days; monotonic overall.
6. **No regression** — a healthy (non-throttled) student still completes new+review normally.

---

## 3. Playwright audit design — "duplicate → drive → assert"

A seed-from-real-profile layer on top of the existing review-only harness (`audit/playwright/lsr_reviewonly*.mjs`,
`audit/playwright/REVIEWONLY_HARNESS.md`, `docs/plans/PLAN_reviewonly_playwright_audit.md`). **Sandbox only (H4).**

### Step 1 — Seed (duplicate)
A seed script writes each archetype's EXACT `class_progress` (csd, twi, `recentSessions` with the precise review pattern
in §1, `interventionLevel`) onto a fresh sandbox student, plus matching `study_states` and a cleared `session_state` so the
day rebuilds. Reproduces the real at-risk state deterministically and in isolation. A pre-verifier asserts the seed took
before any drive (H4 seeding discipline). Proposed: `scripts/cs/seed-throttle-personas.mjs` → 25WT + cloned list.

### Step 2 — Drive
Log in as each sandbox clone, enter the daily session, complete the review test. For recovery / N-consecutive archetypes,
drive MULTIPLE days feeding scripted review scores (low to hold, high to recover).

### Step 3 — Assert (hybrid E2E + white-box oracles)

| Oracle | Check | Criterion | Archetypes |
|---|---|---|---|
| UI (E2E) | review submits; no "pass new-word test first" modal; no dashboard bounce; next day renders | 1 | all |
| Firestore | `currentStudyDay == seed+1` after each completion; over N days only increases | 2 | A, B |
| Firestore | `recentSessions` gained an entry with submitted `reviewScore`, `newWordScore==null` | 3 | A, B, D |
| Firestore + UI | after good reviews, `initializeDailySession` yields `newWordCount > 0` and UI presents a new-word test again | 4 | **C (keystone)** |
| Firestore | `totalWordsIntroduced` unchanged across review-only days; monotonic overall | 5 | all |
| UI | control healthy student completes new+review; csd/twi advance normally | 6 | control |

**White-box where UI can't reach:** csd-non-demotion over N consecutive days and the interv recompute call
`initializeDailySession` / read `class_progress` directly (harness already does hybrid E2E/white-box per Task-4 design).

**Keystone scenario = Archetype C (Recovering)** — it proves the entire point of the fix (recorded reviews now feed
recovery) and is the one most likely to expose a *partial* fix (day completes but interv still doesn't move). Mark it
blocker-level. Archetype B (N-consecutive non-demotion) and F (list-end) are the next two highest-value.

### Fail-closed / certification
Per the deepfix audit conventions: runId + git-dirty marker + resolved BASE bound into the manifest; per-scenario sandbox
triple + pre/post Firestore snapshots; INVALID ≠ PASS; identity-bound to sandbox accounts; import-time localhost guard.

---

## Appendix — provenance
- Live risk scan: `scripts/cs/scan-throttle-risk.mjs` (READ-ONLY tiers: AT-wall / CLOSE / WATCH).
- Related: `scripts/cs/scan-throttle-stuck.mjs`, `scripts/cs/fix-throttle-reset.mjs` (the CS band-aid this fix retires).
- Root cause + fix: NEED_TO_FIX #11; `src/utils/studyAlgorithm.js:66` (calculateInterventionLevel),
  `src/services/studyService.js:1808` (the `!reviewOnlyDay` gate skip), `src/services/progressService.js:574,588`
  (recentSessions append + csd+1); server copies in `functions/foundation.js:307,912`.
